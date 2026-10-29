package ph.eligtas.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
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
        AlertStore.save(c,alert);
        AlarmSettings.channels(c);
        String channel = AlertPolicy.urgent(priority) ? AlarmSettings.EMERGENCY : AlarmSettings.COMMUNITY;
        if (!AlarmSettings.notificationsAllowed(c, channel)) {
            if (EmergencyAlarmService.activeId.isEmpty()) AlarmSettings.playback(c,id,"blocked","Alert received, but Android notifications are blocked. Allow notifications in app settings.");
            return false;
        }
        boolean playing = false;
        if (canStartAlarm && AlertPolicy.urgent(priority) && prefs.getBoolean("enabled", false) && AlarmSettings.notificationsAllowed(c,AlarmSettings.PLAYBACK) && AlertPolicy.mayInterrupt(priority,EmergencyAlarmService.activePriority)) {
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
        NotificationCompat.Builder notification = notification(c, alert, playing ? AlarmSettings.PLAYBACK : channel).setAutoCancel(!playing).setOngoing(playing);
        // A second notification sound can steal audio focus from the alarm service.
        // Use channel audio only when the alarm could not be started.
        // The playback channel has no sound but retains high visual importance.
        // setSilent(true) groups alerts silently and can also suppress heads-up UI.
        notification.setSilent(!playing && (!EmergencyAlarmService.activeId.isEmpty() || !prefs.getBoolean("enabled", false)));
        c.getSystemService(NotificationManager.class).notify(notificationId(id), notification.build());
        MainActivity.refreshInbox();
        return playing;
    }
    static void fallback(Context c, JSONObject alert) {
        if (!alert.optBoolean("test") && AlarmSettings.prefs(c).getBoolean("enabled",false) && AlarmSettings.notificationsAllowed(c,AlarmSettings.EMERGENCY)) {
            // The original notification was silent while playback was starting.
            // Allow this replacement to sound if the service could not play.
            c.getSystemService(NotificationManager.class).notify(notificationId(alert.optString("id")),notification(c,alert,AlarmSettings.EMERGENCY).setAutoCancel(true).setOnlyAlertOnce(false).build());
        }
    }
    static NotificationCompat.Builder notification(Context c, JSONObject alert, String channel) {
        String id = alert.optString("id");
        Intent open = new Intent(c, AlertMessageActivity.class).setAction("READ_ALERT").setData(Uri.parse("tanoviq://alert/"+id)).putExtra("alertId",id);
        PendingIntent content = PendingIntent.getActivity(c, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(c, AlertActionReceiver.class).setAction("SILENCE_ALERT").setData(Uri.parse("tanoviq://silence/"+id)).putExtra("alertId",id);
        PendingIntent silence = PendingIntent.getBroadcast(c, 2, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(c, channel).setSmallIcon(ph.eligtas.app.R.drawable.ic_notification)
            .setColor(0xff21b8a6).setContentTitle("Mobile Phone · " + alert.optString("priority", "normal") + " alert")
            .setContentText(alert.optString("body")).setStyle(new NotificationCompat.BigTextStyle().bigText(alert.optString("body")))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setCategory(AlertPolicy.urgent(alert.optString("priority")) ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(content).setOnlyAlertOnce(true);
        if(AlertPolicy.urgent(alert.optString("priority")) && !alert.optBoolean("silenced")) builder.addAction(0,"Silence alarm",silence);
        builder.addAction(0,"Read message",content);
        if(alert.optBoolean("silenced")) builder.setSubText("Alarm silenced · message saved");
        return builder;
    }
    static int notificationId(String id) { int value=id.hashCode(); return value==0?1042:value; }
    static void showQuiet(Context c,JSONObject alert) {
        if (!alert.optString("userId").equals(AlarmSettings.prefs(c).getString("user",""))) return;
        String channel=AlertPolicy.urgent(alert.optString("priority"))?AlarmSettings.EMERGENCY:AlarmSettings.COMMUNITY;
        if(AlarmSettings.notificationsAllowed(c,channel)) c.getSystemService(NotificationManager.class).notify(notificationId(alert.optString("id")),notification(c,alert,channel).setSilent(true).setAutoCancel(true).build());
    }
    static void updateText(Context c,JSONObject alert) {
        if (!alert.optString("userId").equals(AlarmSettings.prefs(c).getString("user",""))) return;
        if(!alert.optString("id").equals(EmergencyAlarmService.activeId)) { showQuiet(c,alert); return; }
        if(AlarmSettings.notificationsAllowed(c,AlarmSettings.PLAYBACK)) c.getSystemService(NotificationManager.class).notify(notificationId(alert.optString("id")),notification(c,alert,AlarmSettings.PLAYBACK).setOngoing(true).build());
    }
}
