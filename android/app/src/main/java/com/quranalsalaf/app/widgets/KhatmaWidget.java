package com.quranalsalaf.app.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.quranalsalaf.app.R;
import com.quranalsalaf.app.reminders.ReminderAlarms;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

/**
 * ويدجت «ختمتي اليوم» على الشاشة الرئيسية (الجلسة ٣ ج ١، ٢٠٢٦-١١-٢١): للعرض فقط، بلا تسجيل منه.
 *
 *   • ختمة الورد: سطر ورد اليوم وعلامة ✓ إن أُتمّ، وشريط ما أُنجز من الختمة. وختمة الحفظ: خطوات اليوم الثلاث
 *     وعلامة ✓ عند ما أُتمّ منها. وبلا ختمة: «ابدأ ختمة».
 *   • حال الأيام القادمة ترسلها الصفحة (QuranWidgetsPlugin ← src/lib/widgets.js) وتُحفظ في ذاكرة التطبيق، فيختار
 *     الويدجت يومه ويتبدّل عند منتصف الليل والتطبيق مغلق (منبّه غير موقظ: إن كانت الشاشة مطفأة تبدّل حين تُضاء).
 *     ومن لم يفتح التطبيق بعد الأيام المرسلة: «افتح التطبيق لتحديث ختمتك».
 *   • الضغط يفتح التطبيق كالضغط على إشعار التذكير (ReminderAlarms.EXTRA_OPEN ← حدث «open» في QuranReminders):
 *     على الورد ← صفحة الورد، وعلى الحفظ أو غيرهما ← تبويب «الختمة».
 *   • ألوانه ألوان التطبيق، وحجمه يُغيَّر، والخط يصغر في المقاس الصغير.
 */
public class KhatmaWidget extends AppWidgetProvider {

    static final String ACTION_MIDNIGHT = "com.quranalsalaf.app.widgets.KHATMA_MIDNIGHT";
    private static final String PREFS = "quran-widgets";
    private static final String KEY_KHATMA = "khatma";
    private static final long WINDOW_MS = 10 * 60 * 1000L;
    private static final int REQ_MIDNIGHT = 300;
    private static final int REQ_OPEN = 310;

    private static final int[] STEP_IDS = { R.id.widget_step1, R.id.widget_step2, R.id.widget_step3 };

    // ---------- الحفظ والتحديث ----------

    /** يحفظ حال الأيام (من الصفحة) ويعيد رسم كل ويدجت. */
    static void save(Context c, String json) {
        prefs(c).edit().putString(KEY_KHATMA, json).apply();
        updateAll(c);
    }

