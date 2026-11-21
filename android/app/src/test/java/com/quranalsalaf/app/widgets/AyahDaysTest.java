package com.quranalsalaf.app.widgets;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/** ويدجت «آية اليوم» (AyahDays): آية كل يوم بترتيبها من اليوم الثابت، وعودة الدورة، وحجم الخط، ونوع الفتح. */
public class AyahDaysTest {

    private static final String EPOCH = "2026-11-21";

    @Test
    public void رقم_اليوم() {
        assertEquals(0, AyahDays.dayNumber("1970-01-01"));
        assertEquals(1, AyahDays.dayNumber("1970-01-02"));
        // يوم كبيسة، ونهاية سنة
        assertEquals(1, AyahDays.dayNumber("2028-03-01") - AyahDays.dayNumber("2028-02-29"));
        assertEquals(1, AyahDays.dayNumber("2027-01-01") - AyahDays.dayNumber("2026-12-31"));
    }

    @Test
    public void اليوم_الثابت_أول_القائمة_ثم_بالترتيب() {
        assertEquals(0, AyahDays.index(EPOCH, EPOCH, 47));
        assertEquals(1, AyahDays.index("2026-11-22", EPOCH, 47));
        assertEquals(10, AyahDays.index("2026-12-01", EPOCH, 47));
    }

    @Test
    public void تعود_الدورة_بعد_آخرها() {
        // اليوم السابع والأربعون بعد الثابت = أول القائمة من جديد
        assertEquals(46, AyahDays.index("2027-01-06", EPOCH, 47));
        assertEquals(0, AyahDays.index("2027-01-07", EPOCH, 47));
        // وقبل اليوم الثابت (ساعة جهاز مضبوطة على تاريخ قديم): بالعكس من آخرها
        assertEquals(46, AyahDays.index("2026-11-20", EPOCH, 47));
    }

    @Test
    public void حجم_الخط_أكبر_ما_يسع() {
        // يسع ما كان ١٦ فأصغر
        assertEquals(16f, AyahDays.fitSize(24, 8, 0.5f, (s) -> s <= 16), 0.001);
        // يسع الأكبر نفسه
        assertEquals(24f, AyahDays.fitSize(24, 8, 0.5f, (s) -> true), 0.001);
        // لا يسع شيء: الأصغر (ويُصغَّر الرسم كله ليظهر كاملًا)
        assertEquals(8f, AyahDays.fitSize(24, 8, 0.5f, (s) -> false), 0.001);
    }

    @Test
    public void نوع_الفتح() {
        assertEquals("ayah:6094", AyahDays.openType(6094));
    }
}
