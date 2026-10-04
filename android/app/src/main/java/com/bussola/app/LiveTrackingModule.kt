package com.bussola.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.Executors

/**
 * Constantes do rastreio ao vivo.
 *
 * O servico e quem mantem o processo em foreground **e** quem faz o push da
 * posicao. Antes ele so mantinha o processo vivo e quem enviava era o
 * `setInterval` do JavaScript, que resolve o estrangulamento de timer mas nao o
 * processo morto: com START_REDELIVER_INTENT o processo volta, mas o timer do
 * JS so nasce de novo quando o modal do SOS monta. Ate la a linha em
 * `live_shares` ficava parada e quem via o link so recebia "SEM SINAL".
 */
object LiveTracking {
  const val CHANNEL_ID = "bussola_live_tracking"
  const val NOTIFICATION_ID = 4711
  const val ACTION_START = "com.bussola.app.LIVE_TRACKING_START"
  const val ACTION_STOP = "com.bussola.app.LIVE_TRACKING_STOP"
  const val EXTRA_EXPIRES_AT = "extra_live_expires_at"
  const val EXTRA_TOKEN = "extra_live_token"
  const val EXTRA_USER_ID = "extra_live_user_id"
  const val EXTRA_ACCESS_TOKEN = "extra_live_access_token"
  const val EXTRA_URL = "extra_live_url"
  const val EXTRA_ANON_KEY = "extra_live_anon_key"

  /** Cadencia do push: mesma do `setInterval` que o JS usava. */
  const val PUSH_INTERVAL_MS = 10000L

  /**
   * Intervalo do relogio de expiracao. Nao precisa ser fino: o prazo e de
   * dezenas de minutos e o pior caso e o servico continuar enviando some
   * segundos depois do limite — o viewer ja esconde a posicao expirada pela
   * RPC, entao nao ha o que ver.
   */
  const val EXPIRY_CHECK_MS = 60000L

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        context.getString(R.string.live_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply { description = context.getString(R.string.live_channel_desc) }
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .createNotificationChannel(channel)
  }

  fun hasBackgroundLocation(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED

  /** Sem isto o `requestLocationUpdates` lanca, e o servico subiria sem push. */
  fun hasLocation(context: Context): Boolean =
    ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_COARSE_LOCATION,
      ) == PackageManager.PERMISSION_GRANTED

  fun buildNotification(context: Context, expiresAt: Long): Notification {
    ensureChannel(context)
    val open =
      PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val stop =
      PendingIntent.getService(
        context,
        1,
        Intent(context, LiveTrackingService::class.java).setAction(ACTION_STOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val minutes =
      if (expiresAt > 0) ((expiresAt - System.currentTimeMillis()) / 60000L).coerceAtLeast(0L)
      else 0L

    // "Compartilhando sua local" — o texto antigo, sem o "ção", ficava
    // truncado e parecia erro de digitação na notificação que fica na tela por
    // meia hora. Os textos vêm de strings.xml para sair no idioma do aparelho.
    val text =
      if (minutes > 0) context.getString(R.string.live_active_text_remaining, minutes.toInt())
      else context.getString(R.string.live_active_text)

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_live)
      .setContentTitle(context.getString(R.string.live_active_title))
      .setContentText(text)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(open)
      .addAction(0, context.getString(R.string.live_stop_action), stop)
      .build()
  }
}

/**
 * Servico de foreground que tambem e o cliente HTTP do Supabase.
 *
 * Vive fora do ciclo do JavaScript de proposito: e o unico jeito de a posicao
 * continuar subindo quando o processo morre de vez. O `onDestroy` nao pode
 * apagar a sessao — quando o Android mata o processo e o recria, e o
 * `onStartCommand` que roda de novo, com o Intent original, e o push continua.
 */
class LiveTrackingService : Service(), SensorEventListener {

  private var config: LiveSessionConfig? = null
  private var manager: LocationManager? = null
  private var sensors: SensorManager? = null
  private val worker = Executors.newSingleThreadExecutor()
  private val handler = Handler(Looper.getMainLooper())

  private val rotationMatrix = FloatArray(9)
  private val orientation = FloatArray(3)

  /** Ultimo azimute magnetico em graus, 0–360. `null` ate a primeira leitura. */
  @Volatile private var magnetic: Double? = null

  private var lastPushAt = 0L

  private val locationListener =
    LocationListener { location -> onFix(location) }

  private val expiryTick =
    object : Runnable {
      override fun run() {
        val cfg = config ?: return
        if (System.currentTimeMillis() >= cfg.expiresAt) {
          // A linha fica onde esta. Quem apaga e o `stopLiveShare` do JS, e so
          // quando a pessoa encerra; expirada, a RPC esconde a posicao e o
          // viewer responde "expirou" — apagar aqui destruiria essa distincao.
          stopTracking()
          return
        }
        handler.postDelayed(this, LiveTracking.EXPIRY_CHECK_MS)
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == LiveTracking.ACTION_STOP) {
      stopTracking()
      return START_NOT_STICKY
    }

    val cfg = readLiveSession(intent)
    if (cfg == null) {
      // Processo recriado sem Intent (ou com Intent incompleto): nao ha linha
      // para atualizar, e fingir que sim deixaria o push caindo em 401 a cada
      // 10 s sem ninguem ver.
      stopSelf()
      return START_NOT_STICKY
    }
    config = cfg

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          LiveTracking.NOTIFICATION_ID,
          LiveTracking.buildNotification(this, cfg.expiresAt),
          ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
      } else {
        startForeground(
          LiveTracking.NOTIFICATION_ID,
          LiveTracking.buildNotification(this, cfg.expiresAt),
        )
      }
    } catch (e: Exception) {
      // Sem permissao de foreground service o Android lanca. Nao vale derrubar
      // o rastreio por causa da notificacao: o JS segue tentando enviar.
      stopSelf()
      return START_NOT_STICKY
    }

