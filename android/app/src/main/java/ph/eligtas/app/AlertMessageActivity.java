package ph.eligtas.app;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
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
        int pad = (int)(24 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad,pad*2,pad,pad); layout.setBackgroundColor(Color.rgb(22,27,32));
        layout.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(pad,pad+insets.getSystemWindowInsetTop(),pad,pad+insets.getSystemWindowInsetBottom());return insets;});
        setContentView(layout);
        text(layout,"TANOVIQ · COMMAND CENTER",13,0xff44d4bb);
        if (alert == null) { text(layout,"This alert belongs to a previous sign-in or is no longer cached.",20,Color.WHITE); return; }
        text(layout,alert.optString("priority","normal").toUpperCase(java.util.Locale.ROOT)+" ALERT",27,Color.WHITE);
        text(layout,alert.optString("createdAt"),12,0xffb9c4cf);
        ScrollView scroll = new ScrollView(this);
        body = new TextView(this); body.setText(alert.optString("body")); body.setTextSize(21); body.setTextColor(Color.WHITE); body.setTextIsSelectable(true); body.setPadding(0,pad,0,pad);
        scroll.addView(body); layout.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        text(layout,"Silence stops this alarm only. Acknowledge tells the command center you have read the message.",13,0xffb9c4cf);
        Button silence = new Button(this); silence.setText(R.string.silence_alarm); silence.setOnClickListener(v->{AlertActionReceiver.silence(this,alertId);silence.setText(R.string.alarm_silenced);}); layout.addView(silence);
        Button read = new Button(this); read.setText(R.string.acknowledge_message); read.setOnClickListener(v->{AlertActionReceiver.silence(this,alertId);NativeAlertWorker.receipt(this,alert,false,true);read.setText(R.string.acknowledgment_queued);read.setEnabled(false);}); layout.addView(read);
        Button close = new Button(this); close.setText(R.string.close_message); close.setOnClickListener(v->finish()); layout.addView(close);
        NativeAlertWorker.receipt(this,alert,false,false);
    }
    private void text(LinearLayout parent,String value,int size,int color) { TextView view=new TextView(this);view.setText(value);view.setTextSize(size);view.setTextColor(color);parent.addView(view); }
    @Override protected void onStart(){super.onStart();if(body!=null)handler.post(refresh);}
    @Override protected void onStop(){handler.removeCallbacks(refresh);super.onStop();}
}
