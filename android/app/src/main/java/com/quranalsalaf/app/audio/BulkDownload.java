package com.quranalsalaf.app.audio;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * تحميل ملفات صوت إلى الجهاز (AudioFiles): صوت قارئ لكامل القرآن (QuranDownloadService)، أو «تنزيل» مقدار
 * (QuranDownloadsPlugin.saveFiles). يحمّل الناقص وحده، فالاستئناف يكمل من حيث وقف.
 *
 * عدة ملفات معًا، ولكل ملف محاولتان أُخريان قبل التوقف. والملف يُكتب باسم مؤقت (.part) ولا يُعدّ محفوظًا حتى
 * يكتمل، فلا يقرأ المشغّل ملفًا ناقصًا لو انقطع التحميل في وسطه.
 *
 * لا يعتمد على أندرويد، فيُختبر وحده بخادم محلي (BulkDownloadTest).
 */
public final class BulkDownload {

    /** نتيجة التحميل. */
    public enum Result {
        /** حُمِّل كله. */
        DONE,
        /** أُوقف (cancel). */
        CANCELLED,
        /** تعذّر الاتصال (انقطاع الإنترنت غالبًا). */
        NETWORK,
        /** ردّ الخادم بخطأ. */
        FAILED,
        /** لا تكفي المساحة على الجهاز. */
        NOSPACE
    }

    /** تقدّم التحميل: saved عدد ما حُفظ من total (ومنه ما كان محفوظًا قبل البدء). */
    public interface Progress {
        void onProgress(int saved, int total);
    }

    /** إعدادات التحميل (تُغيَّر في الاختبار). */
    public static final class Options {
        public int concurrency = 4;
        public int retries = 2;
        public long retryDelayMs = 800;
        public int connectTimeoutMs = 15000;
        public int readTimeoutMs = 30000;
        /** يتوقف التحميل إذا قلّت المساحة الفارغة عن هذا (فلا يمتلئ الجهاز كله). */
        public long minFreeBytes = 50L * 1024 * 1024;
    }

    static final class HttpError extends IOException {
        HttpError(int code) {
            super("HTTP " + code);
        }
    }

    static final class NoSpace extends IOException {
        NoSpace() {
            super("no space");
        }
    }

    static final class Cancelled extends IOException {
        Cancelled() {
            super("cancelled");
        }
    }

    private final Options opts;
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private final Set<HttpURLConnection> open = Collections.synchronizedSet(new HashSet<>());

    public BulkDownload() {
        this(new Options());
    }

    public BulkDownload(Options opts) {
        this.opts = opts;
    }

    /** يوقف التحميل: يقطع ما يجري الآن، ويُرجع run() «CANCELLED». */
    public void cancel() {
        cancelled.set(true);
        synchronized (open) {
            for (HttpURLConnection c : open) c.disconnect();
        }
    }

    public boolean isCancelled() {
        return cancelled.get();
    }

    /** يحمّل ما لم يُحفظ من urls إلى root، وينتظر حتى ينتهي. */
    public Result run(File root, List<String> urls, Progress progress) {
        List<String> todo = AudioFiles.missing(root, urls);
        int total = urls.size();
        AtomicInteger saved = new AtomicInteger(total - todo.size());
        if (progress != null) progress.onProgress(saved.get(), total);
        if (todo.isEmpty()) return cancelled.get() ? Result.CANCELLED : Result.DONE;

        AtomicInteger next = new AtomicInteger();
        AtomicReference<Result> error = new AtomicReference<>();
        List<Thread> workers = new ArrayList<>();
        int n = Math.max(1, Math.min(opts.concurrency, todo.size()));
        for (int w = 0; w < n; w++) {
            Thread t = new Thread(() -> {
                while (error.get() == null && !cancelled.get()) {
                    int i = next.getAndIncrement();
                    if (i >= todo.size()) return;
                    String url = todo.get(i);
                    Result r = fetchWithRetries(root, url);
                    if (r == null) {
                        int s = saved.incrementAndGet();
                        if (progress != null && !cancelled.get()) progress.onProgress(s, total);
                    } else {
                        error.compareAndSet(null, r);
                        return;
                    }
                }
            }, "quran-download-" + w);
            workers.add(t);
            t.start();
        }
        for (Thread t : workers) {
            try {
                t.join();
            } catch (InterruptedException e) {
                cancel();
                Thread.currentThread().interrupt();
            }
        }
        if (cancelled.get()) return Result.CANCELLED;
        Result e = error.get();
        return e == null ? Result.DONE : e;
    }

    /** null إن حُفظ الملف، وإلا سبب التوقف. */
    private Result fetchWithRetries(File root, String url) {
        File dest = AudioFiles.fileFor(root, url);
        if (dest == null) return null;
        for (int t = 0; ; t++) {
            try {
                if (root.getUsableSpace() < opts.minFreeBytes && root.getUsableSpace() > 0) throw new NoSpace();
                fetch(url, dest);
                return null;
            } catch (Cancelled e) {
                return Result.CANCELLED;
            } catch (NoSpace e) {
                return Result.NOSPACE;
            } catch (IOException e) {
                if (cancelled.get()) return Result.CANCELLED;
                if (isNoSpace(e)) return Result.NOSPACE;
                if (t >= opts.retries) return e instanceof HttpError ? Result.FAILED : Result.NETWORK;
                try {
                    Thread.sleep(opts.retryDelayMs * (t + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return Result.CANCELLED;
                }
            }
        }
    }

    private static boolean isNoSpace(IOException e) {
        String m = String.valueOf(e.getMessage());
        return m.contains("ENOSPC") || m.toLowerCase().contains("no space");
    }

    private void fetch(String url, File dest) throws IOException {
        File dir = dest.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) throw new IOException("mkdirs " + dir);
        File part = new File(dest.getPath() + AudioFiles.PART);
        HttpURLConnection c = (HttpURLConnection) URI.create(url).toURL().openConnection();
        open.add(c);
        try {
            if (cancelled.get()) throw new Cancelled();
            c.setConnectTimeout(opts.connectTimeoutMs);
            c.setReadTimeout(opts.readTimeoutMs);
            c.setInstanceFollowRedirects(true);
            int code = c.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new HttpError(code);
            long length = c.getContentLengthLong();
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                byte[] buf = new byte[32 * 1024];
                int k;
                while ((k = in.read(buf)) != -1) {
                    if (cancelled.get()) throw new Cancelled();
                    out.write(buf, 0, k);
                }
            }
            if (cancelled.get()) throw new Cancelled();
            if (part.length() == 0 || (length > 0 && part.length() != length)) throw new IOException("incomplete");
            if (!part.renameTo(dest)) throw new IOException("rename " + dest);
        } catch (IOException e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            if (cancelled.get() && !(e instanceof Cancelled)) throw new Cancelled();
            throw e;
        } finally {
            open.remove(c);
            c.disconnect();
        }
    }
}
