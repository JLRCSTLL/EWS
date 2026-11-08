package ph.eligtas.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.io.File;
import java.util.Map;

/** Private, bounded notification cache. Never exposed to the WebView. */
final class AlertStore {
    private static synchronized SharedPreferences prefs(Context c) {
        SharedPreferences active = c.getSharedPreferences("agila_notifications", Context.MODE_PRIVATE);
        SharedPreferences migration = c.getSharedPreferences("agila_migrations", Context.MODE_PRIVATE);
        if (migration.getBoolean("notification_cache", false)) return active;
        File[] previous = new File(c.getApplicationInfo().dataDir, "shared_prefs").listFiles((dir, name) ->
            name.matches("[a-zA-Z0-9-]+_notifications\\.xml") && !name.equals("agila_notifications.xml"));
        if (previous == null || previous.length != 1) return active;
        String oldName = previous[0].getName().replaceFirst("\\.xml$", "");
        SharedPreferences old = c.getSharedPreferences(oldName, Context.MODE_PRIVATE);
        Map<String, ?> values = old.getAll();
        if (values.size() > 100) return active;
        SharedPreferences.Editor copy = active.edit();
        for (Map.Entry<String, ?> entry : values.entrySet()) {
            try {
                if (!(entry.getValue() instanceof String) || !entry.getKey().matches("[0-9a-fA-F-]{36}")) return active;
                JSONObject alert = new JSONObject((String) entry.getValue());
                if (!entry.getKey().equals(alert.optString("id")) || alert.optString("userId").isEmpty()) return active;
                if (!active.contains(entry.getKey())) copy.putString(entry.getKey(), (String) entry.getValue());
            } catch (Exception invalid) { return active; }
        }
        if (copy.commit()) {
            // Clear only this app's obsolete cache after its records are copied.
            c.deleteSharedPreferences(oldName);
            migration.edit().putBoolean("notification_cache", true).commit();
        }
        return active;
    }
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
