package com.bussola.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ApkDownloaderPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == "ApkDownloader") ApkDownloaderModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        "ApkDownloader" to
          ReactModuleInfo(
            "ApkDownloader",
            "com.bussola.app.ApkDownloaderModule",
            false,
            false,
            false,
            false,
          ),
      )
    }
}
