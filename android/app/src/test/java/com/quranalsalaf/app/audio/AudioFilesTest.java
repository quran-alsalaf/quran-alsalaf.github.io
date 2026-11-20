package com.quranalsalaf.app.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;

/** مسارات ملفات الصوت المحفوظة على الجهاز (AudioFiles). */
public class AudioFilesTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void ملف_كل_رابط_بمساره_في_الشبكة() {
        assertEquals("everyayah.com/data/Husary_128kbps/001001.mp3", AudioFiles.relPath("https://everyayah.com/data/Husary_128kbps/001001.mp3"));
        assertEquals("server8.mp3quran.net/afs/001.mp3", AudioFiles.relPath("https://Server8.mp3quran.net/afs/001.mp3"));
        // ملف المقطع نفسه بقارئين مختلفين في مجلدين مختلفين
        assertFalse(AudioFiles.relPath("https://everyayah.com/data/A/001001.mp3").equals(AudioFiles.relPath("https://everyayah.com/data/B/001001.mp3")));
    }

    @Test
    public void ما_في_التطبيق_نفسه_والروابط_الغريبة_لا_تحفظ() {
        assertNull(AudioFiles.relPath("https://localhost/audio/warsh/x.mp3"));
        assertNull(AudioFiles.relPath("asset:///public/audio/x.mp3"));
        assertNull(AudioFiles.relPath("file:///etc/passwd"));
        assertNull(AudioFiles.relPath("https://a.com/../../etc/passwd"));
        assertNull(AudioFiles.relPath("https://a.com/"));
        assertNull(AudioFiles.relPath(null));
        assertNull(AudioFiles.relPath("not a url"));
    }

    @Test
    public void الحروف_الغريبة_في_المسار_تستبدل() {
        assertEquals("a.com/x%20y/z.mp3", AudioFiles.relPath("https://a.com/x%20y/z.mp3"));
        assertEquals("a.com/a_b.mp3", AudioFiles.relPath("https://a.com/a:b.mp3"));
    }

    @Test
    public void الناقص_والمحفوظ() throws IOException {
        File root = tmp.newFolder("audio");
        String a = "https://a.com/r/001001.mp3";
        String b = "https://a.com/r/001002.mp3";
        String local = "https://localhost/audio/warsh/1.mp3";
        assertEquals(Arrays.asList(a, b), AudioFiles.missing(root, Arrays.asList(a, b, a, local)));
        write(AudioFiles.fileFor(root, a), 10);
        // ملف فارغ أو ملف ناقص (.part) لا يُعدّ محفوظًا
        write(AudioFiles.fileFor(root, b), 0);
        write(new File(AudioFiles.fileFor(root, b).getPath() + AudioFiles.PART), 10);
        assertEquals(Collections.singletonList(b), AudioFiles.missing(root, Arrays.asList(a, b)));
        assertTrue(AudioFiles.saved(root, a) != null);
        assertNull(AudioFiles.saved(root, b));
        assertFalse(AudioFiles.needs(root, local));
    }

    static void write(File f, int bytes) throws IOException {
        f.getParentFile().mkdirs();
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(new byte[bytes]);
        }
    }
}
