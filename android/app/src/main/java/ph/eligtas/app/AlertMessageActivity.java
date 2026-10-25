package ph.eligtas.app;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;

/** The notification's full message is available without loading the web app. */
public final class AlertMessageActivity extends Activity {
    private String alertId;
    private TextView body;
    private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable refresh=new Runnable(){@Override public void run(){JSONObject saved=AlertStore.get(AlertMessageActivity.this,alertId==null?"":alertId);if(saved==null){finish();return;}if(body!=null&&!body.getText().toString().equals(saved.optString("body")))body.setText(saved.optString("body"));handler.postDelayed(this,1000);}};
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        alertId = getIntent().getStringExtra("alertId");
        JSONObject alert = alertId == null ? null : AlertStore.get(this,alertId);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        int pad = MobileStyle.dp(this,24);
        layout.setPadding(pad,pad*2,pad,pad); layout.setBackgroundColor(MobileStyle.BACKGROUND);
        layout.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(pad,pad+insets.getSystemWindowInsetTop(),pad,pad+insets.getSystemWindowInsetBottom());return insets;});
        setContentView(layout);
        TextView brand = text(layout,"TANOVIQ · COMMAND CENTER",12,MobileStyle.ACCENT); brand.setLetterSpacing(.08f);
        if (alert == null) { text(layout,"This alert belongs to a previous sign-in or is no longer cached.",20,MobileStyle.INK); return; }
        TextView heading = text(layout,"Message from your center",28,MobileStyle.INK); heading.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL)); heading.setPadding(0,MobileStyle.dp(this,14),0,MobileStyle.dp(this,8));
        boolean urgent = AlertPolicy.urgent(alert.optString("priority","normal"));
        TextView priority = text(layout,alert.optString("priority","normal").toUpperCase(java.util.Locale.ROOT)+" PRIORITY",12,urgent?0xffaa382f:MobileStyle.ACCENT);
        priority.setPadding(MobileStyle.dp(this,12),MobileStyle.dp(this,6),MobileStyle.dp(this,12),MobileStyle.dp(this,6));
        priority.setBackground(MobileStyle.surface(this,urgent?0xffffeae5:0xffe4f1e8,20,0));
        priority.setLayoutParams(new LinearLayout.LayoutParams(-2,-2));
        String created = alert.optString("createdAt");
        try { created = java.time.format.DateTimeFormatter.ofPattern("MMM d, h:mm a",java.util.Locale.getDefault()).withZone(java.time.ZoneId.systemDefault()).format(java.time.Instant.parse(created)); } catch (RuntimeException ignored) {}
        TextView time = text(layout,created,12,MobileStyle.MUTED); time.setPadding(0,MobileStyle.dp(this,8),0,MobileStyle.dp(this,12));
        ScrollView scroll = new ScrollView(this);
        scroll.setBackground(MobileStyle.surface(this,Color.WHITE,24,0xffdce8e2));
        body = new TextView(this); body.setText(alert.optString("body")); body.setTextSize(19); body.setTextColor(MobileStyle.INK); body.setLineSpacing(MobileStyle.dp(this,5),1); body.setTextIsSelectable(true); body.setPadding(pad,pad,pad,pad);
        scroll.addView(body); layout.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        TextView note = text(layout,"Silence stops this alarm only. Acknowledge tells the command center you have read the message.",12,MobileStyle.MUTED); note.setPadding(0,MobileStyle.dp(this,14),0,MobileStyle.dp(this,6));
        Button silence = action(layout,R.string.silence_alarm,false); silence.setOnClickListener(v->{AlertActionReceiver.silence(this,alertId);silence.setText(R.string.alarm_silenced);});
        Button read = action(layout,R.string.acknowledge_message,true); read.setOnClickListener(v->{AlertActionReceiver.silence(this,alertId);NativeAlertWorker.receipt(this,alert,false,true);read.setText(R.string.acknowledgment_queued);read.setEnabled(false);});
        Button close = action(layout,R.string.close_message,false); close.setOnClickListener(v->finish());
        NativeAlertWorker.receipt(this,alert,false,false);
    }
    private TextView text(LinearLayout parent,String value,int size,int color) { TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);parent.addView(view);return view; }
    private Button action(LinearLayout parent,int label,boolean primary) { Button button=new Button(this);button.setText(label);MobileStyle.button(button,primary);LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.topMargin=MobileStyle.dp(this,8);parent.addView(button,params);return button; }
    @Override protected void onStart(){super.onStart();if(body!=null)handler.post(refresh);}
    @Override protected void onStop(){handler.removeCallbacks(refresh);super.onStop();}
}
