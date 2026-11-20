package com.quranalsalaf.app.audio;

import java.io.File;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * ملفات الصوت المحفوظة على الجهاز (الجلسة ٢ ب من التطبيق الأصلي، ٢٠٢٦-١١-٢٠).
 *
 * كل ملف آية يُحفظ في ذاكرة التطبيق الداخلية (files/audio) بمسار رابطه في الشبكة نفسه:
 *   https://everyayah.com/data/Husary_128kbps/001001.mp3 ← files/audio/everyayah.com/data/Husary_128kbps/001001.mp3
 * فملفات القارئ كلها في مجلد واحد، سواء جاءت من تحميله لكامل القرآن أو من «تنزيل» مقدار، ولا يُحمَّل الملف مرتين.
 * والمشغّل (AudioEngine.uri) يقرأ الآية من هنا إن وُجدت، وإلا بثّها.
 *
 * لا حذف لما حُمِّل (بقرار صاحب المشروع). وتُحذف كلها إذا حُذف التطبيق.
 * لا يعتمد على أندرويد، فيُختبر وحده (AudioFilesTest).
 */
public final class AudioFiles {

    /** امتداد الملف أثناء تحميله: لا يُعدّ محفوظًا حتى يكتمل ويُعاد تسميته. */
    public static final String PART = ".part";

    private AudioFiles() {
    }

    /**
     * المسار النسبي لملف الرابط، أو null إن لم يكن رابطًا يُحفظ: ما في التطبيق نفسه (https://localhost، مقاطع ورش
     * المبنية معه) أو رابط غير صالح أو فيه «..».
     */
    public static String relPath(String url) {
        if (url == null) return null;
        URI u;
        try {
            u = new URI(url);
        } catch (Exception e) {
            return null;
        }
        String scheme = u.getScheme();
        String host = u.getHost();
        String path = u.getRawPath();
        if (scheme == null || !(scheme.equals("https") || scheme.equals("http"))) return null;
        if (host == null || host.isEmpty() || host.equals("localhost")) return null;
        if (path == null || path.isEmpty() || path.endsWith("/")) return null;
        StringBuilder out = new StringBuilder(safe(host.toLowerCase()));
        for (String part : path.split("/")) {
            if (part.isEmpty()) continue;
            if (part.equals(".") || part.equals("..")) return null;
            out.append('/').append(safe(part));
        }
        return out.toString();
    }

    private static String safe(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '_' || c == '%';
            b.append(ok ? c : '_');
        }
        return b.toString();
    }

    /** ملف الرابط تحت root (موجودًا أو لا)، أو null إن لم يكن رابطًا يُحفظ. */
    public static File fileFor(File root, String url) {
        String rel = relPath(url);
        return rel == null ? null : new File(root, rel);
    }

    /** الملف المحفوظ للرابط إن اكتمل تحميله، وإلا null. */
    public static File saved(File root, String url) {
        File f = fileFor(root, url);
        return f != null && f.isFile() && f.length() > 0 ? f : null;
    }

    /** هل يحتاج الرابط تحميلًا؟ (ما لا يُحفظ — ما في التطبيق نفسه — لا يحتاجه) */
    public static boolean needs(File root, String url) {
        return fileFor(root, url) != null && saved(root, url) == null;
    }

    /** الروابط التي لم تُحفظ بعد، بترتيبها وبلا تكرار. */
    public static List<String> missing(File root, List<String> urls) {
        List<String> out = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (String url : urls) {
            if (seen.add(url) && needs(root, url)) out.add(url);
        }
        return out;
    }
}
