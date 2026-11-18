package com.quranalsalaf.app.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * ترتيب التلاوة في مشغّل أندرويد (Sequencer) يطابق مشغّل الموقع: الحالات نفسها التي يُختبر بها الموقع
 * (tests/fixtures/sequence.json، من tests/unit/sequence.test.js)، ثم ما لا يظهر في قرّاء حفص (المقطع ذو الملفين).
 */
public class SequencerTest {

    /** الحالات المشتركة: يعمل الاختبار في android/app، والملف في جذر المستودع. */
    private static JSONObject fixture() throws Exception {
        File f = new File("../../tests/fixtures/sequence.json");
        return new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
    }

    private static List<String> play(Sequencer s, int limit, JSONObject skipAt) {
        List<String> out = new ArrayList<>();
        Sequencer.Cursor c = s.start(0, 0, 0, true);
        for (int i = 0; i < limit && c != null; i++) {
            out.add(s.file(c));
            String k = String.valueOf(i);
            c = skipAt != null && skipAt.has(k) ? s.skip(c, skipAt.optInt(k)) : s.advance(c);
        }
        return out;
    }

    @Test
    public void matchesWebPlayer() throws Exception {
        JSONArray cases = fixture().getJSONArray("cases");
        assertTrue(cases.length() >= 9);
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            JSONArray its = c.getJSONArray("items");
            List<Sequencer.Item> items = new ArrayList<>();
            for (int k = 0; k < its.length(); k++) {
                JSONObject it = its.getJSONObject(k);
                JSONArray f = it.getJSONArray("f");
                String[] files = new String[f.length()];
                for (int j = 0; j < files.length; j++) files[j] = f.getString(j);
                items.add(new Sequencer.Item(files, it.isNull("b") ? null : it.getString("b")));
            }
            Sequencer s = new Sequencer(items, c.getInt("verseRepeat"), c.getInt("rangeRepeat"), c.getBoolean("continuous"));
            JSONArray exp = c.getJSONArray("expected");
            List<String> expected = new ArrayList<>();
            for (int k = 0; k < exp.length(); k++) expected.add(exp.getString(k));
            assertEquals(c.getString("name"), expected, play(s, c.getInt("limit"), c.getJSONObject("skipAt")));
        }
    }

    // آية ورش في ملفين (من ملفات حفص): يُقرآن متتاليين، والتكرار يعيدهما معًا بلا بسملة
    @Test
    public void multiFileVerse() {
        List<Sequencer.Item> items = Arrays.asList(
            new Sequencer.Item(new String[] {"a1", "a2"}, "B"),
            new Sequencer.Item(new String[] {"b"}, null));
        Sequencer s = new Sequencer(items, 2, 1, false);
        assertEquals(Arrays.asList("B", "a1", "a2", "a1", "a2", "b", "b"), play(s, 50, null));
    }

    // مؤقّت التلاوة يُفحص عند نهاية الآية وحدها: لا بعد البسملة، ولا بين ملفَّي الآية
    @Test
    public void endsVerse() {
        List<Sequencer.Item> items = Arrays.asList(new Sequencer.Item(new String[] {"a1", "a2"}, "B"));
        Sequencer s = new Sequencer(items, 1, 1, false);
        Sequencer.Cursor c = s.start(0, 0, 0, true);
        assertTrue(c.isBasmala());
        assertFalse(s.endsVerse(c));
        c = s.advance(c);
        assertFalse(s.endsVerse(c));
        c = s.advance(c);
        assertTrue(s.endsVerse(c));
        assertNull(s.advance(c));
    }

    // تغيّر التكرار أثناء التلاوة يسري من نهاية الجاري (setOptions)
    @Test
    public void optionsChangeMidway() {
        List<Sequencer.Item> items = Arrays.asList(new Sequencer.Item(new String[] {"a"}, null), new Sequencer.Item(new String[] {"b"}, null));
        Sequencer s = new Sequencer(items, 1, 1, false);
        Sequencer.Cursor c = s.start(0, 0, 0, true);
        s.verseRepeat = 3;
        c = s.advance(c);
        assertEquals("a", s.file(c));
        assertEquals(1, c.verseRep);
        s.rangeRepeat = Sequencer.FOREVER;
        c = s.advance(s.advance(s.advance(s.advance(c))));
        assertEquals("b", s.file(c));
        // بلا نهاية: يعود إلى أول المقدار ولا يُعدّ التكرار (كما في الموقع)
        c = s.advance(c);
        assertEquals("a", s.file(c));
        assertEquals(0, c.rangeRep);
        s.rangeRepeat = 1;
        assertNull(s.advance(s.advance(s.advance(s.advance(s.advance(s.advance(c)))))));
    }
}
