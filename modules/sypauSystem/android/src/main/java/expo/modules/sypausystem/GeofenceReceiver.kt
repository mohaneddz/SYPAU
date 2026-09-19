package expo.modules.sypausystem

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

/**
 * Wakes on a platform geofence transition and hands it to the module.
 *
 * Transitions arrive here whether or not the UI is running, which is the whole
 * point of registering with the OS. When JS is alive the event is forwarded
 * straight to it; when it isn't, the transition is queued so the engine can
 * catch up on next launch rather than losing it.
 */
class GeofenceReceiver : BroadcastReceiver() {

  companion object {
    const val ACTION_TRANSITION = "com.mohaned.sypau.GEOFENCE_TRANSITION"

    /** Transitions that arrived while no JS runtime was listening. */
    private val pending = mutableListOf<Map<String, Any?>>()

    @Synchronized
    fun drainPending(): List<Map<String, Any?>> {
      val copy = pending.toList()
      pending.clear()
      return copy
    }

    @Synchronized
    private fun queue(event: Map<String, Any?>) {
      // Bounded so a long offline stretch can't grow without limit; the
      // engine reconciles against real position on resume anyway.
      if (pending.size >= 100) pending.removeAt(0)
      pending.add(event)
    }

    @Synchronized
    fun emit(event: Map<String, Any?>) {
      val module = SypauSystemModule.active
      if (module != null) {
        module.emitGeofenceEvent(event)
      } else {
        queue(event)
      }
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_TRANSITION) return

    val event = GeofencingEvent.fromIntent(intent) ?: return

    if (event.hasError()) {
      emit(
        mapOf(
          "type" to "geofenceError",
          "timestamp" to System.currentTimeMillis(),
          "message" to "Android reported a geofencing error (${event.errorCode})."
        )
      )
      return
    }

    val type = when (event.geofenceTransition) {
      Geofence.GEOFENCE_TRANSITION_ENTER -> "geofenceEnter"
      Geofence.GEOFENCE_TRANSITION_EXIT -> "geofenceExit"
      else -> return
    }

    val zoneIds = event.triggeringGeofences?.map { it.requestId } ?: emptyList()
    if (zoneIds.isEmpty()) return

    emit(
      mapOf(
        "type" to type,
        "timestamp" to System.currentTimeMillis(),
        "zoneIds" to zoneIds,
        "latitude" to event.triggeringLocation?.latitude,
        "longitude" to event.triggeringLocation?.longitude,
        "accuracy" to event.triggeringLocation?.accuracy
      )
    )
  }
}
