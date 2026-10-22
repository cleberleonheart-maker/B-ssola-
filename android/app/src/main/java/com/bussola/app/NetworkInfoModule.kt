package com.bussola.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class NetworkInfoModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getNetworkInfo(promise: Promise) {
    try {
      val map = WritableNativeMap()
      val tm = reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
      val operator = tm?.networkOperatorName?.takeIf { it.isNotBlank() }
      if (operator != null) {
        map.putString("operator", operator)
      }
      val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      var typeStr: String? = null
      if (cm != null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val network = cm.activeNetwork
          val caps = cm.getNetworkCapabilities(network)
          if (caps != null) {
            typeStr = when {
              caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
              caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
              caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
              else -> null
            }
          }
        }
      }
      if (typeStr != null) {
        map.putString("type", typeStr)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  companion object {
    const val NAME = "NetworkInfo"
  }
}
