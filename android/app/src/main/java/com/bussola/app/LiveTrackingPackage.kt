package com.bussola.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class LiveTrackingPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == "LiveTracking") LiveTrackingModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        "LiveTracking" to
          ReactModuleInfo(
            "LiveTracking",
            "com.bussola.app.LiveTrackingModule",
            false,
            false,
            false,
            false,
          ),
      )
    }
}
