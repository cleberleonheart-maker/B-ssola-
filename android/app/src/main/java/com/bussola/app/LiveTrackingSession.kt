package com.bussola.app

import android.content.Intent
import com.facebook.react.bridge.ReadableMap
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Uma posicao pronta para a tabela `live_shares`. */
data class LiveFix(
  val latitude: Double,
  val longitude: Double,
  val accuracy: Double?,
  val altitude: Double?,
  val speed: Double?,
  val heading: Double?,
)

/**
 * A sessao de rastreio: a linha em `live_shares` e como falar com ela.
 *
 * A URL e a anon key vem do JavaScript (`cloudEndpoint()`) em vez de uma copia
 * aqui: sao credenciais, e duas copias sao duas chances de divergirem sem
 * ninguem perceber. O `accessToken` e o JWT da sessao anonima — sem ele a RLS
 * rejeita o upsert, porque a politica compara `user_id` com `auth.uid()`.
 */
data class LiveSessionConfig(
  val token: String,
  val userId: String,
  val accessToken: String,
  val url: String,
  val anonKey: String,
  val expiresAt: Long,
) {
  /**
   * Sem token nao existe linha; sem credencial todo push volta 401 em silencio;
   * sem prazo o servico nunca para. O JS nunca manda esses campos pela metade,
   * mas o Intent volta pelo sistema e um `takeIf` aqui evita subir um servico
   * que so Appearancearia funcionar.
   */
  fun isUsable(): Boolean =
    token.isNotEmpty() &&
      userId.isNotEmpty() &&
      accessToken.isNotEmpty() &&
      anonKey.isNotEmpty() &&
      url.startsWith("https://") &&
      expiresAt > 0L

  fun writeTo(intent: Intent): Intent =
    intent
      .putExtra(LiveTracking.EXTRA_TOKEN, token)
      .putExtra(LiveTracking.EXTRA_USER_ID, userId)
      .putExtra(LiveTracking.EXTRA_ACCESS_TOKEN, accessToken)
      .putExtra(LiveTracking.EXTRA_URL, url)
      .putExtra(LiveTracking.EXTRA_ANON_KEY, anonKey)
      .putExtra(LiveTracking.EXTRA_EXPIRES_AT, expiresAt)

  /**
   * Corpo do POST de upsert. `Prefer: resolution=merge-duplicates` faz o
   * `on_conflict=token` virar update, entao so as colunas presentes mudam:
   * `started_at` continua sendo a do primeiro insert.
   */
  fun payload(fix: LiveFix, at: Long): String =
    JSONObject()
      .put("token", token)
      .put("user_id", userId)
      .put("latitude", fix.latitude)
      .put("longitude", fix.longitude)
      .put("accuracy", fix.accuracy ?: JSONObject.NULL)
      .put("heading", fix.heading ?: JSONObject.NULL)
      .put("speed", fix.speed ?: JSONObject.NULL)
      .put("altitude", fix.altitude ?: JSONObject.NULL)
      .put("expires_at", isoUtc(expiresAt))
      .put("updated_at", isoUtc(at))
      .toString()

  /**
   * Corpo do ponto do trajecto (ideia #92).
   *
   * `live_shares` e um upsert: uma linha, um ponto, e o anterior desaparece. O
   * trajecto que o viewer desenha precisa de quantas linhas houve, por isso este
   * vai para `live_points`, onde cada fix e um `insert` novo com o `id` numerado
   * pelo servidor. O viewer pede "os pontos com id maior que o ultimo que vi", e
   * por isso o `id` e o que importa: `recorded_at` pode repetir-se entre o JS e
   * aqui e faria o viewer saltar pontos.
   *
   * O `expires_at` e copiado do mesmo sitio para permitir a purga: um ponto sem
   * prazo nao pode ser distinguido de um de uma sessao a terminar.
   */
  fun pointPayload(fix: LiveFix): String =
    JSONObject()
      .put("token", token)
      .put("user_id", userId)
      .put("latitude", fix.latitude)
      .put("longitude", fix.longitude)
      .put("accuracy", fix.accuracy ?: JSONObject.NULL)
      .put("heading", fix.heading ?: JSONObject.NULL)
      .put("speed", fix.speed ?: JSONObject.NULL)
      .put("altitude", fix.altitude ?: JSONObject.NULL)
      .put("expires_at", isoUtc(expiresAt))
      .toString()
}

private fun isoUtc(millis: Long): String =
  SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    .apply { timeZone = TimeZone.getTimeZone("UTC") }
    .format(Date(millis))

/**
 * Le a sessao do Intent.
 *
 * `START_REDELIVER_INTENT` reentrega o Intent original quando o Android
 * recria o processo, entao e dai que o servico tira token, credencial e prazo.
 * Sem Intent — ou com Intent incompleto — nao ha linha para atualizar.
 */
fun readLiveSession(intent: Intent?): LiveSessionConfig? {
  val i = intent ?: return null
  return LiveSessionConfig(
    token = i.getStringExtra(LiveTracking.EXTRA_TOKEN) ?: "",
    userId = i.getStringExtra(LiveTracking.EXTRA_USER_ID) ?: "",
    accessToken = i.getStringExtra(LiveTracking.EXTRA_ACCESS_TOKEN) ?: "",
    url = i.getStringExtra(LiveTracking.EXTRA_URL) ?: "",
    anonKey = i.getStringExtra(LiveTracking.EXTRA_ANON_KEY) ?: "",
    expiresAt = i.getLongExtra(LiveTracking.EXTRA_EXPIRES_AT, 0L),
  ).takeIf { it.isUsable() }
}

