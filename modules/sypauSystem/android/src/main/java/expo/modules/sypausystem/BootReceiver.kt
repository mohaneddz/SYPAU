package expo.modules.sypausystem

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences

/**
 * Re-arms monitoring after a reboot.
 *
 * Geofences registered with Play Services do not survive a restart, so without
 * this the app would appear to work until the first reboot and then quietly
 * stop — the failure mode that makes people distrust automation apps.
 *
 * It only acts when the user turned "start on boot" on. The flag is mirrored
 * into SharedPreferences from JS, because at boot there is no JS runtime to ask
 * and the app's SQLite database may not be readable yet.
 */
class BootReceiver : BroadcastReceiver() {

  companion object {
    private const val PREFS = "sypauBoot"
    private const val KEY_START_ON_BOOT = "startOnBoot"
    private const val KEY_TRACKING_MODE = "trackingMode"

    fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun setStartOnBoot(context: Context, enabled: Boolean, trackingMode: String) {
      prefs(context).edit()
        .putBoolean(KEY_START_ON_BOOT, enabled)
        .putString(KEY_TRACKING_MODE, trackingMode)
        .apply()
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
      intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      return
    }

    val preferences = prefs(context)
    if (!preferences.getBoolean(KEY_START_ON_BOOT, false)) return

    val mode = preferences.getString(KEY_TRACKING_MODE, "balanced") ?: "balanced"

    // Only the foreground service can be revived from here. Geofences need the
    // zone list, which lives in the app's database, so the service brings the
    // app up and the engine re-registers them on launch.
    if (mode == "highAccuracy") {
      LocationForegroundService.start(context, null)
    }
  }
}
