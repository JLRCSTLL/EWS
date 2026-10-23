package ph.eligtas.app;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Intent;
import android.media.AudioManager;
import java.time.Instant;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class)
public class AlertDeliveryTest {
    private Application app;
    private NotificationManager notifications;
    @Before public void setup() {
        app = RuntimeEnvironment.getApplication();
        notifications = app.getSystemService(NotificationManager.class);
        shadowOf(notifications).setNotificationsEnabled(true);
        AlarmSettings.prefs(app).edit().clear().putString("user","resident").putBoolean("enabled",true).putBoolean("max_volume",true).commit();
        EmergencyAlarmService.activeId = ""; EmergencyAlarmService.activePriority = "";
    }
    private JSONObject alert(String priority) throws Exception {
        return new JSONObject().put("id",UUID.randomUUID().toString()).put("userId","resident")
            .put("createdAt",Instant.now().toString()).put("priority",priority).put("body","TEST ONLY");
    }
    @Test public void incomingEmergencyStartsAlarmWithoutACompetingNotificationSound() throws Exception {
        JSONObject alert = alert("high");
        assertTrue(AlertDelivery.deliver(app,alert,true));
        Intent start = shadowOf(app).getNextStartedService();
        assertEquals(EmergencyAlarmService.class.getName(),start.getComponent().getClassName());
        assertEquals(alert.toString(),start.getStringExtra("alert"));
        Notification notification = shadowOf(notifications).getNotification(alert.getString("id").hashCode());
        assertEquals(AlarmSettings.EMERGENCY,notification.getChannelId());
        assertEquals(Notification.GROUP_ALERT_SUMMARY,notification.getGroupAlertBehavior());
        assertEquals("starting",AlarmSettings.prefs(app).getString("alarm_state",""));
    }
    @Test public void downgradedPushUsesChannelFallbackAndReportsWhyTheAlarmDidNotStart() throws Exception {
        JSONObject alert = alert("critical");
        assertFalse(AlertDelivery.deliver(app,alert,false));
        assertNull(shadowOf(app).getNextStartedService());
        assertEquals("blocked",AlarmSettings.prefs(app).getString("alarm_state",""));
        Notification fallback = shadowOf(notifications).getNotification(alert.getString("id").hashCode());
        assertEquals(Notification.GROUP_ALERT_ALL,fallback.getGroupAlertBehavior());
        assertEquals(AlarmSettings.EMERGENCY,fallback.getChannelId());
    }
    @Test public void announcementsDoNotRequestTheEmergencyService() throws Exception {
        assertFalse(AlertDelivery.deliver(app,alert("normal"),true));
        assertNull(shadowOf(app).getNextStartedService());
        assertEquals("announcement",AlarmSettings.prefs(app).getString("alarm_state",""));
    }
    @Test public void playbackFailureCanSoundThePreviouslySilentNotification() throws Exception {
        JSONObject alert = alert("high");
        AlertDelivery.deliver(app,alert,true);
        AlertDelivery.fallback(app,alert);
        Notification fallback = shadowOf(notifications).getNotification(alert.getString("id").hashCode());
        assertEquals(Notification.GROUP_ALERT_ALL,fallback.getGroupAlertBehavior());
        assertEquals(0,fallback.flags & Notification.FLAG_ONLY_ALERT_ONCE);
    }
    @Test public void duplicateDeliveryDoesNotStartAnotherAlarm() throws Exception {
        JSONObject alert = alert("high");
        assertTrue(AlertDelivery.deliver(app,alert,true)); shadowOf(app).getNextStartedService();
        assertFalse(AlertDelivery.deliver(app,alert,true));
        assertNull(shadowOf(app).getNextStartedService());
    }
    @Test public void disabledSoundCannotStartAnAlarm() throws Exception {
        AlarmSettings.prefs(app).edit().putBoolean("enabled",false).commit();
        assertFalse(AlertDelivery.deliver(app,alert("critical"),true));
        assertNull(shadowOf(app).getNextStartedService());
    }
    @Test public void aChannelExceptionDoesNotClaimToOverrideTotalSilence() throws Exception {
        shadowOf(notifications).setNotificationPolicyAccessGranted(true);
        notifications.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
        assertFalse(AlarmSettings.alarmsAllowed(app));
        assertEquals("total-silence",AlarmSettings.status(app).getString("dndMode"));
        notifications.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS);
        assertTrue(AlarmSettings.alarmsAllowed(app));
    }
    @Test public void priorityDndUsesTheConsolidatedAlarmPolicy() {
        notifications.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        shadowOf(notifications).setConsolidatedNotificationPolicy(new NotificationManager.Policy(0,0,0));
        assertFalse(AlarmSettings.alarmsAllowed(app));
        shadowOf(notifications).setConsolidatedNotificationPolicy(new NotificationManager.Policy(NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS,0,0));
        assertTrue(AlarmSettings.alarmsAllowed(app));
    }
    @Test public void restoreVolumePreservesUserChanges() {
        AudioManager audio = app.getSystemService(AudioManager.class);
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        audio.setStreamVolume(AudioManager.STREAM_ALARM,max,0);
        AlarmSettings.prefs(app).edit().putInt("previous_volume",2).putInt("applied_volume",max).commit();
        AlarmSettings.restoreVolume(app);
        assertEquals(2,audio.getStreamVolume(AudioManager.STREAM_ALARM));
        AlarmSettings.prefs(app).edit().putInt("previous_volume",1).putInt("applied_volume",max).commit();
        audio.setStreamVolume(AudioManager.STREAM_ALARM,3,0);
        AlarmSettings.restoreVolume(app);
        assertEquals(3,audio.getStreamVolume(AudioManager.STREAM_ALARM));
    }
}
