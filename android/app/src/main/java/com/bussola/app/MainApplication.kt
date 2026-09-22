package com.bussola.app

import android.app.Application
import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(ApkDownloaderPackage())
          add(BeepPackage())
          add(MicLevelPackage())
          add(PhotoPackage())
          add(WidgetBridgePackage())
          add(GeofencePackage())
          add(TrackSharePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()

    val prev = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        val resolver = applicationContext.contentResolver
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, "bussola-crash-$stamp.txt")
          put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
          put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri != null) {
          resolver.openOutputStream(uri)?.use { out ->
            out.write("Thread: ${thread.name}\n\n".toByteArray())
            throwable.stackTraceToString().let { out.write(it.toByteArray()) }
            val cause = throwable.cause
            if (cause != null) {
              out.write("\n\nCaused by:\n".toByteArray())
              cause.stackTraceToString().let { out.write(it.toByteArray()) }
            }
          }
        }
      } catch (_: Exception) {
      }
      prev?.uncaughtException(thread, throwable)
    }

    loadReactNative(this)
  }
}
