package expo.modules.sypausystem

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Opens the Android screen that owns a setting SYPAU cannot change itself.
 *
 * Where a Settings *panel* exists (Wi-Fi, internet), it's preferred: it slides
 * over the app instead of throwing the user out into Settings and losing their
 * place. Everything falls back to the full Settings screen, and finally to the
 * app's own detail page, so a launch never simply does nothing.
 */
class SettingsLauncher(private val context: Context) {

  fun openDndAccess(): Boolean =
    launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))

  fun openNotificationSettings(): Boolean = launch(
    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
  )

  fun openLocationSettings(): Boolean = launch(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))

  fun openAppSettings(): Boolean = launch(
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
  )

  fun openWriteSettings(): Boolean = launch(
    Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.fromParts("package", context.packageName, null))
  )

  fun openWifiPanel(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      if (launch(Intent(Settings.Panel.ACTION_WIFI))) return true
    }
    return launch(Intent(Settings.ACTION_WIFI_SETTINGS))
  }

  fun openBluetoothSettings(): Boolean = launch(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))

  fun openMobileDataSettings(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      if (launch(Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY))) return true
    }
    return launch(Intent(Settings.ACTION_DATA_ROAMING_SETTINGS))
  }

  fun openAirplaneModeSettings(): Boolean = launch(Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS))

  /**
   * The direct request adds SYPAU to Android's own exemption list, which is what
   * the permission check reads. The settings list below it can land on an OEM
   * screen (ColorOS "Allow background usage") whose switch Android doesn't see.
   */
  fun openBatteryOptimizationSettings(): Boolean {
    val request = Intent(
      Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      Uri.fromParts("package", context.packageName, null)
    )
    if (launch(request)) return true
    return launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
  }

  private fun launch(intent: Intent): Boolean = try {
    // No activity in the stack when called from a background transition.
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (e: ActivityNotFoundException) {
    // Some OEM builds drop individual settings screens.
    false
  } catch (e: SecurityException) {
    false
  }
}
