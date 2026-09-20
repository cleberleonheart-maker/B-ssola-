package com.bussola.app

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ApkDownloaderModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ApkDownloader"

  private fun emit(event: String, payload: com.facebook.react.bridge.WritableMap) {
    reactContext.emitDeviceEvent(event, payload)
  }

  @ReactMethod
  fun download(url: String, fileName: String, id: String, promise: Promise) {
    Thread {
      var output: java.io.OutputStream? = null
      var connection: HttpURLConnection? = null
      var insertedUri: android.net.Uri? = null
      try {
        val safeName = if (fileName.endsWith(".apk")) fileName else "$fileName.apk"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
            put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          }
          insertedUri = reactContext.contentResolver.insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values,
          )
          output = insertedUri?.let { reactContext.contentResolver.openOutputStream(it) }
        }
        if (output == null) {
          val fallbackDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: reactContext.filesDir
          if (!fallbackDir.exists()) fallbackDir.mkdirs()
          val file = File(fallbackDir, safeName)
          output = file.outputStream()
        }

        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 20000
          readTimeout = 30000
          instanceFollowRedirects = true
        }
        connection.connect()
        val code = connection.responseCode
        if (code !in 200..299) {
          throw IllegalStateException("HTTP $code ao baixar o APK")
        }
        val total = connection.contentLengthLong
        val input = BufferedInputStream(connection.inputStream)
        val buffer = ByteArray(64 * 1024)
        var received = 0L
        var lastEmit = 0L
        while (true) {
          val read = input.read(buffer)
          if (read <= 0) break
          output.write(buffer, 0, read)
          received += read
          val now = System.currentTimeMillis()
          if (now - lastEmit > 120) {
            lastEmit = now
            val map = Arguments.createMap().apply {
              putString("id", id)
              putDouble("received", received.toDouble())
              putDouble("total", total.toDouble())
            }
            emit("ApkDownloaderProgress", map)
          }
        }
        output.flush()
        output.close()
        output = null
        connection.disconnect()

        val done = Arguments.createMap().apply {
          putString("id", id)
          putString("name", safeName)
          putDouble("received", received.toDouble())
          putString("uri", insertedUri?.toString() ?: "")
        }
        emit("ApkDownloaderDone", done)
        promise.resolve(true)
      } catch (error: Exception) {
        try {
          output?.close()
        } catch (_: Exception) {
        }
        try {
          connection?.disconnect()
        } catch (_: Exception) {
        }
        val fail = Arguments.createMap().apply {
          putString("id", id)
          putString("message", error.message ?: error.toString())
        }
        emit("ApkDownloaderError", fail)
        promise.reject("download_failed", error.message ?: "Falha ao baixar", error)
      }
    }.start()
  }

  @ReactMethod
  fun install(uriString: String, promise: Promise) {
    try {
      if (uriString.isEmpty()) {
        promise.reject("install_failed", "Arquivo do APK indisponível")
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !reactContext.packageManager.canRequestPackageInstalls()
      ) {
        val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${reactContext.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(settingsIntent)
        promise.reject("install_permission", "Permita instalar apps desta fonte")
        return
      }
      val installIntent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(
          Uri.parse(uriString),
          "application/vnd.android.package-archive",
        )
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      reactContext.startActivity(installIntent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("install_failed", error.message ?: "Falha ao instalar", error)
    }
  }
}
