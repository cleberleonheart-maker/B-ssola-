package com.bussola.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class PhotoModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  private val pendingPhotoFileRef = java.util.concurrent.atomic.AtomicReference<File?>(null)
  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != CAMERA_REQUEST) return
        val promise = pendingPromise ?: return
        pendingPromise = null
        val file = pendingPhotoFileRef.getAndSet(null)
        if (resultCode == Activity.RESULT_OK && file != null) {
          promise.resolve("file://" + file.absolutePath)
        } else {
          promise.reject("photo_cancelled", "Foto cancelada ou sem câmera disponível")
        }
      }
    }

  override fun getName(): String = "Photo"

  @ReactMethod
  fun takePhoto(promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("photo_busy", "Captura já em andamento")
      return
    }
    val currentActivity = reactContext.currentActivity
    if (currentActivity == null) {
      promise.reject("photo_no_activity", "Sem activity disponível")
      return
    }
    val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
    val resolver = reactContext.packageManager.resolveActivity(captureIntent, 0)
    if (resolver == null) {
      promise.reject("photo_no_camera_app", "Nenhum app de câmera disponível")
      return
    }
    try {
      val dir = File(reactContext.cacheDir, "photos")
      if (!dir.exists()) dir.mkdirs()
      val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
      val file = File(dir, "fn-$stamp.jpg")
      val uri: Uri = FileProvider.getUriForFile(
        reactContext,
        "com.bussola.app.fileprovider",
        file,
      )
      captureIntent.putExtra(MediaStore.EXTRA_OUTPUT, uri)
      captureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      pendingPromise = promise
      pendingPhotoFileRef.set(file)
      currentActivity.startActivityForResult(captureIntent, CAMERA_REQUEST)
    } catch (e: Exception) {
      pendingPromise = null
      pendingPhotoFileRef.set(null)
      promise.reject("photo_error", e.message)
    }
  }

  override fun initialize() {
    super.initialize()
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun invalidate() {
    reactContext.removeActivityEventListener(activityEventListener)
    pendingPromise = null
    super.invalidate()
  }

  companion object {
    private const val CAMERA_REQUEST = 4901
  }
}