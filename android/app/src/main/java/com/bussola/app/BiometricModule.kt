package com.bussola.app

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BiometricModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun isAvailable(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(false)
        return
      }
      val bm = BiometricManager.from(reactContext)
      val res = bm.canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
      )
      promise.resolve(res == BiometricManager.BIOMETRIC_SUCCESS)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun authenticate(promptTitle: String, promptSubtitle: String, promptCancel: String, promise: Promise) {
    try {
      val activity = currentActivity
      if (activity !is FragmentActivity) {
        promise.resolve(false)
        return
      }
      val executor = ContextCompat.getMainExecutor(reactContext)
      val biometricPrompt = BiometricPrompt(activity, executor,
        object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            super.onAuthenticationSucceeded(result)
            promise.resolve(true)
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            super.onAuthenticationError(errorCode, errString)
            promise.resolve(false)
          }

          override fun onAuthenticationFailed() {
            super.onAuthenticationFailed()
            // keep trying until success or cancel
          }
        })
      val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle(promptTitle)
        .setSubtitle(promptSubtitle)
        .setAllowedAuthenticators(
          BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        .build()
      activity.runOnUiThread {
        biometricPrompt.authenticate(promptInfo)
      }
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "Biometric"
  }
}