    /** يعيد رسم كل ويدجت «ختمتي اليوم» على الشاشة، ويجدول تبدّله عند منتصف الليل. */
    public static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, KhatmaWidget.class));
        for (int id : ids) render(c, m, id);
        if (ids.length > 0) scheduleMidnight(c);
        else cancelMidnight(c);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject data(Context c) {
        String s = prefs(c).getString(KEY_KHATMA, null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
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
        Intent i = new Intent(c, KhatmaWidget.class).setAction(ACTION_MIDNIGHT);
        return PendingIntent.getBroadcast(c, REQ_MIDNIGHT, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleMidnight(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long at = WidgetDays.nextMidnight(System.currentTimeMillis(), TimeZone.getDefault()) + 1000;
        // غير موقظ (RTC): لا حاجة إلى إيقاظ الجوال لويدجت لا يُرى والشاشة مطفأة
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

    /** فتح التطبيق على type (wird · hifz · khatma). */
    private static PendingIntent openIntent(Context c, String type, int code) {
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open == null) open = new Intent();
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(ReminderAlarms.EXTRA_OPEN, type);
        return PendingIntent.getActivity(c, REQ_OPEN + code, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void render(Context c, AppWidgetManager m, int id) {
        JSONObject data = data(c);
        JSONObject theme = data == null ? null : data.optJSONObject("theme");
        int bg = color(theme, "bg", WidgetDays.DEFAULT_BG);
        int ink = color(theme, "ink", WidgetDays.DEFAULT_INK);
        int accent = color(theme, "accent", WidgetDays.DEFAULT_ACCENT);
        int accentText = color(theme, "accentText", accent);
        int muted = WidgetDays.withAlpha(ink, 0xB8);

        // المقاس: الصغير (ارتفاعه دون ١١٠dp تقريبًا، أو عرضه دون ٢٥٠dp) بخط أصغر وبلا العنوان، والخطوات سطرًا واحدًا
        Bundle o = m.getAppWidgetOptions(id);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        boolean small = (h > 0 && h < 110) || (w > 0 && w < 250);
        float name = small ? 13 : 15;
        float line = small ? 12 : 13.5f;

        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_khatma);
        v.setInt(R.id.widget_bg, "setColorFilter", bg);
        v.setInt(R.id.widget_bg, "setImageAlpha", 0xF5);
        v.setTextColor(R.id.widget_title, accentText);
        v.setViewVisibility(R.id.widget_title, small ? View.GONE : View.VISIBLE);
        v.setOnClickPendingIntent(R.id.widget_root, openIntent(c, "khatma", 0));

        String today = WidgetDays.dayKey(System.currentTimeMillis(), TimeZone.getDefault());
        WidgetDays.Kind kind = WidgetDays.kind(data, today);
        JSONObject day = kind == WidgetDays.Kind.DAY ? WidgetDays.dayOf(data, today) : null;
        JSONObject wird = day == null ? null : day.optJSONObject("wird");
        JSONObject hifz = day == null ? null : day.optJSONObject("hifz");

        // ختمة الورد
        if (wird != null) {
            v.setViewVisibility(R.id.widget_wird, View.VISIBLE);
            text(v, R.id.widget_wird_name, "ختمة الورد", ink, name);
            boolean finished = wird.optBoolean("finished");
            boolean done = wird.optBoolean("done");
            text(v, R.id.widget_wird_line, wird.optString("line"), done || finished ? accentText : muted, line);
            v.setViewVisibility(R.id.widget_wird_check, done ? View.VISIBLE : View.GONE);
            v.setTextColor(R.id.widget_wird_check, accentText);
            if (finished) {
                v.setViewVisibility(R.id.widget_bar, View.GONE);
            } else {
                v.setViewVisibility(R.id.widget_bar, View.VISIBLE);
                v.setInt(R.id.widget_bar_track, "setColorFilter", ink);
                v.setInt(R.id.widget_bar_track, "setImageAlpha", 0x2E);
                v.setInt(R.id.widget_bar_fill, "setColorFilter", accent);
                int percent = Math.max(0, Math.min(100, wird.optInt("percent")));
                v.setInt(R.id.widget_bar_fill, "setImageLevel", percent * 100);
            }
            v.setOnClickPendingIntent(R.id.widget_wird, openIntent(c, "wird", 1));
        } else {
            v.setViewVisibility(R.id.widget_wird, View.GONE);
        }

        // ختمة الحفظ
        if (hifz != null) {
            v.setViewVisibility(R.id.widget_hifz, View.VISIBLE);
            text(v, R.id.widget_hifz_name, "ختمة الحفظ", ink, name);
            JSONArray steps = hifz.optJSONArray("steps");
            boolean finished = hifz.optBoolean("finished") || steps == null;
            v.setViewVisibility(R.id.widget_hifz_check, !finished && hifz.optBoolean("done") ? View.VISIBLE : View.GONE);
            v.setTextColor(R.id.widget_hifz_check, accentText);
            if (finished) {
                text(v, R.id.widget_hifz_inline, hifz.optString("line"), accentText, line);
                v.setViewVisibility(R.id.widget_hifz_inline, View.VISIBLE);
                for (int sid : STEP_IDS) v.setViewVisibility(sid, View.GONE);
            } else if (small) {
                // سطر واحد: «✓ المراجعة البعيدة · ○ حفظ الورد»
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < steps.length(); i++) {
                    JSONObject s = steps.optJSONObject(i);
                    if (s == null) continue;
                    if (sb.length() > 0) sb.append("  ·  ");
                    sb.append(s.optBoolean("done") ? "✓ " : "○ ").append(s.optString("name"));
                }
                text(v, R.id.widget_hifz_inline, sb.toString(), muted, line);
                v.setViewVisibility(R.id.widget_hifz_inline, View.VISIBLE);
                for (int sid : STEP_IDS) v.setViewVisibility(sid, View.GONE);
            } else {
                v.setViewVisibility(R.id.widget_hifz_inline, View.GONE);
                for (int i = 0; i < STEP_IDS.length; i++) {
                    JSONObject s = i < steps.length() ? steps.optJSONObject(i) : null;
                    if (s == null) {
                        v.setViewVisibility(STEP_IDS[i], View.GONE);
                        continue;
                    }
                    boolean sd = s.optBoolean("done");
                    text(v, STEP_IDS[i], (sd ? "✓  " : "○  ") + s.optString("name"), sd ? accentText : muted, line);
                    v.setViewVisibility(STEP_IDS[i], View.VISIBLE);
                }
            }
            v.setOnClickPendingIntent(R.id.widget_hifz, openIntent(c, "hifz", 2));
        } else {
            v.setViewVisibility(R.id.widget_hifz, View.GONE);
        }

        // بلا ختمة، أو انتهت الأيام المرسلة
        if (kind == WidgetDays.Kind.DAY && (wird != null || hifz != null)) {
            v.setViewVisibility(R.id.widget_message, View.GONE);
            v.setViewVisibility(R.id.widget_action, View.GONE);
        } else {
            boolean stale = kind == WidgetDays.Kind.STALE;
            text(v, R.id.widget_message, stale ? "افتح التطبيق لتحديث ختمتك" : "لا ختمة لديك الآن", muted, line);
            text(v, R.id.widget_action, stale ? "فتح التطبيق" : "ابدأ ختمة", accentText, name);
            v.setViewVisibility(R.id.widget_message, View.VISIBLE);
            v.setViewVisibility(R.id.widget_action, View.VISIBLE);
        }

        m.updateAppWidget(id, v);
    }

    private static void text(RemoteViews v, int id, String s, int color, float sp) {
        v.setTextViewText(id, s);
        v.setTextColor(id, color);
        v.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sp);
    }

    static int color(JSONObject theme, String key, int fallback) {
        return theme == null ? fallback : WidgetDays.parseColor(theme.optString(key, null), fallback);
    }
}
