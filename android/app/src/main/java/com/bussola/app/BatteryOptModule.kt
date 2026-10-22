package com.bussola.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BatteryOptModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      val pkg = reactContext.packageName
      promise.resolve(pm.isIgnoringBatteryOptimizations(pkg))
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      val pkg = reactContext.packageName
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(pkg)) {
        promise.resolve(true)
        return
      }
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:$pkg")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
        promise.resolve(true)
      } catch (ex: Exception) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun openBatteryOptimizationSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "BatteryOpt"
  }
}
