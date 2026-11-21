package com.quranalsalaf.app.widgets;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

/** ويدجت «ختمتي اليوم» (WidgetDays): يوم الجهاز المحلي، ومنتصف الليل التالي، وما يُعرض، والألوان. */
public class WidgetDaysTest {

    private static final TimeZone RIYADH = TimeZone.getTimeZone("Asia/Riyadh");
    private static final TimeZone UTC = TimeZone.getTimeZone("UTC");

    private static long utc(int y, int mo, int d, int h, int mi) {
        Calendar c = Calendar.getInstance(UTC);
        c.clear();
        c.set(y, mo - 1, d, h, mi, 0);
        return c.getTimeInMillis();
    }

    private static JSONObject data(String... days) throws Exception {
        JSONArray list = new JSONArray();
        for (String d : days) list.put(new JSONObject().put("day", d).put("wird", new JSONObject().put("line", d)));
        return new JSONObject().put("theme", new JSONObject()).put("days", list);
    }

    @Test
    public void اليوم_بمنطقة_الجهاز() {
        // ٩:٣٠ م بتوقيت غرينتش = ١٢:٣٠ ص من اليوم التالي في الرياض
        long t = utc(2026, 11, 21, 21, 30);
        assertEquals("2026-11-21", WidgetDays.dayKey(t, UTC));
        assertEquals("2026-11-22", WidgetDays.dayKey(t, RIYADH));
    }

    @Test
    public void منتصف_الليل_التالي() {
        long t = utc(2026, 11, 21, 10, 0); // ١:٠٠ م في الرياض
        assertEquals(utc(2026, 11, 21, 21, 0), WidgetDays.nextMidnight(t, RIYADH)); // ١٢:٠٠ ص من ٢٢ في الرياض
        // آخر الشهر والسنة
        assertEquals(utc(2027, 1, 1, 0, 0), WidgetDays.nextMidnight(utc(2026, 12, 31, 23, 59), UTC));
        // ومن منتصف الليل نفسه: الذي بعده
        assertEquals(utc(2026, 11, 23, 0, 0), WidgetDays.nextMidnight(utc(2026, 11, 22, 0, 0), UTC));
    }

    @Test
    public void منتصف_الليل_في_يوم_التوقيت_الصيفي() {
        TimeZone ny = TimeZone.getTimeZone("America/New_York");
        Calendar c = Calendar.getInstance(ny);
        c.clear();
        c.set(2026, Calendar.MARCH, 8, 12, 0, 0); // يوم يقفز فيه التوقيت ساعة
        long next = WidgetDays.nextMidnight(c.getTimeInMillis(), ny);
        assertEquals("2026-03-09", WidgetDays.dayKey(next, ny));
        assertEquals("2026-03-08", WidgetDays.dayKey(next - 1, ny));
    }

    @Test
    public void ما_يعرض() throws Exception {
        assertEquals(WidgetDays.Kind.EMPTY, WidgetDays.kind(null, "2026-11-21"));
        assertEquals(WidgetDays.Kind.EMPTY, WidgetDays.kind(data(), "2026-11-21"));
        JSONObject d = data("2026-11-21", "2026-11-22");
        assertEquals(WidgetDays.Kind.DAY, WidgetDays.kind(d, "2026-11-21"));
        assertEquals("2026-11-22", WidgetDays.dayOf(d, "2026-11-22").getJSONObject("wird").getString("line"));
        // بعد الأيام المرسلة، أو قبلها (ساعة الجهاز رجعت): «افتح التطبيق»
        assertEquals(WidgetDays.Kind.STALE, WidgetDays.kind(d, "2026-11-23"));
        assertEquals(WidgetDays.Kind.STALE, WidgetDays.kind(d, "2026-11-20"));
        assertNull(WidgetDays.dayOf(d, null));
    }

    @Test
    public void الالوان() {
        assertEquals(0xFFF5EDDC, WidgetDays.parseColor("#F5EDDC", 0));
        assertEquals(0xFF8a6110, WidgetDays.parseColor(" #8a6110 ", 0));
        assertEquals(0x80112233, WidgetDays.parseColor("#80112233", 0));
        assertEquals(7, WidgetDays.parseColor("rgb(1,2,3)", 7));
        assertEquals(7, WidgetDays.parseColor(null, 7));
        assertEquals(0x40112233, WidgetDays.withAlpha(0xFF112233, 0x40));
    }
}