/** Mesma sessao, vinda do `ReadableMap` que o modulo recebe do JavaScript. */
fun liveSessionConfig(map: ReadableMap?): LiveSessionConfig? {
  val m = map ?: return null
  return LiveSessionConfig(
    token = m.getString("token") ?: "",
    userId = m.getString("userId") ?: "",
    accessToken = m.getString("accessToken") ?: "",
    url = m.getString("url") ?: "",
    anonKey = m.getString("anonKey") ?: "",
    // `getDouble` devolve 0.0 para chave ausente; `hasKey` evita depender desse
    // detalhe e mantem o "campo faltou" lendo como "campo faltou".
    expiresAt = if (m.hasKey("expiresAt")) m.getDouble("expiresAt").toLong() else 0L,
  ).takeIf { it.isUsable() }
}

/**
 * Grava a posicao na tabela.
 *
 * Falha de rede e 401 sao igualmente "nao gravou", e o servico tenta de novo
 * no proximo fix: um erro isolado nao pode virar sumico no link durante uma
 * emergencia. Por isso devolve so o booleano e nao lanca.
 */
fun pushLivePosition(config: LiveSessionConfig, fix: LiveFix, at: Long): Boolean =
  post(config, "/rest/v1/live_shares?on_conflict=token", config.payload(fix, at), mergeDuplicates = true)

/**
 * Acrescenta o ponto ao trajecto (ideia #92).
 *
 * A mesma politica de `pushLivePosition`: devolve so o booleano. O
 * `Prefer: resolution=merge-duplicates` nao vem aqui — em `live_points` nao ha
 * conflito para resolver, e cada fix tem de ser uma linha nova.
 */
fun pushLivePoint(config: LiveSessionConfig, fix: LiveFix): Boolean =
  post(config, "/rest/v1/live_points", config.pointPayload(fix), mergeDuplicates = false)

/**
 * Um POST para o REST com as credenciais da sessao.
 *
 * O `atraso`/`from` sao os mesmos em todas as chamadas e por isso vivem aqui, e
 * nao repetidos em cada `setRequestProperty`: um erro de digitacao num header
 * custaria um 401 em silencio, e o unico sintoma seria um link que nao actualiza
 * durante uma emergencia.
 */
private fun post(
  config: LiveSessionConfig,
  path: String,
  body: String,
  mergeDuplicates: Boolean,
): Boolean {
  var conn: HttpURLConnection? = null
  return try {
    conn =
      (URL("${config.url}$path").openConnection() as HttpURLConnection)
        .apply {
          requestMethod = "POST"
          connectTimeout = 10000
          readTimeout = 10000
          doOutput = true
          setRequestProperty("apikey", config.anonKey)
          setRequestProperty("Authorization", "Bearer ${config.accessToken}")
          setRequestProperty("Content-Type", "application/json")
          // Sem isso o on_conflict vira erro de chave duplicada.
          if (mergeDuplicates) {
            setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
          } else {
            setRequestProperty("Prefer", "return=minimal")
          }
        }
    val bytes = body.toByteArray(Charsets.UTF_8)
    conn.setFixedLengthStreamingMode(bytes.size)
    conn.outputStream.use { it.write(bytes) }
    val code = conn.responseCode
    if (code !in 200..299) {
      android.util.Log.w("Bussola", "push do live share respondeu $code")
    }
    code in 200..299
  } catch (e: Exception) {
    android.util.Log.w("Bussola", "push do live share falhou", e)
    false
  } finally {
    try {
      conn?.disconnect()
    } catch (_: Exception) {
    }
  }
}

/**
 * Rumo para enviar na tabela, 0–360, ou `null` quando não há leitura.
 *
 * O `bearing` do GPS só existe quando há deslocamento; parado, o Android entrega
 * -1. O magnetometro é a reserva — a mesma ordem de preferência do
 * `resolveLiveHeading` do JavaScript, de propósito: o primeiro fix da sessão é
 * enviado pelo JS e os seguintes por aqui, e se este lado somasse declinação e o
 * outro não, a agulha dava um salto no instante em que o serviço assumia.
 *
 * A declinação geodética que este arquivo usava (`GeomagneticField`) saiu das
 * stubs do SDK no compileSdk 37 e não havia como manter a assimetria à força —
 * a correção que a bússola da tela usa é a que a pessoa configura em
 * Configurações, e ela não vive no serviço.
 */
fun resolveLiveHeading(gpsBearing: Double, magnetic: Double?): Double? {
  if (gpsBearing.isFinite() && gpsBearing >= 0.0) return normalizeDegrees(gpsBearing)
  val mag = magnetic ?: return null
  if (!mag.isFinite()) return null
  return normalizeDegrees(mag)
}

/**
 * 0 <= v < 360, ou `null` quando o valor nao e um angulo.
 *
 * 360 vira 0 em vez de "quase 360": e o mesmo norte, e o viewer arredonda para
 * grau inteiro, onde 360 vira um "360°" que parece leitura quebrada.
 */
fun normalizeDegrees(v: Double): Double? {
  if (!v.isFinite()) return null
  var d = v % 360.0
  if (d < 0.0) d += 360.0
  if (d >= 360.0) d -= 360.0
  return d
}