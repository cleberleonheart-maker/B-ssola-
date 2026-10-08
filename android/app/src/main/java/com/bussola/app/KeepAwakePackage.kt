package com.bussola.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class KeepAwakePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == "KeepAwake") KeepAwakeModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        "KeepAwake" to
          ReactModuleInfo(
            "KeepAwake",
            "com.bussola.app.KeepAwakeModule",
            false,
            false,
            false,
            false,
          ),
      )
    }
}