package com.quranalsalaf.app.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.util.Arrays;
import java.util.List;

/** سجلّ تحميل القرّاء (DownloadBook): قارئ واحد في كل مرة، والانتظار، والإيقاف، والحفظ والاستعادة. */
public class DownloadBookTest {

    private static final List<String> URLS = Arrays.asList("https://a.com/1.mp3", "https://a.com/2.mp3", "https://a.com/3.mp3", "https://a.com/4.mp3");

    private static JSONObject item(DownloadBook b, String id) {
        return b.toJson().optJSONObject("items").optJSONObject(id);
    }

    @Test
    public void الأول_يبدأ_والثاني_ينتظر_دوره() {
        DownloadBook b = new DownloadBook();
        assertEquals("started", b.enqueue("husary", "الحصري", URLS));
        assertEquals("queued", b.enqueue("afs", "العفاسي", URLS));
        assertEquals("started", b.enqueue("husary", "الحصري", URLS)); // طلبه مرة ثانية لا يغيّر شيئًا
        assertEquals("husary", b.active());
        assertEquals("downloading", item(b, "husary").optString("status"));
        assertEquals("queued", item(b, "afs").optString("status"));
        assertEquals(4, item(b, "afs").optInt("total"));
        assertEquals("afs", b.toJson().optJSONArray("queue").optString(0));
        assertEquals("الحصري", b.nameOf("husary"));

        b.progress("husary", 4, 4);
        b.finish("husary", true);
        assertTrue(b.isDone("husary"));
        assertNull(b.active());
        assertEquals("afs", b.next());
        assertEquals("downloading", item(b, "afs").optString("status"));
        assertEquals(0, b.toJson().optJSONArray("queue").length());
        assertEquals("done", b.enqueue("husary", "الحصري", URLS));
    }

    @Test
    public void الإيقاف_يبقي_ما_حمل_ويخرج_المنتظر() {
        DownloadBook b = new DownloadBook();
        b.enqueue("husary", "الحصري", URLS);
        b.enqueue("afs", "العفاسي", URLS);
        b.progress("husary", 2, 4);
        assertTrue(b.pause("husary"));
        assertEquals("paused", item(b, "husary").optString("status"));
        assertEquals(2, item(b, "husary").optInt("count"));
        assertNull(b.active());
        // المنتظر بلا شيء محمَّل يُزال
        assertFalse(b.pause("afs"));
        assertNull(item(b, "afs"));
        assertNull(b.next());
        // الاستئناف يكمل من العدد نفسه
        assertEquals("started", b.enqueue("husary", "الحصري", URLS));
        assertEquals(2, item(b, "husary").optInt("count"));
    }

    @Test
    public void انقطاع_الاتصال_والتوقف_لسبب_آخر() {
        DownloadBook b = new DownloadBook();
        b.enqueue("husary", "الحصري", URLS);
        b.progress("husary", 1, 4);
        b.setWaiting("husary", true);
        assertTrue(item(b, "husary").optBoolean("waiting"));
        b.finish("husary", false);
        assertEquals("paused", item(b, "husary").optString("status"));
        assertFalse(item(b, "husary").optBoolean("waiting"));
        b.enqueue("a", "أ", URLS);
        b.enqueue("c", "ج", URLS);
        b.pauseAll();
        assertNull(b.active());
        assertNull(b.next());
    }

    @Test
    public void الحفظ_والاستعادة() {
        DownloadBook b = new DownloadBook();
        b.enqueue("husary", "الحصري", URLS);
        b.finish("husary", true);
        b.enqueue("afs", "العفاسي", URLS);
        b.progress("afs", 3, 4);
        b.enqueue("q", "ق", URLS); // منتظر بلا شيء محمَّل: لا يُحفظ
        DownloadBook r = DownloadBook.restore(b.save());
        assertEquals("done", item(r, "husary").optString("status"));
        // الجاري حين أُغلق التطبيق يصير متوقفًا يُستأنف بزرّه
        assertEquals("paused", item(r, "afs").optString("status"));
        assertEquals(3, item(r, "afs").optInt("count"));
        assertNull(item(r, "q"));
        assertNull(r.active());
        assertTrue(DownloadBook.restore("not json").toJson().optJSONObject("items").length() == 0);
        assertTrue(DownloadBook.restore(null).toJson().optJSONObject("items").length() == 0);
    }
}
