package ph.eligtas.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.widget.Button;

/** Shared, readable native surfaces for cached alerts and connection recovery. */
final class MobileStyle {
    static final int BACKGROUND = 0xfff1f5f4;
    static final int INK = 0xff172d2b;
    static final int MUTED = 0xff576d68;
    static final int ACCENT = 0xff087e71;
    private MobileStyle() {}

    static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    static GradientDrawable surface(Context context, int color, int radius, int border) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(context, radius));
        if (border != 0) drawable.setStroke(dp(context, 1), border);
        return drawable;
    }

    static void button(Button button, boolean primary) {
        Context context = button.getContext();
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        button.setMinHeight(dp(context, 52));
        button.setMinimumHeight(dp(context, 52));
        button.setPadding(dp(context, 20), dp(context, 12), dp(context, 20), dp(context, 12));
        button.setBackgroundTintList(null);
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(primary ? 0x28ffffff : 0x18087e71),
            surface(context, primary ? ACCENT : 0xffe8f1ec, 28, primary ? 0xff087266 : 0xffceddd4), null));
        button.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}},
            new int[]{primary ? 0xffcce1db : MUTED, primary ? 0xffffffff : 0xff225f52}));
        button.setElevation(0);
    }
}
