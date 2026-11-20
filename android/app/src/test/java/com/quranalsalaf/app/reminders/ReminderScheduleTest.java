package com.quranalsalaf.app.reminders;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

/** مواعيد تذكير الختمة (ReminderSchedule): الوقت المحلي بمنطقة الجهاز، ورفض ما لا يصح. */
public class ReminderScheduleTest {

    private static final TimeZone RIYADH = TimeZone.getTimeZone("Asia/Riyadh");
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    @Test
    public void اللحظة_بالوقت_المحلي() {
        Calendar c = Calendar.getInstance(UTC);
        c.clear();
        c.set(2026, Calendar.NOVEMBER, 21, 17, 30, 0); // ٨:٣٠ م في الرياض = ٥:٣٠ م بتوقيت غرينتش
        assertEquals(c.getTimeInMillis(), ReminderSchedule.triggerAt("2026-11-21", "20:30", RIYADH));
        assertEquals(c.getTimeInMillis(), ReminderSchedule.triggerAt("2026-11-21", "17:30", UTC));
    }

    @Test
    public void اليوم_التالي_بعد_يوم_كامل() {
        long a = ReminderSchedule.triggerAt("2026-11-30", "05:00", RIYADH);
        long b = ReminderSchedule.triggerAt("2026-12-01", "05:00", RIYADH);
        assertEquals(24 * 60 * 60 * 1000L, b - a);
    }

    @Test
    public void ما_لا_يصح_يرفض() {
        assertEquals(-1, ReminderSchedule.triggerAt("2026-11-31", "20:00", RIYADH));
        assertEquals(-1, ReminderSchedule.triggerAt("2026-02-30", "20:00", RIYADH));
        assertEquals(-1, ReminderSchedule.triggerAt("2026-11-21", "24:00", RIYADH));
        assertEquals(-1, ReminderSchedule.triggerAt("2026-11-21", "8:00", RIYADH));
        assertEquals(-1, ReminderSchedule.triggerAt(null, "20:00", RIYADH));
        assertEquals(-1, ReminderSchedule.triggerAt("2026-11-21", null, RIYADH));
    }

    @Test
    public void ساعة_يقفزها_التوقيت_الصيفي_تبقى_في_يومها() {
        TimeZone ny = TimeZone.getTimeZone("America/New_York");
        // ٢:٣٠ ص لا وجود لها في ٨ مارس ٢٠٢٦ بنيويورك
        long at = ReminderSchedule.triggerAt("2026-03-08", "02:30", ny);
        assertNotEquals(-1, at);
        Calendar c = Calendar.getInstance(ny);
        c.setTimeInMillis(at);
        assertEquals(8, c.get(Calendar.DAY_OF_MONTH));
    }

    @Test
    public void ارقام_الطلبات_لا_تتداخل_بين_النوعين() {
        assertEquals(1, ReminderSchedule.typeIndex("wird"));
        assertEquals(2, ReminderSchedule.typeIndex("hifz"));
        assertEquals(0, ReminderSchedule.typeIndex("tadabbur"));
        assertEquals(0, ReminderSchedule.typeIndex(null));
        int lastWird = ReminderSchedule.requestCode("wird", ReminderSchedule.MAX_ITEMS - 1);
        int firstHifz = ReminderSchedule.requestCode("hifz", 0);
        assertEquals(true, lastWird < firstHifz);
    }
}
