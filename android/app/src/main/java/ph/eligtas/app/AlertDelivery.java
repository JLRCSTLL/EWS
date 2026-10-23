package ph.eligtas.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationCompat;
import java.util.LinkedHashSet;
import java.util.Arrays;
import org.json.JSONObject;

final class AlertDelivery {
    static synchronized boolean deliver(Context c, JSONObject alert, boolean canStartAlarm) {
        SharedPreferences prefs = AlarmSettings.prefs(c);
        String id = alert.optString("id"), user = alert.optString("userId"), priority = alert.optString("priority");
        LinkedHashSet<String> seen = new LinkedHashSet<>(Arrays.asList(prefs.getString("seen", "").split(",")));
        if (!AlertPolicy.eligible(id, user, prefs.getString("user", ""), alert.optString("createdAt"), System.currentTimeMillis(), seen)) return id.equals(EmergencyAlarmService.activeId);
        seen.add(id); while (seen.size() > 200) seen.remove(seen.iterator().next());
        prefs.edit().putString("seen", String.join(",", seen)).apply();
        AlarmSettings.channels(c);
        String channel = AlertPolicy.urgent(priority) ? AlarmSettings.EMERGENCY : AlarmSettings.COMMUNITY;
        if (!AlarmSettings.notificationsAllowed(c, channel)) {
            if (EmergencyAlarmService.activeId.isEmpty()) AlarmSettings.playback(c,id,"blocked","Alert received, but Android notifications are blocked. Allow notifications in app settings.");
            return false;
        }
        boolean playing = false;
        if (canStartAlarm && AlertPolicy.urgent(priority) && prefs.getBoolean("enabled", false) && AlertPolicy.mayInterrupt(priority,EmergencyAlarmService.activePriority)) {
            try {
                AlarmSettings.playback(c,id,"starting","Emergency alert received. Starting the alarm…");
                ContextCompat.startForegroundService(c, new Intent(c, EmergencyAlarmService.class).putExtra("alert", alert.toString()));
                playing = true;
            } catch (RuntimeException restricted) { /* Fall back to a standard audible notification. */ }
        }
        if (!playing && EmergencyAlarmService.activeId.isEmpty()) {
            String reason = !AlertPolicy.urgent(priority) ? "Announcement received. Normal priority does not request an emergency alarm."
                : !prefs.getBoolean("enabled",false) ? "Emergency alert received. Enable full-volume alerts on this phone to sound the alarm."
                : "Alert received, but Android did not allow background alarm playback. Check the app's background settings.";
            AlarmSettings.playback(c,id,AlertPolicy.urgent(priority) ? "blocked" : "announcement",reason);
        }
        NotificationCompat.Builder notification = notification(c, alert, channel).setAutoCancel(true);
        // A second notification sound can steal audio focus from the alarm service.
        // Use channel audio only when the alarm could not be started.
        notification.setSilent(playing || !EmergencyAlarmService.activeId.isEmpty() || !prefs.getBoolean("enabled", false));
        c.getSystemService(NotificationManager.class).notify(id.hashCode(), notification.build());
        MainActivity.refreshInbox();
        return playing;
    }
    static void fallback(Context c, JSONObject alert) {
        if (!alert.optBoolean("test") && AlarmSettings.prefs(c).getBoolean("enabled",false) && AlarmSettings.notificationsAllowed(c,AlarmSettings.EMERGENCY)) {
            // The original notification was silent while playback was starting.
            // Allow this replacement to sound if the service could not play.
            c.getSystemService(NotificationManager.class).notify(alert.optString("id").hashCode(),notification(c,alert,AlarmSettings.EMERGENCY).setAutoCancel(true).setOnlyAlertOnce(false).build());
        }
    }
    static NotificationCompat.Builder notification(Context c, JSONObject alert, String channel) {
        Intent open = new Intent(c, MainActivity.class).setAction("OPEN_ALERT").putExtra("alertId", alert.optString("id"));
        PendingIntent content = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(c, channel).setSmallIcon(ph.eligtas.app.R.drawable.ic_notification)
            .setColor(0xff164de5).setContentTitle("E-Ligtas · " + alert.optString("priority", "normal") + " alert")
            .setContentText(alert.optString("body")).setStyle(new NotificationCompat.BigTextStyle().bigText(alert.optString("body")))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setCategory(AlertPolicy.urgent(alert.optString("priority")) ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(content).setOnlyAlertOnce(true);
    }
}
