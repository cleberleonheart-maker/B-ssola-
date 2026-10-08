package com.bussola.app

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KeepAwakeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "KeepAwake"

  @ReactMethod
  fun setEnabled(enabled: Boolean) {
    // Se a activity ainda não existir (app a arrancar), a decisão volta a ser
    // tomada quando o CompassScreen terminar de criar a tela.
    val activity = reactContext.currentActivity ?: return
    val window = activity.window
    if (enabled) {
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    } else {
      window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}