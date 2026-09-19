package expo.modules.sypausystem

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices

/**
 * Registers zones with the platform geofencing service.
 *
 * Play Services geofencing is used in preference to polling GPS: the OS
 * batches these across every app on the device and wakes us only on a real
 * transition, which is the difference between a background feature that costs
 * a few percent of battery a day and one users uninstall.
 *
 * A polygon zone is registered as its bounding circle. The platform only
 * understands circles, so the exact point-in-polygon test runs in JS once the
 * transition wakes us — the circle is a cheap pre-filter, not the boundary.
 */
class GeofenceManager(private val context: Context) {

  private val client: GeofencingClient by lazy { LocationServices.getGeofencingClient(context) }
  private val permissions = PermissionManager(context)

  private val pendingIntent: PendingIntent by lazy {
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, GeofenceReceiver::class.java).setAction(GeofenceReceiver.ACTION_TRANSITION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )
  }

  @Volatile
  private var registeredIds: List<String> = emptyList()

  fun registeredCount(): Int = registeredIds.size

  /**
   * Replace the registered set with [zones]. Each entry needs id, latitude,
   * longitude and radiusMeters.
   */
  @SuppressLint("MissingPermission")
  fun register(zones: List<Map<String, Any?>>, onResult: (Boolean, String?) -> Unit) {
    if (!permissions.hasBackgroundLocation()) {
      onResult(false, "Background location permission is needed to watch zones.")
      return
    }

    val fences = zones.mapNotNull { zone ->
      val id = zone["id"] as? String ?: return@mapNotNull null
      val lat = (zone["latitude"] as? Number)?.toDouble() ?: return@mapNotNull null
      val lng = (zone["longitude"] as? Number)?.toDouble() ?: return@mapNotNull null
      val radius = (zone["radiusMeters"] as? Number)?.toFloat() ?: return@mapNotNull null

      Geofence.Builder()
        .setRequestId(id)
        // Play Services rejects very small radii on some devices.
        .setCircularRegion(lat, lng, radius.coerceAtLeast(50f))
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
        // Smooths GPS jitter at the boundary before we're woken at all.
        .setLoiteringDelay(30_000)
        .setNotificationResponsiveness(30_000)
        .build()
    }

    client.removeGeofences(pendingIntent).addOnCompleteListener {
      if (fences.isEmpty()) {
        registeredIds = emptyList()
        onResult(true, null)
        return@addOnCompleteListener
      }

      val request = GeofencingRequest.Builder()
        // Fires immediately if we're already inside, so state is correct on
        // first run rather than waiting for the user to cross a line.
        .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
        .addGeofences(fences)
        .build()

      try {
        client.addGeofences(request, pendingIntent)
          .addOnSuccessListener {
            registeredIds = fences.map { fence -> fence.requestId }
            onResult(true, null)
          }
          .addOnFailureListener { error ->
            registeredIds = emptyList()
            onResult(false, error.message ?: "Couldn't register zones with Android.")
          }
      } catch (e: SecurityException) {
        onResult(false, "Background location permission is needed to watch zones.")
      }
    }
  }

  fun clear(onResult: (Boolean) -> Unit) {
    client.removeGeofences(pendingIntent)
      .addOnCompleteListener { task ->
        registeredIds = emptyList()
        onResult(task.isSuccessful)
      }
  }
}
