package com.quranalsalaf.app.widgets;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;

/**
 * حساب ما يعرضه ويدجت «ختمتي اليوم» (الجلسة ٣ ج ١، ٢٠٢٦-١١-٢١) — بلا أندرويد، فيُختبر وحده (WidgetDaysTest).
 *
 * الصفحة (src/lib/widgets.js) ترسل حال الأيام القادمة: { theme, days: [{ day: "YYYY-MM-DD", wird, hifz }] }،
 * والويدجت يختار منها يوم الجهاز المحلي، ويتبدّل عند منتصف الليل (KhatmaWidget).
 */
public final class WidgetDays {

    /** ما يُعرض: لا ختمة (ابدأ ختمة)، أو انتهت الأيام المرسلة (افتح التطبيق)، أو يوم. */
    public enum Kind { EMPTY, STALE, DAY }

    private WidgetDays() {}

    /** «YYYY-MM-DD» ليوم اللحظة now في منطقة tz. */
    public static String dayKey(long now, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(now);
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** لحظة منتصف الليل التالي (أول اليوم التالي) بعد now في منطقة tz. */
    public static long nextMidnight(long now, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(now);
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** نوع العرض لحال data (وقد تكون null: لم يُفتح التطبيق بعد). */
    public static Kind kind(JSONObject data, String today) {
        if (data == null) return Kind.EMPTY;
        JSONArray days = data.optJSONArray("days");
        if (days == null || days.length() == 0) return Kind.EMPTY;
        return dayOf(data, today) == null ? Kind.STALE : Kind.DAY;
    }

    /** حال يوم today من data، أو null إن لم يكن فيها. */
    public static JSONObject dayOf(JSONObject data, String today) {
        JSONArray days = data == null ? null : data.optJSONArray("days");
        if (days == null || today == null) return null;
        for (int i = 0; i < days.length(); i++) {
            JSONObject d = days.optJSONObject(i);
            if (d != null && today.equals(d.optString("day"))) return d;
        }
        return null;
    }

    /** لون «#RRGGBB» (أو «#AARRGGBB») عددًا بشفافية كاملة، أو fallback إن لم يصح. */
    public static int parseColor(String hex, int fallback) {
        if (hex == null) return fallback;
        String h = hex.trim();
        if (!h.matches("#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})")) return fallback;
        long v = Long.parseLong(h.substring(1), 16);
        if (h.length() == 7) v |= 0xFF000000L;
        return (int) v;
    }

    /** اللون نفسه بشفافية alpha (٠–٢٥٥). */
    public static int withAlpha(int color, int alpha) {
        return (color & 0x00FFFFFF) | ((alpha & 0xFF) << 24);
    }
}
