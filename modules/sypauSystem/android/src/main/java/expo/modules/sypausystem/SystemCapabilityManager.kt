package expo.modules.sypausystem

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.provider.Settings

/**
 * Reports what this device will actually let SYPAU do, right now.
 *
 * Android has progressively closed off the controls this app would like to
 * drive. Rather than attempting them and swallowing the failure, every control
 * declares its real status up front so the UI can tell the truth: what we can
 * set directly, what needs a permission, what only the user can do in Settings,
 * and what is simply not available to a normal app on this OS version.
 */
class SystemCapabilityManager(private val context: Context) {

  companion object {
    const val AVAILABLE_DIRECTLY = "availableDirectly"
    const val REQUIRES_PERMISSION = "requiresPermission"
    const val REQUIRES_SETTINGS_PANEL = "requiresSettingsPanel"
    const val UNSUPPORTED = "unsupported"
  }

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun hasDndAccess(): Boolean = notificationManager.isNotificationPolicyAccessGranted

  fun canWriteSystemSettings(): Boolean = Settings.System.canWrite(context)

  fun describe(): Map<String, Map<String, String>> {
    val dnd = hasDndAccess()
    val writeSettings = canWriteSystemSettings()

    return mapOf(
      "ringerMode" to capability(
        // Dropping to silent counts as a DND policy change from M onwards.
        if (dnd) AVAILABLE_DIRECTLY else REQUIRES_PERMISSION,
        if (dnd) "SYPAU can switch your ringer."
        else "Needs Do Not Disturb access to switch to silent."
      ),
      "ringVolume" to volumeCapability(dnd),
      "notificationVolume" to volumeCapability(dnd),
      // Media and alarm streams aren't policed by the DND permission.
      "mediaVolume" to capability(AVAILABLE_DIRECTLY, "SYPAU can set media volume."),
      "alarmVolume" to capability(AVAILABLE_DIRECTLY, "SYPAU can set alarm volume."),
      "systemVolume" to volumeCapability(dnd),

      "vibration" to vibrationCapability(writeSettings),

      "dnd" to capability(
        if (dnd) AVAILABLE_DIRECTLY else REQUIRES_PERMISSION,
        if (dnd) "SYPAU can change Do Not Disturb."
        else "Needs Do Not Disturb access."
      ),

      "wifi" to wifiCapability(),
      "bluetooth" to bluetoothCapability(),

      // Only carrier and system apps may toggle data.
      "mobileData" to capability(
        REQUIRES_SETTINGS_PANEL,
        "Android only lets you change mobile data yourself."
      ),
      // Writing AIRPLANE_MODE_ON needs a signature-level permission.
      "airplaneMode" to capability(
        REQUIRES_SETTINGS_PANEL,
        "Android only lets you change airplane mode yourself."
      ),

      "brightness" to capability(
        if (writeSettings) AVAILABLE_DIRECTLY else REQUIRES_PERMISSION,
        if (writeSettings) "SYPAU can set screen brightness."
        else "Needs permission to modify system settings."
      ),
      "screenTimeout" to capability(
        if (writeSettings) AVAILABLE_DIRECTLY else REQUIRES_PERMISSION,
        if (writeSettings) "SYPAU can set the screen timeout."
        else "Needs permission to modify system settings."
      )
    )
  }

  private fun volumeCapability(dnd: Boolean): Map<String, String> = capability(
    // Silencing ring/notification/system streams is a DND policy change.
    if (dnd) AVAILABLE_DIRECTLY else REQUIRES_PERMISSION,
    if (dnd) "SYPAU can set this volume."
    else "Needs Do Not Disturb access to silence this volume."
  )

  private fun vibrationCapability(writeSettings: Boolean): Map<String, String> = when {
    // There is no public API for a global vibration switch; the closest
    // honest lever is the ringer's vibrate setting, behind WRITE_SETTINGS.
    writeSettings -> capability(AVAILABLE_DIRECTLY, "SYPAU can change ring vibration.")
    else -> capability(REQUIRES_PERMISSION, "Needs permission to modify system settings.")
  }

  private fun wifiCapability(): Map<String, String> = when {
    // setWifiEnabled became a no-op for normal apps in Android 10.
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> capability(
      REQUIRES_SETTINGS_PANEL,
      "Android only lets you change Wi-Fi yourself."
    )
    else -> capability(AVAILABLE_DIRECTLY, "SYPAU can switch Wi-Fi.")
  }

  private fun bluetoothCapability(): Map<String, String> = when {
    // BluetoothAdapter.enable/disable are restricted from Android 13.
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> capability(
      REQUIRES_SETTINGS_PANEL,
      "Android only lets you change Bluetooth yourself."
    )
    else -> capability(AVAILABLE_DIRECTLY, "SYPAU can switch Bluetooth.")
  }

  private fun capability(status: String, detail: String): Map<String, String> =
    mapOf("status" to status, "detail" to detail)
}
