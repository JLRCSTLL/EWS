package ph.eligtas.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import java.lang.ref.WeakReference;
import java.time.Instant;
import java.util.Collections;
import java.util.UUID;
import org.json.JSONObject;

public final class MainActivity extends ComponentActivity {
    private static WeakReference<MainActivity> current = new WeakReference<>(null);
    private WebView web;
    private LinearLayout offline;
    private ProgressBar progress;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private JavaScriptReplyProxy sharingReply;
    private int sharingRequest;
    private boolean resumed;
    private boolean permissionSetupRunning;
    private boolean pendingAlarmSetup;
    static void refreshLocation() {
        MainActivity activity = current.get();
        if (activity != null) activity.runOnUiThread(() -> {
            if (activity.web != null && activity.trusted(activity.web.getUrl())) activity.web.evaluateJavascript("window.dispatchEvent(new Event('eligtas-native-location'))", null);
        });
    }
    static void refreshInbox() {
        MainActivity activity = current.get();
        if (activity != null) activity.runOnUiThread(() -> {
            if (activity.trusted(activity.web.getUrl())) activity.web.evaluateJavascript("window.dispatchEvent(new Event('eligtas-native-alert'))", null);
        });
    }
    static void refreshAlarmStatus() {
        MainActivity activity = current.get();
        if (activity != null) activity.runOnUiThread(() -> {
            if (activity.web != null && activity.trusted(activity.web.getUrl())) activity.web.evaluateJavascript("window.dispatchEvent(new Event('eligtas-native-alarm-state'))",null);
        });
    }
    private boolean trusted(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value), app = Uri.parse(BuildConfig.APP_ORIGIN);
        return "https".equals(uri.getScheme()) && app.getHost().equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved); current = new WeakReference<>(this);
        if (EmergencyAlarmService.activeId.isEmpty()) {
            AlarmSettings.restoreVolume(this);
            String state = AlarmSettings.prefs(this).getString("alarm_state","");
            if (state.equals("starting") || state.equals("playing") || state.equals("paused"))
                AlarmSettings.playback(this,AlarmSettings.prefs(this).getString("alarm_id",""),"finished","Previous alarm is no longer running. Use Test alarm to check this phone.");
        }
        AlarmSettings.channels(this);
        if (BuildConfig.PUSH_CONFIGURED) FirebaseApp.initializeApp(this);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(245,247,251));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) { android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()); view.setPadding(bars.left,bars.top,bars.right,bars.bottom); }
            else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this); root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(true); settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(true); settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new FrameLayout.LayoutParams(-1,6));
        offline = new LinearLayout(this); offline.setOrientation(LinearLayout.VERTICAL); offline.setGravity(android.view.Gravity.CENTER); offline.setPadding(32,32,32,32); offline.setBackgroundColor(Color.rgb(245,247,251));
        TextView heading = new TextView(this); heading.setText(R.string.offline_title); heading.setTextSize(23); heading.setTextColor(Color.rgb(30,54,89)); offline.addView(heading);
        TextView description = new TextView(this); description.setText(R.string.offline_description); description.setTextSize(15); description.setPadding(0,20,0,20); offline.addView(description);
        Button retry = new Button(this); retry.setText(R.string.retry); retry.setOnClickListener(view -> loadPublic()); offline.addView(retry);
        root.addView(offline, new FrameLayout.LayoutParams(-1,-1)); offline.setVisibility(View.GONE); setContentView(root);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl().toString())) return false;
                String scheme = request.getUrl().getScheme();
                if (request.isForMainFrame() && ("https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (RuntimeException unavailable) {}
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { if (request.isForMainFrame()) showOffline(); }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) { if (request.isForMainFrame() && error.getStatusCode() >= 400) showOffline(); }
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!trusted(origin)) { callback.invoke(origin,false,false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { callback.invoke(origin,true,false); return; }
                if (locationCallback != null) locationCallback.invoke(locationOrigin,false,false);
                locationCallback = callback; locationOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}, 100);
            }
        });
        // Unlike addJavascriptInterface, this bridge is restricted to the exact HTTPS origin and main frame.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "ELigtasAndroid", Collections.singleton(BuildConfig.APP_ORIGIN), (view,message,origin,mainFrame,reply) -> {
                if (!mainFrame || !trusted(origin.toString())) return;
                try { handle(new JSONObject(message.getData()),reply); } catch (Exception invalid) { /* Untrusted malformed message. */ }
            });
        } else new AlertDialog.Builder(this).setTitle("Update Android System WebView").setMessage("Update Android System WebView from Google Play to enable native alarm controls. Your alert inbox remains available.").setPositiveButton("OK",null).show();
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) { @Override public void handleOnBackPressed() { goBack(); } });
        loadPublic(); openNotification(getIntent());
    }
    private void loadPublic() { offline.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(BuildConfig.APP_ORIGIN + "/#/public"); }
    private void showOffline() { offline.setVisibility(View.VISIBLE); web.setVisibility(View.GONE); progress.setVisibility(View.GONE); }
    private void goBack() { if (web.canGoBack()) web.goBack(); else finish(); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); openNotification(intent); }
    private void openNotification(Intent intent) {
        if ("OPEN_ALERT".equals(intent.getAction())) { stopService(new Intent(this,EmergencyAlarmService.class)); web.loadUrl(BuildConfig.APP_ORIGIN + "/#/public/alerts"); }
        if ("OPEN_LOCATION".equals(intent.getAction())) web.loadUrl(BuildConfig.APP_ORIGIN + "/#/public/map");
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if (request == 100 && locationCallback != null) { locationCallback.invoke(locationOrigin,checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED,false); locationCallback = null; }
        if ((request == 102 || request == 103) && sharingReply != null) {
            if (request == 102 && LocationShareService.permitted(this) && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},103);
            } else {
                JavaScriptReplyProxy pending = sharingReply; sharingReply = null;
                try { checkLocationPermissions(); reply(pending,sharingRequest,new JSONObject().put("ready",true),null); }
                catch (Exception denied) { reply(pending,sharingRequest,null,denied.getMessage()); }
            }
        }
        if (request == 106) setupNotificationPermission();
        if (request == 107) setupBackgroundPermission();
        if (request == 108) setupAlarmPermission();
        refreshInbox();
    }
    private void reply(JavaScriptReplyProxy proxy, int id, Object data, String error) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try { JSONObject result = new JSONObject().put("requestId",id); if (error != null) result.put("error",error); else result.put("data",data); proxy.postMessage(result.toString()); } catch (Exception ignored) {}
    }
    private void handle(JSONObject request, JavaScriptReplyProxy proxy) throws Exception {
        int id = request.getInt("requestId"); String action = request.optString("action");
        try {
            switch (action) {
                case "bind": {
                    String user = request.optString("userId"); if (!user.matches("[0-9a-fA-F-]{36}")) throw new IllegalArgumentException();
                    if (!user.equals(AlarmSettings.prefs(this).getString("user",""))) {
                        LocationShareService.stopOtherAccount(this,user);
                        stopService(new Intent(this,EmergencyAlarmService.class));
                        AlarmSettings.prefs(this).edit().putString("user",user).remove("seen").remove("alarm_id").remove("alarm_state").remove("alarm_message").putBoolean("enabled",true).putBoolean("max_volume",true).apply();
                    }
                    AlarmSettings.prefs(this).edit().putBoolean("enabled",true).putBoolean("max_volume",true).apply();
                    if (!AlarmSettings.prefs(this).getBoolean("duty_setup_shown",false)) web.post(this::personnelPermissionSetup);
                    reply(proxy,id,AlarmSettings.status(this),null); break;
                }
                case "status": reply(proxy,id,AlarmSettings.status(this),null); break;
                case "locationStatus": reply(proxy,id,LocationShareService.status(this,request.optString("userId")),null); break;
                case "locationPermission": {
                    if (!resumed) throw new IllegalStateException("Open the app to start sharing your location.");
                    if (sharingReply != null) throw new IllegalStateException("Respond to the existing permission request first.");
                    if (!LocationShareService.permitted(this)) {
                        sharingReply = proxy; sharingRequest = id;
                        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},102);
                    } else if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) {
                        sharingReply = proxy; sharingRequest = id; requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},103);
                    } else { checkLocationPermissions(); reply(proxy,id,new JSONObject().put("ready",true),null); }
                    break;
                }
                case "locationStart": {
                    if (!resumed) throw new IllegalStateException("Open the app to start sharing your location.");
                    checkLocationPermissions(); String user = request.optString("userId"), token = request.optString("token");
                    if (!user.matches("[0-9a-fA-F-]{36}") || !token.matches("[A-Za-z0-9_-]{43}")) throw new IllegalArgumentException();
                    LocationShareService.start(this,token,user); reply(proxy,id,new JSONObject().put("sharing",true),null); break;
                }
                case "locationStop": LocationShareService.stop(this); reply(proxy,id,new JSONObject().put("sharing",false),null); break;
                case "configure": {
                    boolean signedIn = !AlarmSettings.prefs(this).getString("user","").isEmpty();
                    AlarmSettings.prefs(this).edit().putBoolean("enabled",signedIn).putBoolean("max_volume",signedIn).apply();
                    reply(proxy,id,AlarmSettings.status(this),null); break;
                }
                case "permissionSetup": personnelPermissionSetup(); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "notifications": notificationPermission(); if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED) startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "channel": startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,AlarmSettings.EMERGENCY)); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "dnd": {
                    startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
                    reply(proxy,id,AlarmSettings.status(this),null); break;
                }
                case "soundSettings": startActivity(new Intent(Settings.ACTION_SOUND_SETTINGS)); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "appSettings": startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:"+getPackageName()))); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "token": {
                    if (!BuildConfig.PUSH_CONFIGURED || !AlarmSettings.notificationsAllowed(this,AlarmSettings.EMERGENCY)) throw new IllegalStateException();
                    FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                    FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                        try { if (task.isSuccessful()) reply(proxy,id,new JSONObject().put("token",task.getResult()),null); else reply(proxy,id,null,"Unable to register this phone with Firebase. Check your connection and Google Play services."); }
                        catch (Exception failure) { reply(proxy,id,null,"Unable to register this phone."); }
                    }); break;
                }
                case "alert": reply(proxy,id,new JSONObject().put("playing",AlertDelivery.deliver(this,request.getJSONObject("alert"),true)),null); break;
                case "test": {
                    if (!AlarmSettings.prefs(this).getBoolean("enabled",false)) throw new IllegalStateException();
                    JSONObject alert = new JSONObject().put("id",UUID.randomUUID().toString()).put("userId",AlarmSettings.prefs(this).getString("user",""))
                        .put("body","TEST ONLY — GSAM alarm sound check. No message was sent.").put("priority","critical").put("createdAt",Instant.now().toString()).put("test",true);
                    reply(proxy,id,new JSONObject().put("playing",AlertDelivery.deliver(this,alert,true)).put("alarmId",alert.getString("id")),null); break;
                }
                case "stop": stopService(new Intent(this,EmergencyAlarmService.class)); reply(proxy,id,new JSONObject().put("ok",true),null); break;
                case "logout": {
                    LocationShareService.stop(this);
                    stopService(new Intent(this,EmergencyAlarmService.class));
                    AlarmSettings.prefs(this).edit().remove("user").remove("seen").remove("alarm_id").remove("alarm_state").remove("alarm_message").putBoolean("enabled",false).putBoolean("max_volume",false).apply();
                    if (BuildConfig.PUSH_CONFIGURED) { FirebaseMessaging.getInstance().setAutoInitEnabled(false); FirebaseMessaging.getInstance().deleteToken(); }
                    getSystemService(android.app.NotificationManager.class).cancelAll();
                    reply(proxy,id,new JSONObject().put("ok",true),null); break;
                }
                default: reply(proxy,id,null,"Unsupported Android action.");
            }
        } catch (Exception unavailable) { reply(proxy,id,null,unavailable instanceof IllegalStateException && unavailable.getMessage() != null ? unavailable.getMessage() : "Android could not complete this action. Check app permissions and try again."); }
    }
    private void notificationPermission() { if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},101); }
    private void personnelPermissionSetup() {
        if (!resumed || permissionSetupRunning) return;
        permissionSetupRunning = true;
        AlarmSettings.prefs(this).edit().putBoolean("duty_setup_shown",true).apply();
        new AlertDialog.Builder(this).setTitle("Duty location & emergency alerts")
            .setMessage("GSAM shares your location with approved operators only after you start duty, including while the screen is locked. End duty stops tracking. High and critical alerts use full alarm volume even with a silent ringer. Android notification permission and DND alarm exceptions are still required.")
            .setPositiveButton("Set up permissions",(dialog,which) -> {
                if (!LocationShareService.permitted(this)) requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},106);
                else setupNotificationPermission();
            }).setNegativeButton("Not now",(dialog,which)->permissionSetupRunning=false)
            .setOnCancelListener(dialog->permissionSetupRunning=false).show();
    }
    private void setupNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},107);
        else setupBackgroundPermission();
    }
    private void setupBackgroundPermission() {
        permissionSetupRunning=false;
        if (!LocationShareService.permitted(this) || Build.VERSION.SDK_INT < 29 || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED) { setupAlarmPermission(); return; }
        String option = Build.VERSION.SDK_INT >= 30 ? getPackageManager().getBackgroundPermissionOptionLabel().toString() : "Allow all the time";
        new AlertDialog.Builder(this).setTitle("Location while on duty")
            .setMessage("For background duty location, choose Permissions → Location → " + option + ". Location is still sent only during an active duty session. You can keep using the inbox if you decline.")
            .setPositiveButton("Open location permission",(dialog,which)->{
                if (Build.VERSION.SDK_INT==29) requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},108);
                else { pendingAlarmSetup=true; startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.parse("package:"+getPackageName()))); }
            }).setNegativeButton("Not now",(dialog,which)->setupAlarmPermission()).show();
    }
    private void setupAlarmPermission() {
        if (!resumed) { pendingAlarmSetup=true; return; }
        android.app.NotificationManager manager=getSystemService(android.app.NotificationManager.class);
        AlarmSettings.channels(this);
        if (!manager.isNotificationPolicyAccessGranted()) {
            new AlertDialog.Builder(this).setTitle("Emergency alarm permissions")
                .setMessage("Allow GSAM Do Not Disturb access, then allow alarms and Emergency alerts in the DND modes you use. Emergency alarm volume is enabled automatically. Android still controls these permissions; total-silence modes can block sound.")
                .setPositiveButton("Open alarm permissions",(dialog,which)->startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)))
                .setNegativeButton("Not now",null).show();
        }
        refreshAlarmStatus();
    }
    private void checkLocationPermissions() {
        if (!LocationShareService.permitted(this)) throw new IllegalStateException("Allow location access in Android app settings to share your location.");
        if (!LocationShareService.gpsEnabled(this)) throw new IllegalStateException("Turn on Android Location, then start duty again.");
        if (!getSystemService(android.app.NotificationManager.class).areNotificationsEnabled()) throw new IllegalStateException("Allow notifications so the on-duty indicator and End duty button stay visible.");
    }
    @Override protected void onResume() { super.onResume(); resumed = true; LocationShareService.retryRemoval(this); if (web != null) { web.onResume(); refreshInbox(); refreshLocation(); if(pendingAlarmSetup){pendingAlarmSetup=false;web.post(this::setupAlarmPermission);} } }
    @Override protected void onPause() { resumed = false; if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (current.get()==this) current.clear(); if (locationCallback!=null) locationCallback.invoke(locationOrigin,false,false); web.destroy(); super.onDestroy(); }
}
