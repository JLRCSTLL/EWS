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
    static void refreshInbox() {
        MainActivity activity = current.get();
        if (activity != null) activity.runOnUiThread(() -> {
            if (activity.trusted(activity.web.getUrl())) activity.web.evaluateJavascript("window.dispatchEvent(new Event('eligtas-native-alert'))", null);
        });
    }
    private boolean trusted(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value), app = Uri.parse(BuildConfig.APP_ORIGIN);
        return "https".equals(uri.getScheme()) && app.getHost().equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved); current = new WeakReference<>(this);
        if (EmergencyAlarmService.activeId.isEmpty()) AlarmSettings.restoreVolume(this);
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
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request,permissions,results);
        if (request == 100 && locationCallback != null) { locationCallback.invoke(locationOrigin,checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED,false); locationCallback = null; }
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
                        stopService(new Intent(this,EmergencyAlarmService.class));
                        AlarmSettings.prefs(this).edit().putString("user",user).remove("seen").putBoolean("enabled",false).putBoolean("max_volume",false).apply();
                    }
                    reply(proxy,id,AlarmSettings.status(this),null); break;
                }
                case "status": reply(proxy,id,AlarmSettings.status(this),null); break;
                case "configure": {
                    if (request.has("enabled")) { boolean enabled = request.getBoolean("enabled"); AlarmSettings.prefs(this).edit().putBoolean("enabled",enabled).apply(); if (!enabled) stopService(new Intent(this,EmergencyAlarmService.class)); else notificationPermission(); }
                    if (request.has("maxVolume")) AlarmSettings.prefs(this).edit().putBoolean("max_volume",request.getBoolean("maxVolume")).apply();
                    reply(proxy,id,AlarmSettings.status(this),null); break;
                }
                case "notifications": notificationPermission(); if (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED) startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "channel": startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,AlarmSettings.EMERGENCY)); reply(proxy,id,AlarmSettings.status(this),null); break;
                case "dnd": startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)); reply(proxy,id,AlarmSettings.status(this),null); break;
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
                        .put("body","TEST ONLY — E-Ligtas alarm sound check. No message was sent.").put("priority","critical").put("createdAt",Instant.now().toString()).put("test",true);
                    reply(proxy,id,new JSONObject().put("playing",AlertDelivery.deliver(this,alert,true)),null); break;
                }
                case "stop": stopService(new Intent(this,EmergencyAlarmService.class)); reply(proxy,id,new JSONObject().put("ok",true),null); break;
                case "logout": {
                    stopService(new Intent(this,EmergencyAlarmService.class));
                    AlarmSettings.prefs(this).edit().remove("user").remove("seen").putBoolean("enabled",false).putBoolean("max_volume",false).apply();
                    if (BuildConfig.PUSH_CONFIGURED) { FirebaseMessaging.getInstance().setAutoInitEnabled(false); FirebaseMessaging.getInstance().deleteToken(); }
                    getSystemService(android.app.NotificationManager.class).cancelAll();
                    reply(proxy,id,new JSONObject().put("ok",true),null); break;
                }
                default: reply(proxy,id,null,"Unsupported Android action.");
            }
        } catch (Exception unavailable) { reply(proxy,id,null,"Android could not complete this action. Check app permissions and try again."); }
    }
    private void notificationPermission() { if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},101); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); refreshInbox(); } }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (current.get()==this) current.clear(); if (locationCallback!=null) locationCallback.invoke(locationOrigin,false,false); web.destroy(); super.onDestroy(); }
}
