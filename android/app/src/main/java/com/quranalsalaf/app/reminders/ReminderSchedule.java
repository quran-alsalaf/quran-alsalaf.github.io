package com.quranalsalaf.app.reminders;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * حساب مواعيد تذكير الختمة (الجلسة ٣ أ، ٢٠٢٦-١١-٢٠) — بلا أندرويد، فيُختبر وحده (ReminderScheduleTest).
 *
 * الصفحة (src/lib/reminders.js) ترسل إشعارات كل ختمة بيومها ووقتها المحليين: { day: "YYYY-MM-DD", time: "HH:MM" }،
 * ولحظة الإشعار تُحسب هنا بمنطقة الجهاز الزمنية عند الجدولة. فإن تغيّرت المنطقة أو ساعة الجهاز أُعيد الحساب
 * (ReminderBootReceiver)، فيبقى الإشعار على وقته المحلي.
 */
public final class ReminderSchedule {

    /** نوعا الختمة اللذان لهما تذكير. */
    public static final String[] TYPES = { "wird", "hifz" };
    /** أكثر عدد من الإشعارات المجدولة لكل نوع (والصفحة ترسل ٣٠ يومًا). */
    public static final int MAX_ITEMS = 40;

    private ReminderSchedule() {}

    /** رقم النوع (١ للورد، ٢ للحفظ)، أو ٠ إن لم يكن نوعًا معروفًا. */
    public static int typeIndex(String type) {
        for (int i = 0; i < TYPES.length; i++) if (TYPES[i].equals(type)) return i + 1;
        return 0;
    }

    /** رقم الطلب المميِّز لإشعار i من نوع: لا يتداخل نوعان. */
    public static int requestCode(String type, int i) {
        return typeIndex(type) * 1000 + i;
    }

    /** لحظة الإشعار (بالملّي ثانية) ليوم ووقت محليين في منطقة tz، أو -١ إن كان أحدهما غير صحيح. */
    public static long triggerAt(String day, String time, TimeZone tz) {
        if (day == null || time == null || !day.matches("\\d{4}-\\d{2}-\\d{2}") || !time.matches("\\d{2}:\\d{2}")) return -1;
        int y = Integer.parseInt(day.substring(0, 4));
        int mo = Integer.parseInt(day.substring(5, 7));
        int d = Integer.parseInt(day.substring(8, 10));
        int h = Integer.parseInt(time.substring(0, 2));
        int mi = Integer.parseInt(time.substring(3, 5));
        if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return -1;
        Calendar c = Calendar.getInstance(tz);
        c.clear();
        c.set(y, mo - 1, d, h, mi, 0);
        long at = c.getTimeInMillis();
        // يوم لا وجود له (٣١ من شهر ثلاثيني) ينقلب إلى الشهر التالي فيُرفض. أما ساعة يقفزها التوقيت الصيفي
        // فتصير بعدها في اليوم نفسه
        if (c.get(Calendar.YEAR) != y || c.get(Calendar.MONTH) != mo - 1 || c.get(Calendar.DAY_OF_MONTH) != d) return -1;
        return at;
    }
}
