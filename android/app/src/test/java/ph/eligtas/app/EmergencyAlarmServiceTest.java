package ph.eligtas.app;

import android.app.Application;
import android.app.NotificationManager;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Looper;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowMediaPlayer;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class)
public class EmergencyAlarmServiceTest {
    private Application app;
    private AudioManager audio;
    private ServiceController<EmergencyAlarmService> controller;
    private MediaPlayer player;
    private JSONObject alert;

    @Before public void setup() throws Exception {
        app = RuntimeEnvironment.getApplication();
        AlarmSettings.prefs(app).edit().clear().putString("user","resident").putBoolean("enabled",true).putBoolean("max_volume",true).commit();
        EmergencyAlarmService.activeId = ""; EmergencyAlarmService.activePriority = "";
        AlertStore.clear(app);
        NotificationManager notifications = app.getSystemService(NotificationManager.class);
        shadowOf(notifications).setNotificationsEnabled(true);
        notifications.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
        audio = app.getSystemService(AudioManager.class);
        audio.setStreamVolume(AudioManager.STREAM_ALARM,2,0);
        audio.setRingerMode(AudioManager.RINGER_MODE_SILENT);
        shadowOf(audio).setNextFocusRequestResponse(AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        ShadowMediaPlayer.setMediaInfoProvider(source -> new ShadowMediaPlayer.MediaInfo(60000,0));
        ShadowMediaPlayer.setCreateListener((real,shadow) -> player = real);
        alert = new JSONObject().put("id",UUID.randomUUID().toString()).put("userId","resident")
            .put("priority","high").put("createdAt",Instant.now().toString()).put("body","TEST ONLY");
        controller = Robolectric.buildService(EmergencyAlarmService.class).create();
        AlertStore.save(app,alert);
    }
    @After public void cleanup() { controller.destroy(); }
    private void start() {
        controller.get().onStartCommand(new Intent(app,EmergencyAlarmService.class).putExtra("alert",alert.toString()),0,1);
    }
    private void focus(int change) {
        shadowOf(audio).getLastAudioFocusRequest().listener.onAudioFocusChange(change);
    }
    @Test public void silentRingerUsesAlarmAudioAndTransientFocusLossResumes() {
        start();
        assertNotNull(player);
        assertTrue(player.isPlaying());
        assertEquals(AudioAttributes.USAGE_ALARM,shadowOf(player).getAudioAttributes().getUsage());
        assertEquals(audio.getStreamMaxVolume(AudioManager.STREAM_ALARM),audio.getStreamVolume(AudioManager.STREAM_ALARM));
        assertEquals(AudioManager.RINGER_MODE_SILENT,audio.getRingerMode());
        focus(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK);
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));
        assertTrue(player.isPlaying());
        assertEquals(0.25f,shadowOf(player).getLeftVolume(),0.001f);
        assertFalse(shadowOf(controller.get()).isStoppedBySelf());
        focus(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT);
        assertFalse(player.isPlaying());
        assertEquals("paused",AlarmSettings.prefs(app).getString("alarm_state",""));
        focus(AudioManager.AUDIOFOCUS_GAIN);
        assertTrue(player.isPlaying());
        assertEquals("playing",AlarmSettings.prefs(app).getString("alarm_state",""));
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(28));
        assertTrue(shadowOf(controller.get()).isStoppedBySelf());
    }
    @Test public void attachedVoiceUsesAlarmAudioAndStopsAfterOnePlayback() throws Exception {
        start(); MediaPlayer bundled = player;
        ShadowMediaPlayer.setMediaInfoProvider(source -> new ShadowMediaPlayer.MediaInfo(1000,0));
        java.io.File file = java.io.File.createTempFile("test-voice-", ".wav", app.getCacheDir());
        controller.get().replaceWithAttachment(alert.getString("id"), "resident", file, "voice");
        assertNotSame(bundled, player); assertFalse(bundled.isPlaying()); assertTrue(player.isPlaying()); assertFalse(player.isLooping());
        assertEquals(AudioAttributes.USAGE_ALARM, shadowOf(player).getAudioAttributes().getUsage());
        assertEquals(AudioAttributes.CONTENT_TYPE_SPEECH, shadowOf(player).getAudioAttributes().getContentType());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2));
        assertTrue(shadowOf(controller.get()).isStoppedBySelf());
        controller.get().onDestroy(); assertFalse(file.exists());
        assertEquals(2, audio.getStreamVolume(AudioManager.STREAM_ALARM));
    }
    @Test public void attachedAlarmRepeatsAndAnOldDownloadCannotReplaceANewAlert() throws Exception {
        start(); MediaPlayer bundled = player;
        java.io.File stale = java.io.File.createTempFile("test-stale-", ".wav", app.getCacheDir());
        controller.get().replaceWithAttachment(UUID.randomUUID().toString(), "resident", stale, "alarm");
        assertSame(bundled, player); assertFalse(stale.exists()); assertTrue(player.isPlaying());
        ShadowMediaPlayer.setMediaInfoProvider(source -> new ShadowMediaPlayer.MediaInfo(1000,0));
        java.io.File file = java.io.File.createTempFile("test-alarm-", ".wav", app.getCacheDir());
        controller.get().replaceWithAttachment(alert.getString("id"), "resident", file, "alarm");
        assertTrue(player.isLooping());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(2)); assertTrue(player.isPlaying());
    }
    @Test public void invalidAttachmentKeepsTheBundledAlarm() throws Exception {
        start(); MediaPlayer bundled = player;
        // The decoder reports an overlong file; do not replace the fallback.
        java.io.File file = java.io.File.createTempFile("test-invalid-", ".wav", app.getCacheDir());
        controller.get().replaceWithAttachment(alert.getString("id"), "resident", file, "voice");
        assertFalse(file.exists()); assertTrue(bundled.isPlaying());
        assertEquals("playing", AlarmSettings.prefs(app).getString("alarm_state", ""));
    }
    @Test public void deniedAudioFocusReportsBlockedAndPostsTheFallback() {
        shadowOf(audio).setNextFocusRequestResponse(AudioManager.AUDIOFOCUS_REQUEST_FAILED);
        start();
        assertNull(player);
        assertEquals("blocked",AlarmSettings.prefs(app).getString("alarm_state",""));
        assertTrue(shadowOf(controller.get()).isStoppedBySelf());
        assertNotNull(shadowOf(app.getSystemService(NotificationManager.class)).getNotification(alert.optString("id").hashCode()));
        assertEquals(2,audio.getStreamVolume(AudioManager.STREAM_ALARM));
    }
    @Test public void stoppingReleasesAudioAndRestoresThePreviousVolume() {
        start();
        controller.get().onDestroy();
        assertEquals(2,audio.getStreamVolume(AudioManager.STREAM_ALARM));
        assertEquals("",EmergencyAlarmService.activeId);
        assertEquals("finished",AlarmSettings.prefs(app).getString("alarm_state",""));
        assertNotNull(shadowOf(audio).getLastAbandonedAudioFocusRequest());
        assertEquals(ShadowMediaPlayer.State.END,shadowOf(player).getState());
        assertNotNull(shadowOf(app.getSystemService(NotificationManager.class)).getNotification(AlertDelivery.notificationId(alert.optString("id"))));
    }
    @Test public void silenceActionStopsPlaybackWithoutOpeningAnyActivity() throws Exception {
        start();
        new AlertActionReceiver().onReceive(app,new Intent("SILENCE_ALERT").putExtra("alertId",alert.getString("id")));
        assertEquals(EmergencyAlarmService.class.getName(),shadowOf(app).getNextStoppedService().getComponent().getClassName());
        assertNull(shadowOf(app).getNextStartedActivity());
        controller.get().onDestroy();
        assertEquals(ShadowMediaPlayer.State.END,shadowOf(player).getState());
    }
    @Test public void silenceBeforeServiceStartsPreventsQueuedPlayback() throws Exception {
        AlertActionReceiver.silence(app,alert.getString("id"));
        start();assertNull(player);assertTrue(shadowOf(controller.get()).isStoppedBySelf());
    }
}
