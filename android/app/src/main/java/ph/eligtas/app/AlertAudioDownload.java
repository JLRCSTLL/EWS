package ph.eligtas.app;

import android.content.Context;
import android.os.SystemClock;
import android.webkit.CookieManager;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

/** Authenticated, bounded download from the app service, never a supplied URL. */
final class AlertAudioDownload {
    static boolean hasAudio(JSONObject alert) {
        return alert.optString("audioId").matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")
            && (alert.optString("audioKind").equals("alarm") || alert.optString("audioKind").equals("voice"));
    }
    static File download(Context context, JSONObject alert) throws Exception {
        if (!hasAudio(alert) || !alert.optString("userId").equals(AlarmSettings.prefs(context).getString("user",""))) throw new IOException("Audio unavailable");
        String cookie = CookieManager.getInstance().getCookie(BuildConfig.APP_ORIGIN + "/api");
        if (cookie == null || !cookie.contains("eligtas_session=")) throw new IOException("Sign in required");
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.APP_ORIGIN + "/api/alert-audio/" + alert.optString("audioId")).openConnection();
        File file = null;
        try {
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(5000); connection.setReadTimeout(5000);
            connection.setRequestProperty("Cookie", cookie); connection.setRequestProperty("Accept", "audio/wav");
            long until = SystemClock.elapsedRealtime() + 10000;
            if (connection.getResponseCode() != 200 || connection.getContentType() == null || !connection.getContentType().startsWith("audio/wav") || connection.getContentLengthLong() > 960044) throw new IOException("Audio unavailable");
            file = File.createTempFile("alert-audio-", ".wav", context.getCacheDir());
            int total = 0;
            try (var input = connection.getInputStream(); var output = new FileOutputStream(file)) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > 960044 || SystemClock.elapsedRealtime() > until || Thread.currentThread().isInterrupted()) throw new IOException("Audio download limit");
                    output.write(buffer, 0, count);
                }
            }
            if (total < 3244 || !alert.optString("userId").equals(AlarmSettings.prefs(context).getString("user",""))) throw new IOException("Audio unavailable");
            return file;
        } catch (Exception failure) { if (file != null) file.delete(); throw failure; }
        finally { connection.disconnect(); }
    }
}
