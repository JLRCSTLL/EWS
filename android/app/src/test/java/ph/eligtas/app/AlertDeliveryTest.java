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
        AlertStore.clear(app);
        AlarmSettings.channels(app);
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
        assertEquals(AlarmSettings.PLAYBACK,notification.getChannelId());
        assertEquals(NotificationManager.IMPORTANCE_HIGH,notifications.getNotificationChannel(AlarmSettings.PLAYBACK).getImportance());
        assertNull(notifications.getNotificationChannel(AlarmSettings.PLAYBACK).getSound());
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
    @Test public void dispatchNotificationHasAnExplicitNavigationActionWithoutClinicalData() throws Exception {
        String response = UUID.randomUUID().toString();
        JSONObject message = alert("high").put("responseId",response);
        Notification notification = AlertDelivery.notification(app,message,AlarmSettings.EMERGENCY).build();
        Notification.Action navigation = null;
        for (Notification.Action action : notification.actions) if ("Open navigation".contentEquals(action.title)) navigation = action;
        assertNotNull(navigation);
        Intent intent = shadowOf(navigation.actionIntent).getSavedIntent();
        assertEquals("OPEN_RESPONSE",intent.getAction());
        assertEquals(MainActivity.class.getName(),intent.getComponent().getClassName());
        assertEquals("tanoviq://response/"+response,intent.getDataString());
        assertNull(intent.getStringExtra("body"));
    }
    @Test public void ordinaryAlertsDoNotOfferAResponderRoute() throws Exception {
        Notification notification = AlertDelivery.notification(app,alert("normal"),AlarmSettings.COMMUNITY).build();
        for (Notification.Action action : notification.actions) assertNotEquals("Open navigation",action.title.toString());
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
    @Test public void messageAndSilenceAreAvailableOnTheSameNotification() throws Exception {
        JSONObject alert=alert("high"); AlertDelivery.deliver(app,alert,true);
        Notification notice=shadowOf(notifications).getNotification(AlertDelivery.notificationId(alert.getString("id")));
        assertEquals("TEST ONLY",notice.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString());
        assertEquals("Silence alarm",notice.actions[0].title);
        assertEquals("Read message",notice.actions[1].title);
        Intent action=shadowOf(notice.actions[0].actionIntent).getSavedIntent();
        assertEquals(AlertActionReceiver.class.getName(),action.getComponent().getClassName());
        assertEquals(alert.getString("id"),action.getStringExtra("alertId"));
        assertEquals(AlertMessageActivity.class.getName(),shadowOf(notice.contentIntent).getSavedIntent().getComponent().getClassName());
    }
    @Test public void silencingOldAlertCannotStopNewerAlarmAndNeverMarksRead() throws Exception {
        JSONObject old=alert("high"); AlertStore.save(app,old);
        EmergencyAlarmService.activeId=UUID.randomUUID().toString();
        new AlertActionReceiver().onReceive(app,new Intent("SILENCE_ALERT").putExtra("alertId",old.getString("id")));
        assertNull(shadowOf(app).getNextStoppedService());
        assertTrue(AlertStore.silenced(app,old.getString("id")));
        assertFalse(AlertStore.get(app,old.getString("id")).has("read"));
    }
    @Test public void notificationsKeepDistinctMessageTargetsAndHideOtherAccounts() throws Exception {
        JSONObject a=alert("high"),b=alert("high");
        Notification first=AlertDelivery.notification(app,a,AlarmSettings.EMERGENCY).build();
        Notification second=AlertDelivery.notification(app,b,AlarmSettings.EMERGENCY).build();
        assertNotEquals(first.contentIntent,second.contentIntent);
        assertEquals(a.getString("id"),shadowOf(first.contentIntent).getSavedIntent().getStringExtra("alertId"));
        AlertStore.save(app,a);AlarmSettings.prefs(app).edit().putString("user","another-person").commit();
        assertNull(AlertStore.get(app,a.getString("id")));
        AlertDelivery.showQuiet(app,a);
        assertNull(shadowOf(notifications).getNotification(AlertDelivery.notificationId(a.getString("id"))));
    }
    @Test public void fullTextUpdatePreservesAlarmControlsWithoutReplayingSound() throws Exception {
        JSONObject alert=alert("high");EmergencyAlarmService.activeId=alert.getString("id");
        alert.put("body","Full command-center instructions");AlertDelivery.updateText(app,alert);
        Notification notice=shadowOf(notifications).getNotification(AlertDelivery.notificationId(alert.getString("id")));
        assertEquals("Full command-center instructions",notice.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString());
        assertNotEquals(0,notice.flags & Notification.FLAG_ONGOING_EVENT);
        assertEquals(AlarmSettings.PLAYBACK,notice.getChannelId());
        assertNull(notifications.getNotificationChannel(AlarmSettings.PLAYBACK).getSound());
        assertEquals("Silence alarm",notice.actions[0].title);
    }
}
