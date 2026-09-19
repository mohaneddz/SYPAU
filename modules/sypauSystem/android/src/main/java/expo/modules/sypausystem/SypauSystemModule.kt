package expo.modules.sypausystem

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The JS-facing surface of SYPAU's Android integration.
 *
 * Functions are request/response; transitions and health come back over events
 * so the UI never has to poll. Everything heavier than a property read lives in
 * a dedicated class — this file is the bridge, not the implementation.
 */
class SypauSystemModule : Module() {

  companion object {
    /** Set while a JS runtime is attached, so the receiver knows where to send. */
    @Volatile
    var active: SypauSystemModule? = null
      private set

    const val EVENT_SYSTEM = "onSystemEvent"
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No Android context available." }

  private val capabilities by lazy { SystemCapabilityManager(context) }
  private val profileController by lazy { DeviceProfileController(context) }
  private val permissions by lazy { PermissionManager(context) }
  private val settingsLauncher by lazy { SettingsLauncher(context) }
  private val geofences by lazy { GeofenceManager(context) }

  @Volatile
  private var trackingMode: String = "balanced"

  @Volatile
  private var updateCount: Int = 0

  @Volatile
  private var lastHeartbeatAt: Long? = null

  fun emitGeofenceEvent(event: Map<String, Any?>) {
    lastHeartbeatAt = System.currentTimeMillis()
    updateCount += 1
    runCatching { sendEvent(EVENT_SYSTEM, event) }
  }

  fun emitServiceHealth(running: Boolean) {
    runCatching {
      sendEvent(
        EVENT_SYSTEM,
        mapOf(
          "type" to "serviceHealth",
          "timestamp" to System.currentTimeMillis(),
          "running" to running
        )
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SypauSystem")

    Events(EVENT_SYSTEM)

    OnCreate {
      active = this@SypauSystemModule
    }

    OnDestroy {
      active = null
    }

    OnStartObserving {
      active = this@SypauSystemModule
      // Anything that fired while JS was dead is replayed on subscribe, so a
      // transition during a cold stretch still reaches the engine.
      for (event in GeofenceReceiver.drainPending()) {
        runCatching { sendEvent(EVENT_SYSTEM, event) }
      }
    }

    Function("getCapabilities") {
      capabilities.describe()
    }

    Function("getPermissions") {
      permissions.describe()
    }

    Function("getSystemState") {
      profileController.captureState()
    }

    Function("applyProfile") { config: Map<String, Any?> ->
      val snapshot = profileController.captureState()
      mapOf(
        "results" to profileController.applyProfile(config),
        "snapshot" to snapshot
      )
    }

    Function("restoreSystemState") { snapshot: Map<String, Any?>, keys: List<String> ->
      profileController.restoreState(snapshot, keys)
    }

    Function("isBatteryOptimized") {
      !permissions.isIgnoringBatteryOptimizations()
    }

    Function("isLocationEnabled") {
      permissions.locationServicesEnabled()
    }

    Function("openDndSettings") { settingsLauncher.openDndAccess() }
    Function("openNotificationSettings") { settingsLauncher.openNotificationSettings() }
    Function("openLocationSettings") { settingsLauncher.openLocationSettings() }
    Function("openAppSettings") { settingsLauncher.openAppSettings() }
    Function("openWriteSettings") { settingsLauncher.openWriteSettings() }
    Function("openWifiPanel") { settingsLauncher.openWifiPanel() }
    Function("openBluetoothSettings") { settingsLauncher.openBluetoothSettings() }
    Function("openMobileDataSettings") { settingsLauncher.openMobileDataSettings() }
    Function("openAirplaneModeSettings") { settingsLauncher.openAirplaneModeSettings() }
    Function("openBatteryOptimizationSettings") { settingsLauncher.openBatteryOptimizationSettings() }

    AsyncFunction("registerGeofences") { zones: List<Map<String, Any?>>, promise: expo.modules.kotlin.Promise ->
      geofences.register(zones) { ok, error ->
        if (ok) {
          promise.resolve(zones.size)
        } else {
          promise.reject("geofenceRegistrationFailed", error ?: "Couldn't register zones.", null)
        }
      }
    }

    AsyncFunction("clearGeofences") { promise: expo.modules.kotlin.Promise ->
      geofences.clear { ok -> promise.resolve(ok) }
    }

    Function("startMonitoring") { mode: String, zoneName: String? ->
      trackingMode = mode
      // High accuracy is the only mode that needs a service of its own;
      // the others ride on platform geofencing and cost nothing idle.
      if (mode == "highAccuracy") {
        LocationForegroundService.start(context, zoneName)
      }
      emitServiceHealth(true)
      true
    }

    Function("stopMonitoring") {
      LocationForegroundService.stop(context)
      emitServiceHealth(false)
      true
    }

    Function("updateMonitoringNotification") { zoneName: String? ->
      if (LocationForegroundService.isRunning) {
        LocationForegroundService.start(context, zoneName)
      }
      true
    }

    Function("getMonitoringStatus") {
      mapOf(
        "running" to LocationForegroundService.isRunning,
        "registeredGeofences" to geofences.registeredCount(),
        "trackingMode" to trackingMode,
        "startedAt" to LocationForegroundService.startedAt,
        "updateCount" to updateCount,
        "lastHeartbeatAt" to lastHeartbeatAt
      )
    }
  }
}
