package com.bussola.app

import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

/**
 * A sessão de rastreio criada pelo próprio telemóvel (ideia #107).
 *
 * O aviso disparado pela tile precisa de um link: sem ele, quem recebe o SMS
 * vê um ponto e não o movimento. Criar essa sessão é trabalho de rede com a
 * credencial do dono — e a credencial que o telemóvel tem guardado é o
 * *refresh* token, porque o access token expira em uma hora e o aviso pode
 * ser disparado dias depois de a app ter estado fechada.
 *
 * O fluxo é: refresh token -> access token -> linha em `live_shares` ->
 * serviço de rastreio a correr. Qualquer passo que falhe deixa o aviso em
 * pé, só sem o link: um SMS com a posição vale mais do que nenhum aviso.
 */
object SosCloud {

  /** Um access token novo a partir do refresh token guardado. */
  fun refreshAccessToken(url: String, anonKey: String, refreshToken: String): String? {
    if (!url.startsWith("https://") || anonKey.isBlank() || refreshToken.isBlank()) return null
    var conn: HttpURLConnection? = null
    return try {
      conn =
        (URL("$url/auth/v1/token?grant_type=refresh_token").openConnection()
            as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 8000
          readTimeout = 8000
          doOutput = true
          setRequestProperty("apikey", anonKey)
          setRequestProperty("Content-Type", "application/json")
        }
      val body = JSONObject().put("refresh_token", refreshToken).toString()
      conn.outputStream.use { it.write(body.toByteArray()) }
      val code = conn.responseCode
      if (code !in 200..299) return null
      val text = conn.inputStream.bufferedReader().use { it.readText() }
      JSONObject(text).optString("access_token").takeIf { it.isNotBlank() }
    } catch (_: Exception) {
      null
    } finally {
      conn?.disconnect()
    }
  }

  /** O token da sessão, como o do rastreio ao vivo: `lnv` + tempo + sorteio. */
  fun newLiveToken(): String =
    "lnv" +
      System.currentTimeMillis().toString(36) +
      java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8)

  /**
   * Cria a sessão e arranca o serviço de rastreio.
   *
   * Devolve o link do rastreio, ou null se não foi possível (sem refresh
   * token, sem rede, sem posição). O link só é devolvido depois de a linha
   * estar criada: um link que abre uma página vazia é pior do que nenhum
   * link.
   */
  fun startLiveSession(
    context: Context,
    fix: LiveFix?,
    battery: Int?,
  ): String? {
    val url = SosPrefs.cloudUrl(context)
    val anonKey = SosPrefs.anonKey(context)
    val refreshToken = SosPrefs.refreshToken(context)
    val userId = SosPrefs.userId(context)
    // A pagina do rastreio vem do JavaScript (que e a unica copia do
    // endereco): o nativo nao tem nenhuma. Sem ela nao ha link, mas o aviso
    // sai na mesma — um SMS com a posicao vale mais do que nenhum aviso.
    val pageUrl = SosPrefs.livePageUrl(context)
    if (url.isBlank() || anonKey.isBlank() || refreshToken.isBlank() || userId.isBlank()) {
      return null
    }
    if (pageUrl.isBlank()) return null
    if (fix == null) return null

    val accessToken = refreshAccessToken(url, anonKey, refreshToken) ?: return null
    val minutes = SosPrefs.liveMinutes(context).coerceIn(5, 120)
    val expiresAt = System.currentTimeMillis() + minutes * 60_000L
    val token = newLiveToken()
    val config =
      LiveSessionConfig(
        token = token,
        userId = userId,
        accessToken = accessToken,
        url = url,
        anonKey = anonKey,
        expiresAt = expiresAt,
      )
    if (!config.isUsable()) return null

    val fixComBateria =
      if (battery == null) fix else fix.copy(batteryLevel = battery)
    if (!pushLivePosition(config, fixComBateria, System.currentTimeMillis())) return null

    try {
      val intent =
        Intent(context, LiveTrackingService::class.java).setAction(LiveTracking.ACTION_START)
      config.writeTo(intent)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    } catch (_: Exception) {
      // Sem serviço, a linha fica na nuvem com a posicao inicial: o link
      // mostra o ultimo ponto conhecido, que ainda e melhor do que nada.
    }

    val base = pageUrl
    return String.format(Locale.US, "%s#tkn=%s", base, token)
  }
}
