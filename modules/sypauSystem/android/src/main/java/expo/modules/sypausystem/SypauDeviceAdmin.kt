package expo.modules.sypausystem

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context

/**
 * The admin component `dpm set-device-owner` points at.
 *
 * It does nothing on its own. Being device owner is what matters: Android
 * exempts the device owner from the Android 10 block on switching Wi-Fi, which
 * no grantable permission lifts. Setting it is a one-time adb step and survives
 * reboots; it's removed with [release] (or `dpm remove-active-admin` while the
 * app is a test-only build).
 */
class SypauDeviceAdmin : DeviceAdminReceiver() {
  companion object {
    fun component(context: Context) = ComponentName(context, SypauDeviceAdmin::class.java)

    fun isDeviceOwner(context: Context): Boolean {
      val policy = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      return policy.isDeviceOwnerApp(context.packageName)
    }

    /** Hands device ownership back, so the app can be uninstalled normally. */
    fun release(context: Context): Boolean {
      if (!isDeviceOwner(context)) return false
      val policy = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      @Suppress("DEPRECATION")
      policy.clearDeviceOwnerApp(context.packageName)
      return true
    }
  }
}
