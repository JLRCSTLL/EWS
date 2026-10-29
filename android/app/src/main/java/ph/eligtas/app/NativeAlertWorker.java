package ph.eligtas.app;

import android.content.Context;
import android.webkit.CookieManager;
import androidx.annotation.NonNull;
import androidx.work.*;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/** Durable network work; playback and notification actions never wait on this. */
public final class NativeAlertWorker extends Worker {
    public NativeAlertWorker(@NonNull Context c,@NonNull WorkerParameters p) { super(c,p); }
    static void registerCurrent(Context c) {
        if (!BuildConfig.PUSH_CONFIGURED || AlarmSettings.prefs(c).getString("user","").isEmpty()) return;
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> register(c,token));
    }
    static void register(Context c,String token) {
        AlarmSettings.prefs(c).edit().putString("push_token",token).apply();
        enqueue(c,"register","");
    }
    static void receipt(Context c,JSONObject alert,boolean fromPush,boolean read) {
        if (alert.optBoolean("test") || !alert.optString("userId").matches("[0-9a-fA-F-]{36}")) return;
        enqueue(c,read?"read":"received",alert.optString("id"));
    }
    private static void enqueue(Context c,String operation,String id) {
        String user=AlarmSettings.prefs(c).getString("user","");
        if (!user.matches("[0-9a-fA-F-]{36}")) return;
        Data input = new Data.Builder().putString("operation",operation).putString("id",id).putString("user",user).build();
        OneTimeWorkRequest work=new OneTimeWorkRequest.Builder(NativeAlertWorker.class).setInputData(input)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).addTag("tanoviq-alert-network").build();
        WorkManager.getInstance(c).enqueueUniqueWork("tanoviq-"+user+"-"+operation+"-"+id,operation.equals("register")?ExistingWorkPolicy.REPLACE:ExistingWorkPolicy.KEEP,work);
    }
    @NonNull @Override public Result doWork() {
        Context c=getApplicationContext(); String user=getInputData().getString("user"),operation=getInputData().getString("operation"),id=getInputData().getString("id");
        if (user==null || !user.equals(AlarmSettings.prefs(c).getString("user",""))) return Result.success();
        // Capture the current HTTP-only session from Android's private cookie store.
        // No session or credential is placed in WorkManager input data or logs.
        String cookie=CookieManager.getInstance().getCookie(BuildConfig.APP_ORIGIN+"/api");
        if (cookie==null || !cookie.contains("eligtas_session=")) return Result.success();
        try {
            JSONObject state = request("/state?view=public",null,cookie);
            if (!user.equals(state.getJSONObject("user").getString("id")) || !user.equals(AlarmSettings.prefs(c).getString("user",""))) return Result.success();
            if ("register".equals(operation)) {
                String token=AlarmSettings.prefs(c).getString("push_token","");
                if (token.isEmpty()) return Result.success();
                request("/push/android",new JSONObject().put("token",token),cookie);
                AlarmSettings.prefs(c).edit().putString("push_registration","connected").apply();
            } else {
                JSONObject cached=AlertStore.get(c,id);
                if (cached==null) return Result.success();
                JSONArray alerts=state.getJSONArray("alerts"); boolean found=false;
                for(int i=0;i<alerts.length();i++) if(id.equals(alerts.getJSONObject(i).optString("id"))) {
                    JSONObject message = alerts.getJSONObject(i);
                    cached.put("body", message.optString("content"));
                    JSONObject audio = message.optJSONObject("audio");
                    if (audio != null) { cached.put("audioId", audio.optString("id")); cached.put("audioKind", audio.optString("kind")); }
                    found=true; break;
                }
                if (!found || !user.equals(AlarmSettings.prefs(c).getString("user",""))) return Result.success();
                AlertStore.save(c,cached);
                AlertDelivery.updateText(c,cached);
                request("/alerts/"+id+"/receipt",new JSONObject().put("read","read".equals(operation)),cookie);
            }
            return Result.success();
        } catch (HttpFailure failure) {
            if (failure.status==401 || failure.status==403 || failure.status==404) return Result.success();
            return failure.status==429 || failure.status>=500 ? retry() : Result.failure();
        } catch (Exception offline) { return retry(); }
    }
    private Result retry() { return getRunAttemptCount()<10?Result.retry():Result.failure(); }
    private static JSONObject request(String path,JSONObject body,String cookie) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(BuildConfig.APP_ORIGIN+"/api"+path).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(12000);connection.setReadTimeout(12000);
        connection.setRequestProperty("Cookie",cookie);connection.setRequestProperty("Origin",BuildConfig.APP_ORIGIN);connection.setRequestProperty("Accept","application/json");
        try {
            if(body!=null){connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);try(var stream=connection.getOutputStream()){stream.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
            int status=connection.getResponseCode();if(status<200||status>=300)throw new HttpFailure(status);
            try(var stream=connection.getInputStream();var bytes=new java.io.ByteArrayOutputStream()){
                byte[] chunk=new byte[8192];int count;
                while((count=stream.read(chunk))!=-1){if(bytes.size()+count>2_000_000)throw new java.io.IOException("Response too large");bytes.write(chunk,0,count);}
                return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            }
        } finally {connection.disconnect();}
    }
    private static class HttpFailure extends Exception { final int status; HttpFailure(int value){status=value;} }
}
