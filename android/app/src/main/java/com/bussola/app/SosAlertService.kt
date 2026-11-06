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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * O aviso do modo de assalto, disparado sem abrir a app (ideia #107).
 *
 * A tile do SOS não abre a app: quem a toca tem o telemóvel bloqueado, no
 * bolso, e um ecrã a acender-se é o pior sítio para estar. Este serviço é
 * foreground durante a contagem (para o aviso não ser adiado pelo Android),
 * mostra uma notificação silenciosa com a contagem e um botão de cancelar, e
 * ao fim do tempo manda o SMS ao contacto guardado.
 *
 * A contagem é mais longa do que a do botão dentro da app (10 s em vez de
 * 5): aqui o toque acidental no bolso é provável e a contagem não se vê com
 * o ecrã apagado. Por isso o cancelamento está sempre à mão, na notificação.
 *
 * Sem a permissão `SEND_SMS` não há aviso: o serviço fecha-se e deixa a app
 * explicar, quando for aberta, que a permissão está em falta.
 */
class SosAlertService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var remaining = COUNTDOWN_SECONDS

  private val tick =
    object : Runnable {
      override fun run() {
        if (remaining <= 0) {
          enviar()
          return
        }
        remaining -= 1
        handler.postDelayed(this, 1000L)
        atualizarNotificacao()
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_CANCEL) {
      parar()
      return START_NOT_STICKY
    }
    // A notificação tem de estar no ecrã antes de o Android nos matar: o
    // `startForeground` tem de vir nos primeiros segundos.
    startForegroundCompat(buildNotification())
    remaining = COUNTDOWN_SECONDS
    handler.postDelayed(tick, 1000L)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  /**
   * Manda o aviso e fecha.
   *
   * O texto é o mesmo do modo de assalto dentro da app, sem o link do
   * rastreio: sem a app a correr não há sessão na nuvem para linkar. A
   * posição e a hora bastam para o contacto saber por onde procurar.
   */
  private fun enviar() {
    val contacto = SosPrefs.contact(this)
    if (contacto.isBlank() || !temPermissaoSms()) {
      parar()
      return
    }
    // Com a app fechada não há sessão na nuvem para linkar — mas o nativo
    // consegue criar uma: o refresh token guardado dá um access token novo,
    // a linha é criada e o serviço de rastreio arranca. Se este passo falhar, o
    // aviso sai na mesma, só sem o link.
    val fix = fixAtual()
    val link = try {
      SosCloud.startLiveSession(this, fix, SosPrefs.battery(this))
    } catch (_: Exception) {
      null
    }
    try {
      @Suppress("DEPRECATION")
      SmsManager.getDefault().sendTextMessage(contacto, null, buildMessage(link), null, null)
      mostrarEnviado(link != null)
    } catch (_: Exception) {
      // Falhou o envio: nada a fazer aqui — a notificação some e a app
      // continua com o aviso do erro quando for aberta.
    }
    parar()
  }

  /** A última posição guardada, como o `LiveFix` do rastreio. */
  private fun fixAtual(): LiveFix? {
    val f = SosPrefs.fix(this) ?: return null
    return LiveFix(
      latitude = f.lat,
      longitude = f.lon,
      accuracy = f.accuracy,
      altitude = f.alt,
      speed = null,
      heading = null,
      batteryLevel = SosPrefs.battery(this),
    )
  }

  /** O texto do aviso: posição, hora, bateria e o link do rastreio. */
  private fun buildMessage(link: String?): String {
    val fix = SosPrefs.fix(this)
    val bateria = SosPrefs.battery(this)
    val hora = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())
    val lat = fix?.lat?.let { String.format(Locale.US, "%.6f", it) } ?: "?"
    val lon = fix?.lon?.let { String.format(Locale.US, "%.6f", it) } ?: "?"
    val acc = fix?.accuracy?.let { String.format(Locale.US, "%.0f", it) } ?: "?"
    val alt = fix?.alt?.let { String.format(Locale.US, "%.0f", it) } ?: "?"
    val bat = bateria?.toString() ?: "?"
    val maps =
      if (fix != null) "https://maps.google.com/?q=${fix.lat},${fix.lon}" else ""
    val rastreio = if (link != null) "\nRastreio ao vivo: $link" else ""
    return "SOS BUSSOLA\n$hora\nLat:$lat Lon:$lon acc:${acc}m alt:${alt}m\nBateria:$bat%\n$maps$rastreio"
      .trim()
  }

  private fun temPermissaoSms(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) ==
      PackageManager.PERMISSION_GRANTED

  private fun parar() {
    handler.removeCallbacks(tick)
    SosPrefs.setPending(this, false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION") stopForeground(true)
    }
    stopSelf()
  }

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.sos_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply { description = getString(R.string.sos_channel_desc) }
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    ensureChannel()
    val cancelar =
      PendingIntent.getService(
        this,
        1,
        Intent(this, SosAlertService::class.java).setAction(ACTION_CANCEL),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_live)
      .setContentTitle(getString(R.string.sos_countdown_title, remaining))
      .setContentText(getString(R.string.sos_countdown_text))
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(0, getString(R.string.sos_cancel_action), cancelar)
      .build()
  }

  private fun atualizarNotificacao() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification())
  }

  /** A notificação que confirma que o aviso saiu. */
  private fun mostrarEnviado(comLink: Boolean) {
    ensureChannel()
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(
      SENT_ID,
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_live)
        .setContentTitle(getString(R.string.sos_sent_title))
        .setContentText(
          getString(
            if (comLink) R.string.sos_sent_text_live else R.string.sos_sent_text,
          ),
        )
        .setAutoCancel(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build(),
    )
  }

  companion object {
    const val CHANNEL_ID = "bussola_sos_alert"
    const val ACTION_SEND = "com.bussola.app.SOS_SEND"
    const val ACTION_CANCEL = "com.bussola.app.SOS_CANCEL"
    const val NOTIFICATION_ID = 4207
    const val SENT_ID = 4208

    /**
     * Segundos de contagem.
     *
     * Mais do que os 5 s do botão dentro da app: aqui o toque acidental no
     * bolso é provável e a contagem não está à vista com o ecrã apagado.
     */
    const val COUNTDOWN_SECONDS = 10
  }
}
