package ph.eligtas.app;

import static org.junit.Assert.*;
import android.content.Context;
import java.io.File;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class AlertStoreTest {
    @Test public void existingAlertCacheMigratesWithoutLosingSilencedStatus() throws Exception {
        Context c = RuntimeEnvironment.getApplication();
        String id = "123e4567-e89b-42d3-a456-426614174000";
        AlarmSettings.prefs(c).edit().putString("user", "fixture-user").commit();
        JSONObject alert = new JSONObject().put("id", id).put("userId", "fixture-user").put("silenced", true);
        c.getSharedPreferences("previous_notifications", Context.MODE_PRIVATE).edit().putString(id, alert.toString()).commit();
        File directory = new File(c.getApplicationInfo().dataDir, "shared_prefs"); directory.mkdirs();
        new File(directory, "previous_notifications.xml").createNewFile();
        assertTrue(AlertStore.silenced(c, id));
        assertTrue(c.getSharedPreferences("agila_notifications", Context.MODE_PRIVATE).contains(id));
        assertTrue(c.getSharedPreferences("previous_notifications", Context.MODE_PRIVATE).getAll().isEmpty());
        AlarmSettings.prefs(c).edit().putString("user", "another-user").commit();
        assertNull(AlertStore.get(c, id));
    }
}
