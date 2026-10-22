package ph.eligtas.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import org.json.JSONObject;

final class AlarmSettings {
    static final String EMERGENCY = "emergency_alerts_v1", COMMUNITY = "community_alerts_v1", PLAYBACK = "active_alarm_v1";
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("eligtas_alarm", Context.MODE_PRIVATE); }
    static void channels(Context c) {
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        NotificationChannel urgent = new NotificationChannel(EMERGENCY, "Emergency alerts", NotificationManager.IMPORTANCE_HIGH);
        urgent.setDescription("High and critical command-center alerts. Allow during Do Not Disturb if desired.");
        urgent.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
        urgent.enableVibration(true); urgent.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        if (manager.isNotificationPolicyAccessGranted()) urgent.setBypassDnd(true);
        manager.createNotificationChannel(urgent);
        NotificationChannel normal = new NotificationChannel(COMMUNITY, "Community announcements", NotificationManager.IMPORTANCE_DEFAULT);
        normal.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE); manager.createNotificationChannel(normal);
        NotificationChannel playing = new NotificationChannel(PLAYBACK, "Alarm controls", NotificationManager.IMPORTANCE_LOW);
        playing.setSound(null, null); playing.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE); manager.createNotificationChannel(playing);
    }
    static boolean notificationsAllowed(Context c, String channel) {
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        NotificationChannel setting = manager.getNotificationChannel(channel);
        return manager.areNotificationsEnabled() && (setting == null || setting.getImportance() != NotificationManager.IMPORTANCE_NONE);
    }
    static JSONObject status(Context c) throws Exception {
        channels(c);
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        AudioManager audio = c.getSystemService(AudioManager.class);
        return new JSONObject().put("enabled", prefs(c).getBoolean("enabled", false)).put("maxVolume", prefs(c).getBoolean("max_volume", false))
            .put("pushConfigured", BuildConfig.PUSH_CONFIGURED).put("notifications", notificationsAllowed(c, EMERGENCY))
            .put("dndAccess", manager.isNotificationPolicyAccessGranted()).put("dndBypass", manager.getNotificationChannel(EMERGENCY).canBypassDnd())
            .put("alarmVolume", audio.getStreamVolume(AudioManager.STREAM_ALARM)).put("alarmMax", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));
    }
    static void restoreVolume(Context c) {
        SharedPreferences p = prefs(c); int previous = p.getInt("previous_volume", -1), applied = p.getInt("applied_volume", -1);
        if (previous < 0) return;
        AudioManager audio = c.getSystemService(AudioManager.class);
        try { if (audio.getStreamVolume(AudioManager.STREAM_ALARM) == applied) audio.setStreamVolume(AudioManager.STREAM_ALARM, previous, 0); }
        catch (SecurityException restricted) { /* Device policy has final control. */ }
        p.edit().remove("previous_volume").remove("applied_volume").apply();
    }
}
