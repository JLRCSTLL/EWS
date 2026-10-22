package ph.eligtas.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;

public final class AlertMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        if (!"eligtas-alert".equals(message.getData().get("kind"))) return;
        // High priority is required to start alarm playback from the background.
        AlertDelivery.deliver(this, new JSONObject(message.getData()), message.getPriority() == RemoteMessage.PRIORITY_HIGH);
    }
    @Override public void onNewToken(String token) {
        // Registration is performed by the authenticated web session on next focus.
        MainActivity.refreshInbox();
    }
}
