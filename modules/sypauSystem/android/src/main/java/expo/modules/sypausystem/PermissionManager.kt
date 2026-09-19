package expo.modules.sypausystem

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Inspects permission state without requesting anything.
 *
 * Requests themselves stay on the JS side, where expo-location and
 * expo-notifications already own the prompt flow — duplicating that here would
 * mean two systems racing for the same dialog.
 */
class PermissionManager(private val context: Context) {

  private val capabilities = SystemCapabilityManager(context)

  fun describe(): Map<String, Map<String, Any>> = mapOf(
    "locationForeground" to state(
      granted(Manifest.permission.ACCESS_FINE_LOCATION),
      canRequestInApp = true
    ),
    "locationBackground" to state(
      // Background location only exists as a separate grant from Android 10.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
      } else {
        granted(Manifest.permission.ACCESS_FINE_LOCATION)
      },
      // From Android 11 this one can only be granted from Settings.
      canRequestInApp = Build.VERSION.SDK_INT < Build.VERSION_CODES.R
    ),
    "locationServicesEnabled" to state(locationServicesEnabled(), canRequestInApp = false),
    "notifications" to state(
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        granted(Manifest.permission.POST_NOTIFICATIONS)
      } else {
        true
      },
      canRequestInApp = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    ),
    "dndAccess" to state(capabilities.hasDndAccess(), canRequestInApp = false),
    "batteryOptimizationExempt" to state(isIgnoringBatteryOptimizations(), canRequestInApp = false),
    "writeSystemSettings" to state(capabilities.canWriteSystemSettings(), canRequestInApp = false)
  )

  fun locationServicesEnabled(): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
      manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
  }

  fun isIgnoringBatteryOptimizations(): Boolean {
    val manager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return manager.isIgnoringBatteryOptimizations(context.packageName)
  }

  fun hasBackgroundLocation(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    } else {
      granted(Manifest.permission.ACCESS_FINE_LOCATION)
    }

  fun hasForegroundLocation(): Boolean = granted(Manifest.permission.ACCESS_FINE_LOCATION) ||
    granted(Manifest.permission.ACCESS_COARSE_LOCATION)

  private fun granted(permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  private fun state(granted: Boolean, canRequestInApp: Boolean): Map<String, Any> =
    mapOf("granted" to granted, "canRequestInApp" to canRequestInApp)
}
