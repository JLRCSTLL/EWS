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
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        try {
            JSONObject alert = new JSONObject(intent.getStringExtra("alert"));
            if (!AlarmSettings.prefs(this).getBoolean("enabled", false) || !alert.optString("userId").equals(AlarmSettings.prefs(this).getString("user", ""))) { stopSelf(); return START_NOT_STICKY; }
            if (!AlertPolicy.mayInterrupt(alert.optString("priority"),activePriority)) return START_NOT_STICKY;
            releaseAudio(); AlarmSettings.channels(this); activeId = alert.optString("id"); activePriority = alert.optString("priority");
            Intent stop = new Intent(this, EmergencyAlarmService.class).setAction("STOP");
            PendingIntent silence = PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = AlertDelivery.notification(this, alert, AlarmSettings.PLAYBACK).setOngoing(true).setSilent(true)
                .addAction(new NotificationCompat.Action.Builder(0, "Silence alarm", silence).build()).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(1042, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(1042, notification);
            AudioManager audio = getSystemService(AudioManager.class);
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes).setOnAudioFocusChangeListener(change -> { if (change < 0) stopSelf(); }).build();
            if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { stopSelf(); return START_NOT_STICKY; }
            boolean urgent = AlertPolicy.urgent(alert.optString("priority"));
            if (urgent && AlarmSettings.prefs(this).getBoolean("max_volume", false) && !audio.isVolumeFixed()) {
                int previous = audio.getStreamVolume(AudioManager.STREAM_ALARM), max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                // Persist before changing volume so a later launch can recover after process termination.
                AlarmSettings.prefs(this).edit().putInt("previous_volume", previous).putInt("applied_volume", max).commit();
                try { audio.setStreamVolume(AudioManager.STREAM_ALARM, max, 0); } catch (SecurityException restricted) { AlarmSettings.restoreVolume(this); }
            }
            player = new MediaPlayer(); player.setAudioAttributes(attributes);
            try (android.content.res.AssetFileDescriptor descriptor = getResources().openRawResourceFd(R.raw.alert_tone)) {
                player.setDataSource(descriptor.getFileDescriptor(), descriptor.getStartOffset(), descriptor.getLength());
            }
            player.setLooping(true); player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK); player.prepare();
            player.setVolume(0.15f, 0.15f); player.start();
            for (int i = 1; i <= 10; i++) { final float volume = 0.15f + 0.085f * i; handler.postDelayed(() -> { if (player != null) player.setVolume(volume, volume); }, i * 150L); }
            Vibrator vibrator = getSystemService(Vibrator.class);
            if (vibrator != null && vibrator.hasVibrator()) vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,300,200,300,700}, 0));
            handler.postDelayed(this::stopSelf, alert.optBoolean("test") ? 4000 : urgent ? 30000 : 8000);
        } catch (Exception unavailable) { stopSelf(); }
        return START_NOT_STICKY;
    }
    private void releaseAudio() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) { try { player.stop(); } catch (IllegalStateException ignored) {} player.release(); player = null; }
        if (focus != null) { getSystemService(AudioManager.class).abandonAudioFocusRequest(focus); focus = null; }
        Vibrator vibrator = getSystemService(Vibrator.class); if (vibrator != null) vibrator.cancel();
        AlarmSettings.restoreVolume(this); activeId = ""; activePriority = "";
    }
    @Override public void onDestroy() { releaseAudio(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy(); }
}
