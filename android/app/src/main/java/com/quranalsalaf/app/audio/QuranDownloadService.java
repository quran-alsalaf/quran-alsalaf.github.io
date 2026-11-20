package com.quranalsalaf.app.audio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * خدمة تحميل صوت القرّاء لكامل القرآن (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠): تعمل في المقدّمة بإشعار، فيستمر التحميل
 * والشاشة مقفلة وبعد إغلاق التطبيق. قارئ واحد في كل مرة، ثم التالي في الانتظار، ثم تقف وحدها.
 *
 *   • الإشعار: «تحميل تلاوة [القارئ]» ونسبته وشريط تقدّم، وزرّ «إيقاف». والضغط عليه يفتح التطبيق.
 *   • انقطاع الاتصال: يبقى الإشعار «متوقف لانقطاع الاتصال، ويُستأنف وحده إذا رجع»، ويكمل من حيث وقف حين
 *     يرجع. وإن لم يرجع خلال نصف ساعة توقف التحميل (يُستأنف بزرّه في التطبيق).
 *   • عند الاكتمال إشعار «اكتمل تحميل تلاوة [القارئ]»، وعند التوقف لسبب آخر إشعار بسببه.
 *   • إذن الإشعارات يُطلب عند أول تحميل (QuranDownloadsPlugin)؛ وإن رُفض استمر التحميل بلا إشعار ظاهر.
 */
public class QuranDownloadService extends Service {

    static final String ACTION_PAUSE = "com.quranalsalaf.app.download.PAUSE";
    private static final String CHANNEL = "downloads";
    private static final int NOTIF_ID = 7301;
    private static final int RESULT_NOTIF_ID = 7302;
    private static final long NOTIF_MS = 1000;
    private static final long OFFLINE_WAIT_MS = 30 * 60 * 1000;
    private static final long WAKE_MS = 6 * 60 * 60 * 1000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private QuranDownloads downloads;
    private NotificationManager nm;
    @Nullable
    private BulkDownload job;
    @Nullable
    private String jobId;
    /** ينتظر رجوع الاتصال لهذا القارئ. */
    @Nullable
    private String waitingId;
    @Nullable
    private ConnectivityManager.NetworkCallback netCallback;
    private final Runnable giveUp = this::giveUpWaiting;
    @Nullable
    private PowerManager.WakeLock wake;
    private long lastNotif;
    private boolean foreground;

    @Override
    public void onCreate() {
        super.onCreate();
        downloads = QuranDownloads.get(this);
        nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "التحميل", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("تقدّم تحميل صوت القرّاء");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        downloads.attach(this);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        // يجب أن تدخل الخدمة المقدّمة فور تشغيلها، ولو كان الأمر إيقافًا
        String id = downloads.active();
        enterForeground(progressNotification(id != null ? downloads.nameOf(id) : "", -1, false));
        if (intent != null && ACTION_PAUSE.equals(intent.getAction())) {
            if (id != null) downloads.pause(id);
            if (job == null && waitingId == null) runNext();
            return START_NOT_STICKY;
        }
        if (job == null && waitingId == null) runNext();
        return START_NOT_STICKY;
    }

    /** يبدأ الجاري أو التالي في الانتظار، أو تقف الخدمة إن لم يبق شيء. */
    private void runNext() {
        String id = downloads.next();
        if (id == null) {
            finishService();
            return;
        }
        List<String> urls = downloads.urlsOf(id);
        String name = downloads.nameOf(id);
        if (urls.isEmpty()) { // لا روابط (أُعيد تشغيل التطبيق): يتوقف ويُستأنف بزرّه
            downloads.finish(id, "paused");
            runNext();
            return;
        }
        acquireWake();
        BulkDownload b = new BulkDownload();
        job = b;
        jobId = id;
        lastNotif = 0;
        nm.notify(NOTIF_ID, progressNotification(name, -1, false));
        exec.execute(() -> {
            BulkDownload.Result r = b.run(downloads.root(), urls, (saved, total) -> {
                downloads.progress(id, saved, total);
                long now = SystemClock.elapsedRealtime();
                if (now - lastNotif >= NOTIF_MS) {
                    lastNotif = now;
                    if (!b.isCancelled()) nm.notify(NOTIF_ID, progressNotification(name, total > 0 ? saved * 100 / total : 0, false));
                }
            });
            main.post(() -> onJobEnd(id, b, r));
        });
    }

    private void onJobEnd(String id, BulkDownload b, BulkDownload.Result r) {
        if (job == b) {
            job = null;
            jobId = null;
        }
        switch (r) {
            case DONE:
                downloads.finish(id, "done");
                resultNotification("اكتمل تحميل تلاوة " + downloads.nameOf(id), "تعمل الآن بلا إنترنت");
                runNext();
                break;
            case CANCELLED: // أوقفه المستخدم (السجلّ تكفّل بالحالة)
                runNext();
                break;
            case NETWORK:
                if (!online()) {
                    waitForNetwork(id);
                } else {
                    downloads.finish(id, "failed");
                    resultNotification("توقّف تحميل " + downloads.nameOf(id), "تعذّر الوصول إلى ملفات الصوت؛ أكمله من التطبيق");
                    runNext();
                }
                break;
            case NOSPACE:
                downloads.finish(id, "nospace");
                downloads.pauseAll();
                resultNotification("توقّف تحميل " + downloads.nameOf(id), "لا تكفي المساحة المتاحة على الجهاز");
                runNext();
                break;
            default:
                downloads.finish(id, "failed");
                resultNotification("توقّف تحميل " + downloads.nameOf(id), "تعذّر الوصول إلى ملفات الصوت؛ أكمله من التطبيق");
                runNext();
        }
    }

