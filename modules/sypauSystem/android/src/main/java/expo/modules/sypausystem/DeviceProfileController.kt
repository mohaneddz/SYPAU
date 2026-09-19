package expo.modules.sypausystem

import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager
import android.provider.Settings
import kotlin.math.roundToInt

/**
 * Applies a profile's intentions to the device, and captures the state it
 * replaced so SYPAU can put things back.
 *
 * Two rules shape everything here:
 *
 *  - An "unchanged" setting is never written. A profile that silences the
 *    ringer must not touch the alarm stream on the way past.
 *  - A control that Android refuses is reported as refused. Nothing in this
 *    class returns "applied" for a call that did not take effect.
 */
class DeviceProfileController(private val context: Context) {

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private val capabilities = SystemCapabilityManager(context)

  companion object {
    const val APPLIED = "applied"
    const val SKIPPED = "skipped"
    const val PERMISSION_REQUIRED = "permissionRequired"
    const val MANUAL_ACTION_REQUIRED = "manualActionRequired"
    const val UNSUPPORTED = "unsupported"
    const val FAILED = "failed"

    private const val UNCHANGED = "unchanged"
  }

  /** Current device state, for the restore stack and the debug screen. */
  fun captureState(): Map<String, Any?> {
    val am = audioManager
    val canReadDnd = capabilities.hasDndAccess()

    return mapOf(
      "capturedAt" to System.currentTimeMillis(),
      "ringerMode" to when (am.ringerMode) {
        AudioManager.RINGER_MODE_SILENT -> "silent"
        AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
        else -> "normal"
      },
      "ringVolume" to percentOf(AudioManager.STREAM_RING),
      "notificationVolume" to percentOf(AudioManager.STREAM_NOTIFICATION),
      "mediaVolume" to percentOf(AudioManager.STREAM_MUSIC),
      "alarmVolume" to percentOf(AudioManager.STREAM_ALARM),
      "systemVolume" to percentOf(AudioManager.STREAM_SYSTEM),
      "dndMode" to if (canReadDnd) readDndMode() else null,
      "brightness" to readBrightness(),
      "brightnessAuto" to readBrightnessAuto(),
      "screenTimeoutSeconds" to readScreenTimeout()
    )
  }

  /**
   * Apply one profile config. Returns a per-control result list; the caller
   * surfaces anything that did not simply apply.
   */
  fun applyProfile(config: Map<String, Any?>): List<Map<String, Any?>> {
    val results = mutableListOf<Map<String, Any?>>()

    results += applyRingerMode(config["ringerMode"] as? String)

    results += applyVolume("ringVolume", AudioManager.STREAM_RING, config["ringVolume"])
    results += applyVolume("notificationVolume", AudioManager.STREAM_NOTIFICATION, config["notificationVolume"])
    results += applyVolume("mediaVolume", AudioManager.STREAM_MUSIC, config["mediaVolume"])
    results += applyVolume("alarmVolume", AudioManager.STREAM_ALARM, config["alarmVolume"])
    results += applyVolume("systemVolume", AudioManager.STREAM_SYSTEM, config["systemVolume"])

    results += applyVibration(config["vibrationMode"] as? String)
    results += applyDnd(config["dndMode"] as? String)

    results += connectivityResult("wifi", config["wifiAction"] as? String)
    results += connectivityResult("bluetooth", config["bluetoothAction"] as? String)
    results += connectivityResult("mobileData", config["mobileDataAction"] as? String)
    results += connectivityResult("airplaneMode", config["airplaneModeAction"] as? String)

    results += applyBrightness(
      config["brightnessAction"] as? String,
      (config["brightnessValue"] as? Number)?.toInt()
    )
    results += applyScreenTimeout((config["screenTimeoutSeconds"] as? Number)?.toInt())

    return results
  }

