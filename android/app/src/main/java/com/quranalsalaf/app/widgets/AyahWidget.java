package com.quranalsalaf.app.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.content.res.ResourcesCompat;

import com.quranalsalaf.app.R;
import com.quranalsalaf.app.reminders.ReminderAlarms;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.TimeZone;

/**
 * ويدجت «آية اليوم» على الشاشة الرئيسية (الجلسة ٣ ج ٢، ٢٠٢٦-١١-٢١).
 *
 *   • آية كل يوم من قائمة ثابتة من ٤٧ آية (src/data/ayahOfDay.js)، مبنية مع التطبيق بنصّي المصحفين وخطّيهما
 *     (scripts/data/18-ayah-of-day.mjs ← res/raw/ayah_of_day.json وres/font/ayah_hafs.ttf وayah_warsh.ttf)، فلا
 *     يحتاج فتح التطبيق؛ ويتبدّل عند منتصف الليل والتطبيق مغلق (منبّه غير موقظ، كـ KhatmaWidget).
 *   • الآية بخط المصحف وتشكيله وعلامات نهاية آياتها (وفي ورش برسمه وترقيمه)، تُرسم صورةً لأن الويدجت لا يقبل
 *     الخطوط الخاصة، بأكبر خط تظهر به كاملة (فتصغر آية الكرسي)؛ وتحتها «سورة الشرح · ٥–٦».
 *   • الألوان والرواية من التطبيق (QuranWidgetsPlugin.setAyah ← syncAyahWidget في src/lib/widgets.js)، وقبل أول
 *     فتح: المظهر الافتراضي وحفص.
 *   • الضغط يفتح التطبيق على صفحة الآية ويميّزها (ReminderAlarms.EXTRA_OPEN = «ayah:رقم آية حفص» ← حدث «open»).
 *   • مقاسه ٤×٢ ويُغيَّر، وفي المقاس الصغير يختفي العنوان كـ «ختمتي اليوم».
 */
public class AyahWidget extends AppWidgetProvider {

    static final String ACTION_MIDNIGHT = "com.quranalsalaf.app.widgets.AYAH_MIDNIGHT";
    private static final String PREFS = "quran-widgets";
    private static final String KEY_AYAH = "ayah";
    private static final long WINDOW_MS = 10 * 60 * 1000L;
    private static final int REQ_MIDNIGHT = 320;
    private static final int REQ_OPEN = 330;

    // حجم خط الآية (sp): أكبره للآيات القصيرة، وأصغره قبل أن يُصغَّر الرسم كله
    private static final float MAX_SP = 24f;
    private static final float MIN_SP = 8f;
    private static final float STEP_SP = 0.5f;
    // حدّ حجم الصورة (بايت) على الجوالات كثيفة الشاشة
    private static final int MAX_BITMAP_BYTES = 3 * 1024 * 1024;

    private static JSONObject entries;

    // ---------- الحفظ والتحديث ----------

    /** يحفظ ألوان التطبيق وروايته ({ theme, riwayah }) ويعيد رسم كل ويدجت. */
    static void save(Context c, String json) {
        prefs(c).edit().putString(KEY_AYAH, json).apply();
        updateAll(c);
    }

