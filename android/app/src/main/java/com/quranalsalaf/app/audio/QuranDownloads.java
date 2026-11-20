package com.quranalsalaf.app.audio;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;

import org.json.JSONObject;

import java.io.File;
import java.util.List;

/**
 * تحميل صوت القرّاء لكامل القرآن داخل التطبيق (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠): السجلّ (DownloadBook) محفوظًا على
 * الجهاز، وصلته بالصفحة (QuranDownloadsPlugin) وبخدمة التحميل (QuranDownloadService) التي تحمّل في الخلفية.
 *
 * التحميل يقوم به أندرويد نفسه (بقرار صاحب المشروع)، فيستمر والشاشة مقفلة وبعد إغلاق التطبيق، بإشعار فيه
 * تقدّمه وزرّ «إيقاف». والملفات في ذاكرة التطبيق الداخلية (AudioFiles)، ويقرؤها مشغّل التلاوة بلا إنترنت.
 */
public final class QuranDownloads {

    private static final String TAG = "QuranDownloads";
    private static final String PREFS = "quran-downloads";
    private static final String KEY = "book";
    private static final long EMIT_MS = 250;
    private static final long SAVE_MS = 2000;

    /** ما يُبلَّغ به التطبيق (QuranDownloadsPlugin ← src/lib/nativeFiles.js). */
    public interface Listener {
        void onState(JSONObject state);

        /** انتهى تحميل قارئ: done · paused · offline · failed · nospace · timeout. */
        void onNotice(String id, String name, String result);
    }

    private static QuranDownloads instance;

    /** مجلد ملفات الصوت المحفوظة. */
    public static File root(Context ctx) {
        return new File(ctx.getApplicationContext().getFilesDir(), "audio");
    }

    public static synchronized QuranDownloads get(Context ctx) {
        if (instance == null) instance = new QuranDownloads(ctx.getApplicationContext());
        return instance;
    }

    private final Context app;
    private final SharedPreferences prefs;
    private final DownloadBook book;
    @Nullable
    private Listener listener;
    @Nullable
    private QuranDownloadService service;
    private long lastEmit;
    private long lastSave;

    private QuranDownloads(Context app) {
        this.app = app;
        this.prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.book = DownloadBook.restore(prefs.getString(KEY, null));
    }

    public File root() {
        return root(app);
    }

    public synchronized void setListener(@Nullable Listener l) {
        listener = l;
    }

    synchronized void attach(@Nullable QuranDownloadService s) {
        service = s;
    }

    public synchronized JSONObject state() {
        return book.toJson();
    }

    /** يطلب تحميل القارئ id (urls روابط ملفاته كلها). النتيجة: started · queued · done. */
    public String start(String id, String name, List<String> urls) {
        String result;
        synchronized (this) {
            result = book.enqueue(id, name, urls);
            changed(true);
        }
        if (DownloadBook.STARTED.equals(result)) startService();
        return result;
    }

    private void startService() {
        Intent i = new Intent(app, QuranDownloadService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) app.startForegroundService(i);
            else app.startService(i);
        } catch (RuntimeException e) {
            Log.w(TAG, "تعذّر تشغيل خدمة التحميل", e);
            synchronized (this) {
                String a = book.active();
                if (a != null) book.finish(a, false);
                changed(true);
            }
        }
    }

    /** إيقاف القارئ id بطلب المستخدم (من الصفحة أو من زرّ الإشعار). */
    public void pause(String id) {
        boolean wasActive;
        QuranDownloadService s;
        synchronized (this) {
            wasActive = book.pause(id);
            changed(true);
            s = service;
        }
        if (wasActive && s != null) s.stopActive();
    }

    // ---------- للخدمة ----------
    synchronized String next() {
        String id = book.next();
        changed(true);
        return id;
    }

    synchronized String active() {
        return book.active();
    }

    synchronized List<String> urlsOf(String id) {
        return book.urlsOf(id);
    }

    synchronized String nameOf(String id) {
        return book.nameOf(id);
    }

    synchronized void progress(String id, int count, int total) {
        if (!id.equals(book.active())) return;
        book.progress(id, count, total);
        changed(false);
    }

    synchronized void setWaiting(String id, boolean waiting) {
        book.setWaiting(id, waiting);
        changed(true);
    }

    /** انتهى تحميل id بالنتيجة result (done أو غيرها). */
    void finish(String id, String result) {
        Listener l;
        String name;
        synchronized (this) {
            name = book.nameOf(id);
            book.finish(id, "done".equals(result));
            changed(true);
            l = listener;
        }
        if (l != null && !"paused".equals(result)) l.onNotice(id, name, result);
    }

    synchronized void pauseAll() {
        book.pauseAll();
        changed(true);
    }

    /** يبلّغ الصفحة ويحفظ: فورًا (force)، أو على فترات أثناء التقدّم. */
    private void changed(boolean force) {
        long now = SystemClock.elapsedRealtime();
        if (force || now - lastSave >= SAVE_MS) {
            lastSave = now;
            prefs.edit().putString(KEY, book.save()).apply();
        }
        if (force || now - lastEmit >= EMIT_MS) {
            lastEmit = now;
            if (listener != null) listener.onState(book.toJson());
        }
    }
}
