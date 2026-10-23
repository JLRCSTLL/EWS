package ph.eligtas.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** User-started location sharing continues with a visible notification when WebView is paused. */
public final class LocationShareService extends Service implements LocationListener {
    private static final String CHANNEL = "live_location_v1";
    private static final int NOTIFICATION = 9103;
    private static final ExecutorService network = Executors.newSingleThreadExecutor();
    private static LocationShareService current;
    private static String message = "Location sharing is off";
    private static long lastSent;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager manager;
    private Location latest;
    private String token = "", user = "";
    private boolean active, uploading;
    private long previousFix, previousAttempt;
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("eligtas_location",MODE_PRIVATE); }

    static boolean permitted(Context c) {
        return c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    static boolean gpsEnabled(Context c) {
        LocationManager m = c.getSystemService(LocationManager.class);
        return m.isProviderEnabled(LocationManager.GPS_PROVIDER) || m.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }
    static JSONObject status(Context c, String account) throws Exception {
        boolean running = current != null && current.active && current.user.equals(account);
        return new JSONObject().put("supported",true).put("sharing",running).put("permission",permitted(c))
            .put("gpsEnabled",gpsEnabled(c)).put("lastSentAt",lastSent > 0 ? Instant.ofEpochMilli(lastSent).toString() : JSONObject.NULL)
            .put("message", running ? message : prefs(c).contains("pending_clear") ? "Sharing stopped. Reconnect to remove the last saved point." : prefs(c).contains("token") ? "Sharing paused. Tap Share my location to resume." : message);
    }
    static void start(Context c, String token, String user) {
        c.startForegroundService(new Intent(c,LocationShareService.class).putExtra("token",token).putExtra("user",user));
    }
    static void stop(Context c) {
        message = "Location sharing is off";
        if (current != null) current.finishSharing();
        else {
            String old = prefs(c).getString("token","");
            if (!old.isEmpty()) prefs(c).edit().putString("pending_clear",old).remove("token").remove("user").apply();
            message = "Location sharing is off";
            retryRemoval(c);
        }
    }
    static void stopOtherAccount(Context c, String user) {
        if (!user.equals(prefs(c).getString("user",""))) stop(c);
    }
    static void retryRemoval(Context c) {
        Context app = c.getApplicationContext(); String old = prefs(app).getString("pending_clear","");
        if (old.isEmpty()) return;
        network.execute(() -> {
            int result = send(old,"DELETE",new JSONObject());
            if (result == 200 || result == 401) {
                if (old.equals(prefs(app).getString("pending_clear",""))) prefs(app).edit().remove("pending_clear").apply();
                MainActivity.refreshLocation();
            }
        });
    }
    @Override public void onCreate() {
        super.onCreate(); current = this; manager = getSystemService(LocationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL,"Live location sharing",NotificationManager.IMPORTANCE_LOW);
        channel.setSound(null,null); channel.setDescription("Visible while your location is shared with approved command-center operators.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this,9103,new Intent(this,MainActivity.class).setAction("OPEN_LOCATION"),PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this,9104,new Intent(this,LocationShareService.class).setAction("STOP_LOCATION"),PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("TANOVIQ · on duty")
            .setContentText(message).setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .addAction(0,"End duty",stop).build();
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "STOP_LOCATION".equals(intent.getAction())) { message = "Location sharing is off"; finishSharing(); return START_NOT_STICKY; }
        String nextToken = intent.getStringExtra("token"), nextUser = intent.getStringExtra("user");
        if (nextToken == null || !nextToken.matches("[A-Za-z0-9_-]{43}") || nextUser == null || !permitted(this)) { stopSelf(); return START_NOT_STICKY; }
        token = nextToken; user = nextUser; previousFix = previousAttempt = 0; latest = null; lastSent = 0;
        prefs(this).edit().putString("token",token).putString("user",user).apply();
        message = "Getting a fresh GPS fix…"; active = true;
        try {
            ServiceCompat.startForeground(this,NOTIFICATION,notification(),Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
            manager.removeUpdates(this);
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && manager.getAllProviders().contains(LocationManager.GPS_PROVIDER))
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,LocationPolicy.UPDATE_MS,0,this,Looper.getMainLooper());
            if (manager.getAllProviders().contains(LocationManager.NETWORK_PROVIDER))
                manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,LocationPolicy.UPDATE_MS,0,this,Looper.getMainLooper());
            handler.removeCallbacks(tick); handler.post(tick); MainActivity.refreshLocation();
        } catch (RuntimeException restricted) { message = "Location permission unavailable. Open the app and try again."; finishSharing(); }
        return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location fix) {
        if (latest == null || fix.getElapsedRealtimeNanos() > latest.getElapsedRealtimeNanos()) latest = new Location(fix);
        upload();
    }
    @Override public void onProviderDisabled(String provider) { if (!gpsEnabled(this)) updateMessage("Location services are off. Enable GPS to resume."); }
    @Override public void onProviderEnabled(String provider) { updateMessage("Waiting for a fresh GPS fix…"); }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    private final Runnable tick = new Runnable() { @Override public void run() {
        if (!active) return;
        if (!permitted(LocationShareService.this)) { message = "Location permission was removed. Sharing stopped."; finishSharing(); return; }
        upload();
        if (latest == null || !LocationPolicy.fresh(SystemClock.elapsedRealtime(),latest.getElapsedRealtimeNanos()/1000000))
            updateMessage(gpsEnabled(LocationShareService.this) ? "Waiting for GPS. The map shows your last update." : "Location services are off. Enable GPS to resume.");
        handler.postDelayed(this,LocationPolicy.UPDATE_MS);
    }};
    private void upload() {
        if (!active || uploading || latest == null) return;
        long now = SystemClock.elapsedRealtime(), fixTime = latest.getElapsedRealtimeNanos()/1000000;
        if (!LocationPolicy.shouldUpload(now,fixTime,previousFix,previousAttempt)) return;
        Location fix = new Location(latest); String share = token;
        try {
            JSONObject body = new JSONObject().put("lat",fix.getLatitude()).put("lng",fix.getLongitude()).put("accuracy",fix.getAccuracy())
                .put("capturedAt",Instant.ofEpochMilli(System.currentTimeMillis()-(now-fixTime)).toString());
            uploading = true; previousAttempt = now;
            network.execute(() -> {
                int result = send(share,"PUT",body);
                handler.post(() -> {
                    uploading = false;
                    if (!active || !token.equals(share)) return;
                    if (result == 200) { previousFix = fixTime; lastSent = System.currentTimeMillis(); updateMessage("Live location shared · accuracy ±" + Math.round(fix.getAccuracy()) + " m"); }
                    else if (result == 401 || result == 409) { message = "Duty ended or sign-in expired. Open the app to start duty again."; finishSharing(); }
                    else updateMessage("Location not sent. Retrying when connected…");
                });
            });
        } catch (Exception invalid) { updateMessage("Waiting for a valid GPS fix…"); }
    }
    private void updateMessage(String value) {
        message = value;
        if (active) getSystemService(NotificationManager.class).notify(NOTIFICATION,notification());
        MainActivity.refreshLocation();
    }
    private void finishSharing() {
        active = false; lastSent = 0; handler.removeCallbacksAndMessages(null);
        if (manager != null) manager.removeUpdates(this);
        String old = token.isEmpty() ? prefs(this).getString("token","") : token;
        if (!old.isEmpty()) prefs(this).edit().putString("pending_clear",old).remove("token").remove("user").apply();
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); MainActivity.refreshLocation(); retryRemoval(this);
    }
    private static int send(String token, String method, JSONObject body) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(BuildConfig.APP_ORIGIN + "/api/location/native").openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(8000); connection.setReadTimeout(8000);
            connection.setRequestMethod(method); connection.setRequestProperty("Authorization","Bearer " + token);
            connection.setRequestProperty("Origin",BuildConfig.APP_ORIGIN); connection.setRequestProperty("Content-Type","application/json");
            connection.setDoOutput(true);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            return connection.getResponseCode();
        } catch (Exception offline) { return 0; }
        finally { if (connection != null) connection.disconnect(); }
    }
    @Override public void onDestroy() {
        active = false; if (current == this) current = null;
        handler.removeCallbacksAndMessages(null); if (manager != null) manager.removeUpdates(this);
        MainActivity.refreshLocation(); super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
