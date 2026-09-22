package com.bussola.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.ConcurrentHashMap

class GeofenceReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(GeofenceBridge.EXTRA_ID) ?: return
    val name = intent.getStringExtra(GeofenceBridge.EXTRA_NAME) ?: "waypoint"
    val title = intent.getStringExtra(GeofenceBridge.EXTRA_TITLE) ?: "Bússola"
    GeofenceBridge.notifyArrival(context, id, title, name)
  }
}

object GeofenceBridge {
  const val CHANNEL_ID = "bussola_geofence"
  const val EXTRA_ID = "extra_geofence_id"
  const val EXTRA_NAME = "extra_geofence_name"
  const val EXTRA_TITLE = "extra_geofence_title"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Geofence",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Avisos ao entrar em áreas de waypoints"
      }
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(channel)
    }
  }

  fun notifyArrival(context: Context, id: String, title: String, name: String) {
    ensureChannel(context)
    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle(title)
      .setContentText("Você chegou perto de $name")
      .setContentIntent(open)
      .setAutoCancel(true)
      .build()
    NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
  }
}

class GeofenceModule(private val reactContext: ReactApplicationContext) :
  com.facebook.react.bridge.ReactContextBaseJavaModule() {

  override fun getName(): String = "Geofence"

  private val activeFlags = ConcurrentHashMap<String, String>()

  private fun manager(): LocationManager =
    reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

  @SuppressLint("MissingPermission")
  private fun register(
    id: String,
    name: String,
    title: String,
    lat: Double,
    lon: Double,
    radius: Float,
  ) {
    val lm = manager()
    val intent = Intent(reactContext, GeofenceReceiver::class.java)
      .setAction("com.bussola.app.GEOFENCE")
      .putExtra(GeofenceBridge.EXTRA_ID, id)
      .putExtra(GeofenceBridge.EXTRA_NAME, name)
      .putExtra(GeofenceBridge.EXTRA_TITLE, title)
    val pi = PendingIntent.getBroadcast(
      reactContext,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    lm.addProximityAlert(lat, lon, radius, -1L, pi)
    activeFlags[id] = name
  }

  @ReactMethod
  fun addGeofence(
    id: String,
    name: String,
    title: String,
    lat: Double,
    lon: Double,
    radius: Double,
    promise: com.facebook.react.bridge.Promise,
  ) {
    try {
      val hasLoc =
        ContextCompat.checkSelfPermission(
          reactContext,
          Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED ||
          ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION,
          ) == PackageManager.PERMISSION_GRANTED
      if (!hasLoc) {
        promise.reject("no_location", "Permissão de localização ausente")
        return
      }
      register(id, name, title, lat, lon, radius.toFloat())
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("geofence_error", e.message)
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun removeGeofence(id: String) {
    try {
      val lm = manager()
      val intent = Intent(reactContext, GeofenceReceiver::class.java)
        .setAction("com.bussola.app.GEOFENCE")
        .putExtra(GeofenceBridge.EXTRA_ID, id)
        .putExtra(GeofenceBridge.EXTRA_NAME, activeFlags[id] ?: "waypoint")
        .putExtra(GeofenceBridge.EXTRA_TITLE, "Bússola")
      val pi = PendingIntent.getBroadcast(
        reactContext,
        id.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      lm.removeProximityAlert(pi)
      activeFlags.remove(id)
    } catch (_: Exception) {
    }
  }

  @ReactMethod
  fun requestNotificationPermission(promise: com.facebook.react.bridge.Promise) {
    if (Build.VERSION.SDK_INT < 33) {
      promise.resolve(true)
      return
    }
    val granted =
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
    promise.resolve(granted)
  }
}