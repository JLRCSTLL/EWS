package ph.eligtas.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;

public final class AlertMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        if (!"eligtas-alert".equals(message.getData().get("kind"))) return;
        // High priority is required to start alarm playback from the background.
        JSONObject alert=new JSONObject(message.getData());
        AlertDelivery.deliver(this, alert, message.getPriority() == RemoteMessage.PRIORITY_HIGH);
        if(AlertStore.get(this,alert.optString("id"))!=null) NativeAlertWorker.receipt(this,alert,true,false);
    }
    @Override public void onNewToken(String token) {
        NativeAlertWorker.register(this,token);
        MainActivity.refreshInbox();
    }
}
