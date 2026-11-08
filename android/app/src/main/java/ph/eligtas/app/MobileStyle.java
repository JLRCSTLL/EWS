package ph.eligtas.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.widget.Button;

/** Shared, readable native surfaces for cached alerts and connection recovery. */
final class MobileStyle {
    static final int BACKGROUND = 0xff161616;
    static final int INK = 0xfff5f5f5;
    static final int MUTED = 0xffbdbdbd;
    static final int ACCENT = 0xffdedede;
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
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(primary ? 0x28000000 : 0x18ffffff),
            surface(context, primary ? ACCENT : 0xff2b2b2b, 28, primary ? 0xffeeeeee : 0xff484848), null));
        button.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}},
            new int[]{0xff888888, primary ? 0xff161616 : INK}));
        button.setElevation(0);
    }
}
