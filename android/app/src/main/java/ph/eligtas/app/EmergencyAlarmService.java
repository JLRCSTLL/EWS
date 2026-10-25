package ph.eligtas.app;

import android.app.Service;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import org.json.JSONObject;
import androidx.core.app.NotificationCompat;

public final class EmergencyAlarmService extends Service {
    static volatile String activeId = "";
    static volatile String activePriority = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private AudioFocusRequest focus;
    private JSONObject currentAlert;
    private boolean pausedForFocus, ducked, failureReported;
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        try {
            JSONObject alert = new JSONObject(intent.getStringExtra("alert"));
            if (!AlarmSettings.prefs(this).getBoolean("enabled", false) || !alert.optString("userId").equals(AlarmSettings.prefs(this).getString("user", ""))) { stopSelf(); return START_NOT_STICKY; }
            if (AlertStore.silenced(this,alert.optString("id"))) { if(activeId.isEmpty()) stopSelf(); return START_NOT_STICKY; }
            if (!AlertPolicy.mayInterrupt(alert.optString("priority"),activePriority)) return START_NOT_STICKY;
            if (currentAlert != null && !activeId.equals(alert.optString("id"))) {
                stopForeground(STOP_FOREGROUND_DETACH); AlertDelivery.showQuiet(this,currentAlert);
            }
            releaseAudio(); currentAlert = alert; AlarmSettings.channels(this); activeId = alert.optString("id"); activePriority = alert.optString("priority");
            // Same notification as the received message: text and controls stay together.
            Notification notification = AlertDelivery.notification(this, alert, AlarmSettings.PLAYBACK).setOngoing(true).build();
            int notificationId=AlertDelivery.notificationId(activeId);
            if (Build.VERSION.SDK_INT >= 29) startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(notificationId, notification);
            AudioManager audio = getSystemService(AudioManager.class);
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes).setOnAudioFocusChangeListener(this::focusChanged,handler).build();
            if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { failed("Android did not grant audio focus. End an active call or other audio session, then test again."); return START_NOT_STICKY; }
            boolean urgent = AlertPolicy.urgent(alert.optString("priority"));
            if (urgent && AlarmSettings.prefs(this).getBoolean("max_volume", false) && !audio.isVolumeFixed()) {
                int previous = audio.getStreamVolume(AudioManager.STREAM_ALARM), max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                // Persist before changing volume so a later launch can recover after process termination.
                AlarmSettings.prefs(this).edit().putInt("previous_volume", previous).putInt("applied_volume", max).commit();
                try { audio.setStreamVolume(AudioManager.STREAM_ALARM, max, 0); } catch (SecurityException restricted) { AlarmSettings.restoreVolume(this); }
            }
            player = new MediaPlayer(); player.setAudioAttributes(attributes);
            player.setOnErrorListener((media,what,extra) -> { failed("Android could not play the alarm sound. Reopen the app and run Test alarm."); return true; });
            try (android.content.res.AssetFileDescriptor descriptor = getResources().openRawResourceFd(R.raw.alert_tone)) {
                player.setDataSource(descriptor.getFileDescriptor(), descriptor.getStartOffset(), descriptor.getLength());
            }
            player.setLooping(true); player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK); player.prepare();
            player.setVolume(0.15f, 0.15f); player.start();
            reportPlaying();
            for (int i = 1; i <= 10; i++) { final float volume = 0.15f + 0.085f * i; handler.postDelayed(() -> { if (player != null && !pausedForFocus && !ducked) player.setVolume(volume, volume); }, i * 150L); }
            Vibrator vibrator = getSystemService(Vibrator.class);
            if (vibrator != null && vibrator.hasVibrator()) vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,300,200,300,700}, 0));
            handler.postDelayed(this::stopSelf, alert.optBoolean("test") ? 4000 : urgent ? 30000 : 8000);
        } catch (Exception unavailable) { failed("Android could not start the alarm. Check notification, sound, and background permissions in Account."); }
        return START_NOT_STICKY;
    }
    private void reportPlaying() {
        if (Boolean.FALSE.equals(AlarmSettings.alarmsAllowed(this))) AlarmSettings.playback(this,activeId,"blocked","Do Not Disturb currently blocks alarm audio. Allow alarms in Android Sound / Do Not Disturb settings.");
        else if (getSystemService(AudioManager.class).getStreamVolume(AudioManager.STREAM_ALARM) == 0) AlarmSettings.playback(this,activeId,"blocked","Alarm volume is zero. Enable full-volume alerts, then test again.");
        else AlarmSettings.playback(this,activeId,"playing","Alarm audio started. It stops automatically or when you tap Silence alarm.");
    }
    private void focusChanged(int change) {
        if (player == null) return;
        if (change == AudioManager.AUDIOFOCUS_LOSS) { failed("Another audio session interrupted the alarm."); return; }
        if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            player.pause(); pausedForFocus = true;
            AlarmSettings.playback(this,activeId,"paused","Alarm paused while another audio session has priority.");
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            // A brief notification must not terminate an emergency alarm.
            ducked = true; player.setVolume(0.25f,0.25f);
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            player.setVolume(1f,1f); if (pausedForFocus) player.start(); pausedForFocus = false; ducked = false; reportPlaying();
        }
    }
    private void failed(String message) {
        if (failureReported) return;
        failureReported = true;
        AlarmSettings.playback(this,activeId,"blocked",message);
        if (currentAlert != null) AlertDelivery.fallback(this,currentAlert);
        stopSelf();
    }
    private void releaseAudio() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) { try { player.stop(); } catch (IllegalStateException ignored) {} player.release(); player = null; }
        if (focus != null) { getSystemService(AudioManager.class).abandonAudioFocusRequest(focus); focus = null; }
        Vibrator vibrator = getSystemService(Vibrator.class); if (vibrator != null) vibrator.cancel();
        AlarmSettings.restoreVolume(this); activeId = ""; activePriority = ""; pausedForFocus = false; ducked = false; failureReported = false;
    }
    @Override public void onDestroy() {
        String id = activeId;
        boolean failed=failureReported;
        JSONObject cached=AlertStore.get(this,id);
        stopForeground(STOP_FOREGROUND_DETACH);
        if(!failed && cached!=null) AlertDelivery.showQuiet(this,cached);
        releaseAudio();
        if (!id.isEmpty() && id.equals(AlarmSettings.prefs(this).getString("alarm_id","")) && !AlarmSettings.prefs(this).getString("alarm_state","").equals("blocked"))
            AlarmSettings.playback(this,id,"finished","Alarm stopped. Your previous alarm volume was restored.");
        super.onDestroy();
    }
}
