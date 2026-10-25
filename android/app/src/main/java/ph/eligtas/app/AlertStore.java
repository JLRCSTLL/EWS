package ph.eligtas.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;

/** Private, bounded notification cache. Never exposed to the WebView. */
final class AlertStore {
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("tanoviq_notifications", Context.MODE_PRIVATE); }
    static synchronized void save(Context c, JSONObject alert) {
        String id = alert.optString("id");
        if (!id.matches("[0-9a-fA-F-]{36}") || !alert.optString("userId").equals(AlarmSettings.prefs(c).getString("user",""))) return;
        prefs(c).edit().putString(id, alert.toString()).commit();
        ArrayList<String> keys = new ArrayList<>(prefs(c).getAll().keySet());
        if (keys.size() > 100) {
            keys.sort(Comparator.comparing(key -> { try { return new JSONObject(prefs(c).getString(key,"{}")).optString("createdAt"); } catch (Exception ignored) { return ""; } }));
            SharedPreferences.Editor editor = prefs(c).edit();
            for (int i = 0; i < keys.size() - 100; i++) editor.remove(keys.get(i));
            editor.apply();
        }
    }
    static JSONObject get(Context c, String id) {
        try {
            JSONObject alert = new JSONObject(prefs(c).getString(id,"{}"));
            String bound = AlarmSettings.prefs(c).getString("user", "");
            return !bound.isEmpty() && bound.equals(alert.optString("userId")) ? alert : null;
        } catch (Exception invalid) { return null; }
    }
    static boolean silenced(Context c, String id) { JSONObject alert = get(c,id); return alert != null && alert.optBoolean("silenced"); }
    static void clear(Context c) { prefs(c).edit().clear().commit(); }
}
