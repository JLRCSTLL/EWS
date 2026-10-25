package ph.eligtas.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.os.Build;
import org.json.JSONObject;

final class AlarmSettings {
    static final String EMERGENCY = "emergency_alerts_v1", COMMUNITY = "community_alerts_v1", PLAYBACK = "active_alarm_controls_v2";
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
        // High visual priority, no competing notification audio: the service plays
        // the alarm. A new channel ID is required; Android channel importance is immutable.
        NotificationChannel playing = new NotificationChannel(PLAYBACK, "Active emergency alerts", NotificationManager.IMPORTANCE_HIGH);
        playing.setDescription("Shows emergency message text and Silence alarm together during playback.");
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
        Boolean allowed = alarmsAllowed(c);
        return new JSONObject().put("enabled", prefs(c).getBoolean("enabled", false)).put("maxVolume", prefs(c).getBoolean("max_volume", false))
            .put("pushConfigured", BuildConfig.PUSH_CONFIGURED).put("notifications", notificationsAllowed(c, EMERGENCY) && notificationsAllowed(c, PLAYBACK))
            .put("dndAccess", manager.isNotificationPolicyAccessGranted()).put("dndBypass", manager.getNotificationChannel(EMERGENCY).canBypassDnd())
            .put("alarmVolume", audio.getStreamVolume(AudioManager.STREAM_ALARM)).put("alarmMax", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM))
            .put("appVersion", BuildConfig.VERSION_NAME).put("enhancedAlarms", true).put("volumeFixed", audio.isVolumeFixed())
            .put("managedAlarms",true).put("backgroundLocation",Build.VERSION.SDK_INT < 29 || c.checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED)
            .put("dndMode", dndMode(manager)).put("dndAlarmsAllowed", allowed == null ? JSONObject.NULL : allowed)
            .put("alarmState", prefs(c).getString("alarm_state","idle")).put("alarmMessage", prefs(c).getString("alarm_message",""))
            .put("alarmId", prefs(c).getString("alarm_id",""));
    }
    private static String dndMode(NotificationManager manager) {
        switch (manager.getCurrentInterruptionFilter()) {
            case NotificationManager.INTERRUPTION_FILTER_ALL: return "off";
            case NotificationManager.INTERRUPTION_FILTER_ALARMS: return "alarms";
            case NotificationManager.INTERRUPTION_FILTER_PRIORITY: return "priority";
            case NotificationManager.INTERRUPTION_FILTER_NONE: return "total-silence";
            default: return "unknown";
        }
    }
    static Boolean alarmsAllowed(Context c) {
        NotificationManager manager = c.getSystemService(NotificationManager.class);
        String mode = dndMode(manager);
        if (mode.equals("off") || mode.equals("alarms")) return true;
        if (mode.equals("total-silence")) return false;
        if (!mode.equals("priority")) return null;
        // Android 8 does not expose the separate alarm-category policy bit.
        if (Build.VERSION.SDK_INT < 28) return null;
        try {
            NotificationManager.Policy policy = Build.VERSION.SDK_INT >= 30 ? manager.getConsolidatedNotificationPolicy() : manager.getNotificationPolicy();
            return policy == null ? null : (policy.priorityCategories & NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS) != 0;
        } catch (SecurityException unavailable) { return null; }
    }
    static void playback(Context c, String id, String state, String message) {
        prefs(c).edit().putString("alarm_id",id).putString("alarm_state",state).putString("alarm_message",message).apply();
        MainActivity.refreshAlarmStatus();
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
