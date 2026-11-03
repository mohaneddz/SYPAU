package expo.modules.sypausystem

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.provider.Settings
import android.telephony.TelephonyManager
import android.util.Log

/**
 * Debug experiment: which routes to the radios does this install really have?
 *
 * Each step flips one radio by one route, waits, reads back what the radio
 * itself did, then puts it back. A route only counts if the radio changed: a
 * call that returned true, or a setting that was written, proves nothing on
 * its own, because Android accepts some of these and then ignores them.
 *
 * Airplane mode can't be read back from inside the app without phone-state
 * permission, so its step reports the setting alone and holds long enough for
 * the radio state to be checked over adb (`dumpsys telephony.registry`).
 */
class RadioProbe(context: Context) {
  private val appContext = context.applicationContext
  private val wifi = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
  private val bluetooth = (appContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
  private val telephony = appContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

  fun run(): Map<String, Any?> {
    Log.i(TAG, "probe start")
    val result = mapOf(
      "writeSecureSettings" to granted(Manifest.permission.WRITE_SECURE_SETTINGS),
      "bluetoothConnect" to granted(Manifest.permission.BLUETOOTH_CONNECT),
      "deviceOwner" to SypauDeviceAdmin.isDeviceOwner(appContext),
      "steps" to listOf(
        step("wifi", "WifiManager.setWifiEnabled", ::wifiOn) { wifi.setWifiEnabled(it) },
        step("wifi", "Settings.Global wifi_on", ::wifiOn) { putGlobal("wifi_on", it) },
        step("bluetooth", "BluetoothAdapter.enable/disable", ::bluetoothOn) {
          if (it) bluetooth?.enable() else bluetooth?.disable()
        },
        step("bluetooth", "Settings.Global bluetooth_on", ::bluetoothOn) { putGlobal("bluetooth_on", it) },
        step("mobileData", "Settings.Global mobile_data", ::dataOn) { putGlobal("mobile_data", it) },
        step("airplaneMode", "Settings.Global airplane_mode_on (setting only)", ::airplaneSetting) {
          putGlobal("airplane_mode_on", it)
        },
      ),
    )
    Log.i(TAG, "probe end")
    return result
  }

  private fun step(
    radio: String,
    route: String,
    read: () -> Boolean?,
    write: (Boolean) -> Any?,
  ): Map<String, Any?> {
    val before = read() ?: return mapOf("radio" to radio, "route" to route, "error" to "Couldn't read the current state.")
    val target = !before

    var accepted: String? = null
    var error: String? = null
    try {
      accepted = write(target)?.toString()
    } catch (e: Exception) {
      error = "${e.javaClass.simpleName}: ${e.message}"
    }
    Log.i(TAG, "$route -> $target (accepted=$accepted, error=$error)")

    val after = waitFor(read, target)
    Thread.sleep(HOLD_MS)

    // Put back by the same route. When the route was ignored this still
    // matters: the setting may have been written even though the radio wasn't.
    if (error == null) {
      try {
        write(before)
      } catch (_: Exception) {
        // Nothing more to undo by this route.
      }
      waitFor(read, before)
    }
    Log.i(TAG, "$route restored")

    return mapOf(
      "radio" to radio,
      "route" to route,
      "before" to before,
      "target" to target,
      "accepted" to accepted,
      "after" to after,
      "worked" to (after == target),
      "error" to error,
    )
  }

  private fun waitFor(read: () -> Boolean?, expected: Boolean): Boolean? {
    var value = read()
    val deadline = System.currentTimeMillis() + SETTLE_MS
    while (value != expected && System.currentTimeMillis() < deadline) {
      Thread.sleep(250)
      value = read()
    }
    return value
  }

  private fun wifiOn(): Boolean = wifi.isWifiEnabled

  private fun bluetoothOn(): Boolean? = bluetooth?.isEnabled

  private fun dataOn(): Boolean? = try {
    telephony.isDataEnabled
  } catch (_: SecurityException) {
    null
  }

  private fun airplaneSetting(): Boolean =
    Settings.Global.getInt(appContext.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1

  private fun putGlobal(key: String, on: Boolean): Boolean =
    Settings.Global.putInt(appContext.contentResolver, key, if (on) 1 else 0)

  private fun granted(permission: String): Boolean =
    appContext.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  companion object {
    private const val TAG = "SypauRadioProbe"
    private const val SETTLE_MS = 6_000L
    private const val HOLD_MS = 3_000L
  }
}