  /** Put back only the values that were actually captured. */
  fun restoreState(snapshot: Map<String, Any?>, keys: List<String>): List<Map<String, Any?>> {
    val results = mutableListOf<Map<String, Any?>>()

    for (key in keys) {
      when (key) {
        "ringerMode" -> (snapshot["ringerMode"] as? String)?.let {
          results += applyRingerMode(it)
        }
        "ringVolume" -> results += applyVolume(key, AudioManager.STREAM_RING, snapshot[key])
        "notificationVolume" -> results += applyVolume(key, AudioManager.STREAM_NOTIFICATION, snapshot[key])
        "mediaVolume" -> results += applyVolume(key, AudioManager.STREAM_MUSIC, snapshot[key])
        "alarmVolume" -> results += applyVolume(key, AudioManager.STREAM_ALARM, snapshot[key])
        "systemVolume" -> results += applyVolume(key, AudioManager.STREAM_SYSTEM, snapshot[key])
        "dnd" -> (snapshot["dndMode"] as? String)?.let { results += applyDnd(it) }
        "brightness" -> (snapshot["brightness"] as? Number)?.let {
          results += applyBrightness("manual", it.toInt())
        }
        "screenTimeout" -> (snapshot["screenTimeoutSeconds"] as? Number)?.let {
          results += applyScreenTimeout(it.toInt())
        }
      }
    }

    return results
  }

  private fun applyRingerMode(mode: String?): Map<String, Any?> {
    if (mode == null || mode == UNCHANGED) return result("ringerMode", SKIPPED, null)

    val target = when (mode) {
      "normal" -> AudioManager.RINGER_MODE_NORMAL
      "vibrate" -> AudioManager.RINGER_MODE_VIBRATE
      "silent" -> AudioManager.RINGER_MODE_SILENT
      else -> return result("ringerMode", FAILED, "Unrecognised ringer mode.")
    }

    // Only silent trips the policy check; normal and vibrate are always fine.
    if (target == AudioManager.RINGER_MODE_SILENT && !capabilities.hasDndAccess()) {
      return result("ringerMode", PERMISSION_REQUIRED, "Do Not Disturb access is needed to silence the ringer.")
    }

    return try {
      audioManager.ringerMode = target
      result("ringerMode", APPLIED, null)
    } catch (e: SecurityException) {
      result("ringerMode", PERMISSION_REQUIRED, "Android blocked the ringer change.")
    }
  }

  private fun applyVolume(key: String, stream: Int, raw: Any?): Map<String, Any?> {
    val percent = (raw as? Number)?.toInt() ?: return result(key, SKIPPED, null)

    val policedStream = stream == AudioManager.STREAM_RING ||
      stream == AudioManager.STREAM_NOTIFICATION ||
      stream == AudioManager.STREAM_SYSTEM

    // Zeroing a policed stream is a DND policy change on M+.
    if (policedStream && percent == 0 && !capabilities.hasDndAccess()) {
      return result(key, PERMISSION_REQUIRED, "Do Not Disturb access is needed to silence this.")
    }

    return try {
      val am = audioManager
      val max = am.getStreamMaxVolume(stream)
      val value = (percent.coerceIn(0, 100) / 100f * max).roundToInt().coerceIn(0, max)
      am.setStreamVolume(stream, value, 0)
      result(key, APPLIED, null)
    } catch (e: SecurityException) {
      result(key, PERMISSION_REQUIRED, "Android blocked this volume change.")
    }
  }

  private fun applyVibration(mode: String?): Map<String, Any?> {
    if (mode == null || mode == UNCHANGED) return result("vibration", SKIPPED, null)

    if (!capabilities.canWriteSystemSettings()) {
      return result("vibration", PERMISSION_REQUIRED, "Needs permission to modify system settings.")
    }

    return try {
      Settings.System.putInt(
        context.contentResolver,
        "vibrate_when_ringing",
        if (mode == "enabled") 1 else 0
      )
      result("vibration", APPLIED, null)
    } catch (e: Exception) {
      result("vibration", UNSUPPORTED, "This device doesn't expose a vibration switch.")
    }
  }

  private fun applyDnd(mode: String?): Map<String, Any?> {
    if (mode == null || mode == UNCHANGED) return result("dnd", SKIPPED, null)

    if (!capabilities.hasDndAccess()) {
      return result("dnd", PERMISSION_REQUIRED, "Do Not Disturb access is needed.")
    }

    val filter = when (mode) {
      "off" -> NotificationManager.INTERRUPTION_FILTER_ALL
      "priority" -> NotificationManager.INTERRUPTION_FILTER_PRIORITY
      "alarms" -> NotificationManager.INTERRUPTION_FILTER_ALARMS
      "silence" -> NotificationManager.INTERRUPTION_FILTER_NONE
      else -> return result("dnd", FAILED, "Unrecognised Do Not Disturb mode.")
    }

    return try {
      notificationManager.setInterruptionFilter(filter)
      result("dnd", APPLIED, null)
    } catch (e: SecurityException) {
      result("dnd", PERMISSION_REQUIRED, "Android blocked the Do Not Disturb change.")
    }
  }

