package com.bussola.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TileStatusModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Os modos cujos tiles já estão no painel de Definições Rápidas.
   *
   * Sem isto, as definições só podem dizer que os tiles existem — o
   * utilizador não sabe se os arrastou ou não.
   */
  @ReactMethod
  fun getAddedTiles(promise: Promise) {
    try {
      promise.resolve(TilePrefs.added(reactContext).toTypedArray())
    } catch (e: Exception) {
      promise.resolve(emptyArray<String>())
    }
  }

  companion object {
    const val NAME = "TileStatus"
  }
}
