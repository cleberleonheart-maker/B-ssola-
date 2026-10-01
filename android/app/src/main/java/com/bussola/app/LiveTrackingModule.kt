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
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Constantes do rastreio ao vivo.
 *
 * O servico existe apenas para manter o processo em foreground. Quem continua
 * fazendo o push e o JavaScript, pelo `setInterval` do EmergencyModal: com o
 * processo promovido, esse timer deixa de ser estrangulado pelo Android e o
 * `LocationManager` continua entregando fix.
 */
object LiveTracking {
  const val CHANNEL_ID = "bussola_live_tracking"
  const val NOTIFICATION_ID = 4711
  const val ACTION_START = "com.bussola.app.LIVE_TRACKING_START"
  const val ACTION_STOP = "com.bussola.app.LIVE_TRACKING_STOP"
  const val EXTRA_EXPIRES_AT = "extra_live_expires_at"

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
    val minutes = if (expiresAt > 0) ((expiresAt - System.currentTimeMillis()) / 60000L)
      .coerceAtLeast(0L) else 0L

    // "Compartilhando sua local" — o texto antigo, sem o "ção", ficava
    // truncado e parecia erro de digitação na notificação que fica na tela por
    // meia hora. Os textos vêm de strings.xml para sair no idioma do aparelho.
    val text =
      if (minutes > 0) context.getString(R.string.live_active_text_remaining, minutes.toInt())
      else context.getString(R.string.live_active_text)

    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_stat_live)
      .setContentTitle(context.getString(R.string.live_active_title))
      .setContentText(text)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(open)
      .addAction(0, context.getString(R.string.live_stop_action), stop)
      .build()
  }
}

class LiveTrackingService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == LiveTracking.ACTION_STOP) {
      stopTracking()
      return START_NOT_STICKY
    }

    val expiresAt = intent?.getLongExtra(LiveTracking.EXTRA_EXPIRES_AT, 0L) ?: 0L
    val notification = LiveTracking.buildNotification(this, expiresAt)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          LiveTracking.NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
      } else {
        startForeground(LiveTracking.NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      // Sem permissao de foreground service o Android lanca. Nao vale derrubar
      // o rastreio por causa da notificacao: o JS segue tentando enviar.
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  private fun stopTracking() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }
}

class LiveTrackingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "LiveTracking"

  /**
   * Sobe o foreground service. Resolve `{ok, backgroundLocation}` em vez de
   * lancer: sem `ACCESS_BACKGROUND_LOCATION` o rastreio funciona com o app
   * aberto, e o JS precisa saber disso para avisar o usuario.
   */
  @ReactMethod
  fun start(expiresAt: Double, promise: Promise) {
    val ctx = reactContext.applicationContext
    val background = LiveTracking.hasBackgroundLocation(ctx)

    if (!background) {
      promise.resolve(status(false, false))
      return
    }

    val intent =
      Intent(ctx, LiveTrackingService::class.java).setAction(LiveTracking.ACTION_START)
    intent.putExtra(LiveTracking.EXTRA_EXPIRES_AT, expiresAt.toLong())

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
      promise.resolve(status(true, true))
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