    startCompass()
    startUpdates()
    handler.removeCallbacks(expiryTick)
    handler.postDelayed(expiryTick, LiveTracking.EXPIRY_CHECK_MS)

    // E REDELIVER, e nao STICKY: com STICKY o Intent chega nulo quando o
    // Android recria o processo e o servico sobe sem token, sem credencial e
    // sem prazo — ou seja, nao sobe. E o que faz este item (#55b) funcionar.
    return START_REDELIVER_INTENT
  }

  override fun onDestroy() {
    stopUpdates()
    handler.removeCallbacks(expiryTick)
    worker.shutdown()
    sensors?.unregisterListener(this)
    sensors = null
    super.onDestroy()
  }

  private fun startUpdates() {
    if (!LiveTracking.hasLocation(this)) return
    val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    manager = lm
    for (provider in TRACKED_PROVIDERS) {
      try {
        if (lm.isProviderEnabled(provider)) {
          lm.requestLocationUpdates(
            provider,
            LiveTracking.PUSH_INTERVAL_MS,
            0f,
            locationListener,
            Looper.getMainLooper(),
          )
        }
      } catch (_: Exception) {
      }
    }
  }

  private fun stopUpdates() {
    try {
      manager?.removeUpdates(locationListener)
    } catch (_: Exception) {
    }
    manager = null
    sensors?.unregisterListener(this)
  }

  /**
   * Magnetometro para o rumo. Sem ele o link mostraria posicao sem direcao
   * sempre que a pessoa estivesse parada, que e justamente o caso de uso do SOS
   * (aparelho no bolso, sem movimento, sem `bearing` do GPS).
   */
  private fun startCompass() {
    val sm = getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
    val sensor =
      sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        ?: sm.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)
        ?: return
    sensors = sm
    sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
    SensorManager.getOrientation(rotationMatrix, orientation)
    magnetic = normalizeDegrees(Math.toDegrees(orientation[0].toDouble()))
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun onFix(location: Location) {
    val cfg = config ?: return
    val at = System.currentTimeMillis()
    if (at >= cfg.expiresAt) {
      stopTracking()
      return
    }
    // `requestLocationUpdates` agrupa e pode despejar varios fix seguidos; sem
    // esta trava viraria uma rajada de POSTs a cada 10 s.
    if (at - lastPushAt < LiveTracking.PUSH_INTERVAL_MS - 2000L) return
    lastPushAt = at

    val altitude = if (location.hasAltitude()) location.altitude else null
    val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else null
    val speed = if (location.hasSpeed()) location.speed.toDouble() else null
    val heading =
      resolveLiveHeading(if (location.hasBearing()) location.bearing.toDouble() else -1.0, magnetic)
    val fix =
      LiveFix(
        latitude = location.latitude,
        longitude = location.longitude,
        accuracy = accuracy,
        altitude = altitude,
        speed = speed,
        heading = heading,
      )

    // `locationListener` roda na main looper: a rede nunca pode entrar aqui.
    worker.execute {
      // A posicao actual primeiro: e ela que mantem o link vivo, e uma falha
      // aqui nao pode ser seguida de um ponto publicado para um link morto.
      // O ponto do trajecto (#92) vem depois e sem bloquear o proximo fix — se
      // falhar, o link continua a vivo e o trajecto ganha um buraco, que e o
      // mal menor.
      if (pushLivePosition(cfg, fix, at)) pushLivePoint(cfg, fix)
    }
  }

  private fun stopTracking() {
    handler.removeCallbacks(expiryTick)
    stopUpdates()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private companion object {
    val TRACKED_PROVIDERS = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
  }
}

class LiveTrackingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "LiveTracking"

  /**
   * Sobe o foreground service, que passa a ser dono do push.
   *
   * Config num `ReadableMap` e nao em argumentos soltos: sao seis credenciais e
   * a ordem delas nao pode ser a fonte de um bug. Resolve `{ok, backgroundLocation}`
   * em vez de lancar: sem `ACCESS_BACKGROUND_LOCATION` o rastreio funciona com o
   * app aberto, e o JS precisa saber disso para avisar o usuario.
   */
  @ReactMethod
  fun start(config: ReadableMap?, promise: Promise) {
    val ctx = reactContext.applicationContext
    val background = LiveTracking.hasBackgroundLocation(ctx)
    val cfg = liveSessionConfig(config)

    if (!background || cfg == null) {
      promise.resolve(status(false, background))
      return
    }

    val intent =
      Intent(ctx, LiveTrackingService::class.java).setAction(LiveTracking.ACTION_START)
    cfg.writeTo(intent)

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
      promise.resolve(status(true, background))
    } catch (e: Exception) {
      promise.resolve(status(false, background))
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    val ctx = reactContext.applicationContext
    try {
      ctx.startService(
        Intent(ctx, LiveTrackingService::class.java).setAction(LiveTracking.ACTION_STOP),
      )
    } catch (_: Exception) {
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun hasBackgroundLocation(promise: Promise) {
    promise.resolve(LiveTracking.hasBackgroundLocation(reactContext.applicationContext))
  }

  private fun status(started: Boolean, background: Boolean) =
    Arguments.createMap().apply {
      putBoolean("started", started)
      putBoolean("backgroundLocation", background)
    }
}