    /** أوقف المستخدم الجاري (QuranDownloads.pause): يُقطع تحميله، أو يُترك انتظار الاتصال. */
    void stopActive() {
        main.post(() -> {
            if (job != null) {
                job.cancel(); // onJobEnd(CANCELLED) يبدأ التالي
            } else if (waitingId != null) {
                stopWaiting();
                runNext();
            }
        });
    }

    // ---------- انقطاع الاتصال ----------
    private boolean online() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        Network n = cm.getActiveNetwork();
        NetworkCapabilities c = n == null ? null : cm.getNetworkCapabilities(n);
        return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void waitForNetwork(String id) {
        waitingId = id;
        downloads.setWaiting(id, true);
        nm.notify(NOTIF_ID, progressNotification(downloads.nameOf(id), -1, true));
        releaseWake();
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null && netCallback == null) {
            netCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    main.post(() -> {
                        if (waitingId == null) return;
                        String w = waitingId;
                        stopWaiting();
                        downloads.setWaiting(w, false);
                        runNext();
                    });
                }
            };
            try {
                cm.registerDefaultNetworkCallback(netCallback);
            } catch (RuntimeException e) {
                netCallback = null;
            }
        }
        main.postDelayed(giveUp, OFFLINE_WAIT_MS);
    }

    private void stopWaiting() {
        waitingId = null;
        main.removeCallbacks(giveUp);
        if (netCallback != null) {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            try {
                if (cm != null) cm.unregisterNetworkCallback(netCallback);
            } catch (RuntimeException ignored) {
            }
            netCallback = null;
        }
    }

    /** لم يرجع الاتصال خلال نصف ساعة: يتوقف التحميل كله، ويُستأنف بزرّه في التطبيق. */
    private void giveUpWaiting() {
        String id = waitingId;
        if (id == null) return;
        stopWaiting();
        String name = downloads.nameOf(id);
        downloads.finish(id, "offline");
        downloads.pauseAll();
        resultNotification("توقّف تحميل " + name + " لانقطاع الاتصال", "أكمله من التطبيق إذا رجع الاتصال");
        finishService();
    }

    // ---------- أندرويد ١٥: حدّ مدة خدمات التحميل في المقدّمة ----------
    @Override
    public void onTimeout(int startId, int fgsType) {
        String id = jobId != null ? jobId : waitingId;
        if (job != null) job.cancel();
        stopWaiting();
        if (id != null) {
            String name = downloads.nameOf(id);
            downloads.finish(id, "timeout");
            resultNotification("توقّف تحميل " + name, "أكمله من التطبيق بزرّ الاستئناف");
        }
        downloads.pauseAll();
        finishService();
    }

    // ---------- الإشعار ----------
    private PendingIntent openApp() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) launch = new Intent();
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 1, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification progressNotification(String name, int pct, boolean waiting) {
        Intent pause = new Intent(this, QuranDownloadService.class).setAction(ACTION_PAUSE);
        PendingIntent pausePi = PendingIntent.getService(this, 2, pause, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(name.isEmpty() ? "تحميل صوت القارئ" : "تحميل تلاوة " + name)
            .setContentIntent(openApp())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, "إيقاف", pausePi);
        if (waiting) {
            b.setSmallIcon(android.R.drawable.stat_sys_warning);
            b.setContentText("متوقف لانقطاع الاتصال، ويُستأنف وحده إذا رجع");
        } else if (pct < 0) {
            b.setProgress(100, 0, true);
        } else {
            b.setContentText(arabicDigits(pct) + "٪");
            b.setProgress(100, pct, false);
        }
        return b.build();
    }

    private void resultNotification(String title, String text) {
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openApp())
            .setAutoCancel(true)
            .build();
        try {
            nm.notify(RESULT_NOTIF_ID, n);
        } catch (RuntimeException ignored) {
        }
    }

    static String arabicDigits(int n) {
        String s = Integer.toString(n);
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toCharArray()) b.append(c >= '0' && c <= '9' ? (char) ('٠' + (c - '0')) : c);
        return b.toString();
    }

    private void enterForeground(Notification n) {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
        try {
            ServiceCompat.startForeground(this, NOTIF_ID, n, type);
            foreground = true;
        } catch (RuntimeException e) {
            // أندرويد يمنع البدء من الخلفية أحيانًا: يتوقف ما يجري ويُستأنف بزرّه
            downloads.pauseAll();
            stopSelf();
        }
    }

    // ---------- إبقاء المعالج يقظًا والشاشة مقفلة ----------
    private void acquireWake() {
        if (wake == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) return;
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QuranAlsalaf:download");
            wake.setReferenceCounted(false);
        }
        wake.acquire(WAKE_MS);
    }

    private void releaseWake() {
        if (wake != null && wake.isHeld()) wake.release();
    }

    private void finishService() {
        releaseWake();
        stopWaiting();
        if (foreground) ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        foreground = false;
        nm.cancel(NOTIF_ID);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (job != null) job.cancel();
        stopWaiting();
        releaseWake();
        String id = downloads.active();
        if (id != null) downloads.finish(id, "paused");
        downloads.pauseAll();
        downloads.attach(null);
        exec.shutdownNow();
        super.onDestroy();
    }
}
