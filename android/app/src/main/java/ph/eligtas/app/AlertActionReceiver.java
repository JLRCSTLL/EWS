package ph.eligtas.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

public final class AlertActionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!"SILENCE_ALERT".equals(intent.getAction())) return;
        silence(context, intent.getStringExtra("alertId"));
    }
    static void silence(Context c, String id) {
        if (id == null) return;
        JSONObject alert = AlertStore.get(c,id);
        if (alert == null) return;
        try { alert.put("silenced",true); AlertStore.save(c,alert); } catch (Exception ignored) { return; }
        // An action from an older notification must never stop a newer alarm.
        if (id.equals(EmergencyAlarmService.activeId) || (EmergencyAlarmService.activeId.isEmpty() && id.equals(AlarmSettings.prefs(c).getString("alarm_id","")))) {
            c.stopService(new Intent(c,EmergencyAlarmService.class));
            AlarmSettings.playback(c,id,"finished","Alarm silenced from the notification. The message remains unread until you acknowledge it.");
        }
        AlertDelivery.showQuiet(c,alert);
    }
}
