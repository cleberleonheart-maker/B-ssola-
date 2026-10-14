package com.bussola.app

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "WidgetBridge"

  @ReactMethod
  fun update(data: ReadableMap) {
    val prefs = reactContext.getSharedPreferences(
      BussolaWidgetProvider.PREFS,
      Context.MODE_PRIVATE,
    )
    prefs.edit()
      .putFloat("heading", data.getDouble("heading").toFloat())
      .putString("cardinal", data.getString("cardinal") ?: "—")
      .putFloat("pressure", data.getDouble("pressure").toFloat())
      .putFloat("altitude", data.getDouble("altitude").toFloat())
      .putBoolean("has_alt", data.getBoolean("hasAlt"))
      .putString("temp", data.getString("temp"))
      .apply()
    // Intenção explícita para o provider: um `sendBroadcast` só com `setPackage`
    // e uma ação que não está no <intent-filter> do receiver nunca era entregue
    // (o manifesto só declara APPWIDGET_UPDATE), então o widget ficava preso no
    // último valor. Apontar para o componente dispensa o filtro.
    val intent = Intent(reactContext, BussolaWidgetProvider::class.java)
      .setAction(BussolaWidgetProvider.ACTION_UPDATE)
    reactContext.sendBroadcast(intent)
  }
}