  /**
   * Wi-Fi, Bluetooth, mobile data and airplane mode are all closed to normal
   * apps on current Android. The intention is kept and reported as needing the
   * user, never faked as applied.
   */
  private fun connectivityResult(key: String, action: String?): Map<String, Any?> {
    if (action == null || action == UNCHANGED) return result(key, SKIPPED, null)

    val capability = capabilities.describe()[key]
    val status = capability?.get("status")
    val detail = capability?.get("detail")

    return when (status) {
      SystemCapabilityManager.AVAILABLE_DIRECTLY ->
        // Older OS versions that still allow it are handled by the launcher
        // flow rather than a silent toggle, so the user stays in the loop.
        result(key, MANUAL_ACTION_REQUIRED, detail)
      SystemCapabilityManager.UNSUPPORTED -> result(key, UNSUPPORTED, detail)
      else -> result(key, MANUAL_ACTION_REQUIRED, detail)
    }
  }

  private fun applyBrightness(action: String?, value: Int?): Map<String, Any?> {
    if (action == null || action == UNCHANGED) return result("brightness", SKIPPED, null)

    if (!capabilities.canWriteSystemSettings()) {
      return result("brightness", PERMISSION_REQUIRED, "Needs permission to modify system settings.")
    }

    return try {
      if (action == "auto") {
        Settings.System.putInt(
          context.contentResolver,
          Settings.System.SCREEN_BRIGHTNESS_MODE,
          Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
        )
        return result("brightness", APPLIED, null)
      }

      if (value == null) return result("brightness", SKIPPED, null)

      Settings.System.putInt(
        context.contentResolver,
        Settings.System.SCREEN_BRIGHTNESS_MODE,
        Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
      )
      Settings.System.putInt(
        context.contentResolver,
        Settings.System.SCREEN_BRIGHTNESS,
        (value.coerceIn(0, 100) / 100f * 255).roundToInt().coerceIn(1, 255)
      )
      result("brightness", APPLIED, null)
    } catch (e: Exception) {
      result("brightness", FAILED, "Couldn't change brightness on this device.")
    }
  }

  private fun applyScreenTimeout(seconds: Int?): Map<String, Any?> {
    if (seconds == null) return result("screenTimeout", SKIPPED, null)

    if (!capabilities.canWriteSystemSettings()) {
      return result("screenTimeout", PERMISSION_REQUIRED, "Needs permission to modify system settings.")
    }

    return try {
      Settings.System.putInt(
        context.contentResolver,
        Settings.System.SCREEN_OFF_TIMEOUT,
        seconds.coerceAtLeast(15) * 1000
      )
      result("screenTimeout", APPLIED, null)
    } catch (e: Exception) {
      result("screenTimeout", FAILED, "Couldn't change the screen timeout.")
    }
  }

  private fun percentOf(stream: Int): Int? = try {
    val am = audioManager
    val max = am.getStreamMaxVolume(stream)
    if (max <= 0) null else (am.getStreamVolume(stream) / max.toFloat() * 100).roundToInt()
  } catch (e: Exception) {
    null
  }

  private fun readDndMode(): String = when (notificationManager.currentInterruptionFilter) {
    NotificationManager.INTERRUPTION_FILTER_PRIORITY -> "priority"
    NotificationManager.INTERRUPTION_FILTER_ALARMS -> "alarms"
    NotificationManager.INTERRUPTION_FILTER_NONE -> "silence"
    else -> "off"
  }

  private fun readBrightness(): Int? = try {
    val raw = Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS)
    (raw / 255f * 100).roundToInt()
  } catch (e: Exception) {
    null
  }

  private fun readBrightnessAuto(): Boolean? = try {
    Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE) ==
      Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
  } catch (e: Exception) {
    null
  }

  private fun readScreenTimeout(): Int? = try {
    Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_OFF_TIMEOUT) / 1000
  } catch (e: Exception) {
    null
  }

  private fun result(key: String, outcome: String, message: String?): Map<String, Any?> =
    mapOf("key" to key, "outcome" to outcome, "message" to message)
}
