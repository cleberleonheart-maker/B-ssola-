package com.bussola.app

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class TrackShareModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "TrackShare"

  @ReactMethod
  fun shareGpx(name: String, content: String, promise: Promise) {
    try {
      val dir = File(reactContext.cacheDir, "exports")
      if (!dir.exists()) dir.mkdirs()
      val safe = name.replace(Regex("[^A-Za-z0-9._-]+"), "_").trim('_').ifEmpty { "track" }
      val file = File(dir, "$safe.gpx")
      file.writeText(content)

      val uri = FileProvider.getUriForFile(
        reactContext,
        "com.bussola.app.fileprovider",
        file,
      )
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/gpx+xml"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, file.name)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, null)
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("track_share_error", e.message)
    }
  }
}