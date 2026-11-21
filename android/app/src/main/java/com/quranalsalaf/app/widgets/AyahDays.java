package com.quranalsalaf.app.widgets;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * حساب ما يعرضه ويدجت «آية اليوم» (الجلسة ٣ ج ٢، ٢٠٢٦-١١-٢١) — بلا أندرويد، فيُختبر وحده (AyahDaysTest).
 *
 *   • آية كل يوم بترتيبها في القائمة الثابتة (res/raw/ayah_of_day.json) من يوم ثابت (epoch فيها)، فيرى كل المستخدمين
 *     الآية نفسها في اليوم نفسه، وتعود الدورة بعد آخرها. كـ ayahIndex في src/lib/ayahOfDay.js.
 *   • أكبر خط تظهر به الآية كاملة في مساحة الويدجت (fitSize)، فتصغر آية الكرسي وحدها.
 */
public final class AyahDays {

    private static final long DAY_MS = 24L * 60 * 60 * 1000;
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    private AyahDays() {}

    /** رقم يوم «YYYY-MM-DD» (أيام منذ ١٩٧٠-٠١-٠١) بلا أثر للمنطقة الزمنية. */
    public static long dayNumber(String day) {
        String[] p = day.split("-");
        Calendar c = Calendar.getInstance(UTC);
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
        return Math.round(c.getTimeInMillis() / (double) DAY_MS);
    }

    /** موضع آية يوم day في قائمة من count آية: ٠ يوم epoch، ثم بالترتيب، وتعود الدورة بعد آخرها (وقبله بالعكس). */
    public static int index(String day, String epoch, int count) {
        if (count <= 0) return 0;
        long k = (dayNumber(day) - dayNumber(epoch)) % count;
        return (int) (k < 0 ? k + count : k);
    }

    /** نوع حدث «open» عند الضغط على الويدجت: يفتح صفحة آية حفص h (من ٠) ويميّزها — parseAyahOpen في الصفحة. */
    public static String openType(int h) {
        return "ayah:" + h;
    }

    /** هل تسع المساحةُ النصَّ بهذا الحجم؟ */
    public interface Fits {
        boolean at(float size);
    }

    /** أكبر حجم من max نزولًا بخطوة step تسع به المساحة النص، وإلا min (فيُصغَّر الرسم كله ليظهر كاملًا). */
    public static float fitSize(float max, float min, float step, Fits fits) {
        for (float s = max; s > min; s -= step) {
            if (fits.at(s)) return s;
        }
        return min;
    }
}
