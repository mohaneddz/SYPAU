package expo.modules.sypausystem

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps zone monitoring alive when the UI isn't.
 *
 * This runs only while it's earning its keep. Platform geofencing already
 * wakes us on transitions without a service, so this starts for the cases
 * geofencing alone can't cover — high-accuracy tracking, and boundaries tight
 * enough that the platform's own responsiveness window is too coarse.
 */
class LocationForegroundService : Service() {

  companion object {
    const val CHANNEL_ID = "sypauMonitoring"
    const val NOTIFICATION_ID = 4201

    const val ACTION_START = "com.mohaned.sypau.MONITOR_START"
    const val ACTION_STOP = "com.mohaned.sypau.MONITOR_STOP"
    const val EXTRA_ZONE_NAME = "zoneName"

    @Volatile
    var isRunning: Boolean = false
      private set

    @Volatile
    var startedAt: Long? = null
      private set

    fun start(context: Context, zoneName: String?) {
      val intent = Intent(context, LocationForegroundService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_ZONE_NAME, zoneName)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.startService(
        Intent(context, LocationForegroundService::class.java).setAction(ACTION_STOP)
      )
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopForegroundCompat()
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        val zoneName = intent?.getStringExtra(EXTRA_ZONE_NAME)
        startForegroundCompat(zoneName)
        isRunning = true
        if (startedAt == null) startedAt = System.currentTimeMillis()
      }
    }

    // Restarted by the OS if it reclaims us, so monitoring resumes on its own.
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    startedAt = null
    SypauSystemModule.active?.emitServiceHealth(false)
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Swiping the app away must not silently end monitoring; the user turns
    // it off in Settings, not by clearing their recents list.
    super.onTaskRemoved(rootIntent)
  }

  private fun startForegroundCompat(zoneName: String?) {
    createChannel()

    val notification = buildNotification(zoneName)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun buildNotification(zoneName: String?): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launch?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val text = if (zoneName != null) "Silence is active in $zoneName." else "Watching your zones."

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("SYPAU")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .also { if (contentIntent != null) it.setContentIntent(contentIntent) }
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "Zone monitoring",
        // Low: this notification is a permanent requirement of the foreground
        // service, not something worth interrupting anyone for.
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Shown while SYPAU is watching your zones."
        setShowBadge(false)
      }
    )
  }
}