    /** يعيد رسم كل ويدجت «آية اليوم» على الشاشة، ويجدول تبدّله عند منتصف الليل. */
    public static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, AyahWidget.class));
        for (int id : ids) render(c, m, id);
        if (ids.length > 0) scheduleMidnight(c);
        else cancelMidnight(c);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject settings(Context c) {
        String s = prefs(c).getString(KEY_AYAH, null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    /** القائمة المبنية مع التطبيق: { epoch, entries: [{ h, e, hafs: { text, ref }, warsh: { text, ref } }] } */
    private static synchronized JSONObject entries(Context c) {
        if (entries != null) return entries;
        try (InputStream in = c.getResources().openRawResource(R.raw.ayah_of_day)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            entries = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
        return entries;
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(c, m, id);
        scheduleMidnight(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        render(c, m, id);
    }

    @Override
    public void onDisabled(Context c) {
        cancelMidnight(c);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (intent != null && ACTION_MIDNIGHT.equals(intent.getAction())) {
            updateAll(c);
            return;
        }
        super.onReceive(c, intent);
    }

    // ---------- منتصف الليل ----------

    private static PendingIntent midnightIntent(Context c, int flags) {
        Intent i = new Intent(c, AyahWidget.class).setAction(ACTION_MIDNIGHT);
        return PendingIntent.getBroadcast(c, REQ_MIDNIGHT, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleMidnight(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long at = WidgetDays.nextMidnight(System.currentTimeMillis(), TimeZone.getDefault()) + 1000;
        am.setWindow(AlarmManager.RTC, at, WINDOW_MS, midnightIntent(c, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    private static void cancelMidnight(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = midnightIntent(c, PendingIntent.FLAG_NO_CREATE);
        if (am != null && pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    // ---------- الرسم ----------

    /** فتح التطبيق على صفحة آية حفص h. */
    private static PendingIntent openIntent(Context c, int h) {
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open == null) open = new Intent();
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(ReminderAlarms.EXTRA_OPEN, AyahDays.openType(h));
        return PendingIntent.getActivity(c, REQ_OPEN, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void render(Context c, AppWidgetManager m, int id) {
        JSONObject s = settings(c);
        JSONObject theme = s == null ? null : s.optJSONObject("theme");
        boolean warsh = s != null && "warsh".equals(s.optString("riwayah"));
        int bg = KhatmaWidget.color(theme, "bg", WidgetDays.DEFAULT_BG);
        int ink = KhatmaWidget.color(theme, "ink", WidgetDays.DEFAULT_INK);
        int accent = KhatmaWidget.color(theme, "accent", WidgetDays.DEFAULT_ACCENT);
        int accentText = KhatmaWidget.color(theme, "accentText", accent);
        int muted = WidgetDays.withAlpha(ink, 0xB8);

        // المقاس بالـdp (عمودي الجوال: أقل العرض وأكثر الارتفاع)، كـ «ختمتي اليوم»
        Bundle o = m.getAppWidgetOptions(id);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        boolean small = (h > 0 && h < 110) || (w > 0 && w < 250);
        if (w <= 0) w = 280;
        if (h <= 0) h = 150;

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_ayah);
        v.setInt(R.id.widget_bg, "setColorFilter", bg);
        v.setInt(R.id.widget_bg, "setImageAlpha", 0xF5);
        v.setTextColor(R.id.ayah_title, accentText);
        v.setViewVisibility(R.id.ayah_title, small ? View.GONE : View.VISIBLE);

        JSONObject all = entries(c);
        JSONArray list = all == null ? null : all.optJSONArray("entries");
        JSONObject entry = null;
        if (list != null && list.length() > 0) {
            String today = WidgetDays.dayKey(System.currentTimeMillis(), TimeZone.getDefault());
            entry = list.optJSONObject(AyahDays.index(today, all.optString("epoch", today), list.length()));
        }
        JSONObject shown = entry == null ? null : entry.optJSONObject(warsh ? "warsh" : "hafs");
        if (shown == null) {
            m.updateAppWidget(id, v);
            return;
        }

        // مساحة الآية: المقاس بلا الحواشي (١٦ و١٢dp) والعنوان وسطر السورة
        float footerSp = small ? 11f : 12.5f;
        float availW = w - 32;
        float availH = h - 24 - (small ? 0 : 22) - (footerSp + 8);
        Typeface tf = ResourcesCompat.getFont(c, warsh ? R.font.ayah_warsh : R.font.ayah_hafs);
        Bitmap verse = drawVerse(c, shown.optString("text"), tf, ink, Math.max(availW, 60), Math.max(availH, 24));
        if (verse != null) v.setImageViewBitmap(R.id.ayah_text, verse);
        v.setContentDescription(R.id.ayah_text, entry.optString("e"));

        v.setTextViewText(R.id.ayah_ref, shown.optString("ref"));
        v.setTextColor(R.id.ayah_ref, muted);
        v.setTextViewTextSize(R.id.ayah_ref, TypedValue.COMPLEX_UNIT_SP, footerSp);

        JSONArray hr = entry.optJSONArray("h");
        if (hr != null) v.setOnClickPendingIntent(R.id.widget_root, openIntent(c, hr.optInt(0)));
        m.updateAppWidget(id, v);
    }

    /**
     * الآية صورةً بخطها: أسطر بمحاذاة الوسط من اليمين، بأكبر حجم تسع به المساحة (wDp×hDp) ولا تنقسم كلمة على
     * سطرين؛ وإن لم تسع بأصغر حجم رُسمت به وصغّرها الويدجت كلها (ImageView: fitCenter).
     */
    private static Bitmap drawVerse(Context c, String text, Typeface tf, int color, float wDp, float hDp) {
        if (text == null || text.isEmpty()) return null;
        DisplayMetrics dm = c.getResources().getDisplayMetrics();
        float density = dm.density;
        // حدّ حجم الصورة: تُرسم بكثافة أقل إن كبرت
        float maxDensity = (float) Math.sqrt(MAX_BITMAP_BYTES / 4f / Math.max(1f, wDp * hDp));
        float scale = Math.min(density, maxDensity) / density;
        final int width = Math.max(1, Math.round(wDp * density * scale));
        final float height = hDp * density * scale;
        final float spPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 1, dm) * scale;

        final TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        if (tf != null) p.setTypeface(tf);
        p.setColor(color);
        final String[] words = text.split(" ");

        float size = AyahDays.fitSize(MAX_SP, MIN_SP, STEP_SP, (sp) -> {
            p.setTextSize(sp * spPx);
            for (String word : words) {
                if (p.measureText(word) > width) return false;
            }
            return layout(text, p, width).getHeight() <= height;
        });
        p.setTextSize(size * spPx);
        StaticLayout l = layout(text, p, width);
        Bitmap b = Bitmap.createBitmap(width, Math.max(1, l.getHeight()), Bitmap.Config.ARGB_8888);
        l.draw(new Canvas(b));
        return b;
    }

    private static StaticLayout layout(String text, TextPaint p, int width) {
        return StaticLayout.Builder.obtain(text, 0, text.length(), p, width)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setTextDirection(TextDirectionHeuristics.RTL)
            .setBreakStrategy(Layout.BREAK_STRATEGY_BALANCED)
            .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)
            .setIncludePad(true)
            .build();
    }
}
