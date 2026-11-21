package com.quranalsalaf.app.reminders;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.quranalsalaf.app.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.TimeZone;

/**
 * جدولة إشعارات تذكير الختمة وإظهارها (الجلسة ٣ أ، ٢٠٢٦-١١-٢٠).
 *
 *   • إشعارات كل نوع (الورد، الحفظ) محفوظة في ذاكرة التطبيق (SharedPreferences) بنصوصها، فتُعاد جدولتها بعد
 *     إعادة تشغيل الجوال أو تحديث التطبيق أو تغيّر المنطقة الزمنية (ReminderBootReceiver) والتطبيق مغلق.
 *   • الجدولة بنافذة عشر دقائق (setWindow): التوقيت الدقيق يحتاج إذنًا لا تمنحه سياسة جوجل بلاي إلا لتطبيقات
 *     المنبّه والتقويم، والتوقيت التقريبي العادي قد يتأخر حتى ساعة. وفي السبات العميق يظهر حين يستيقظ الجوال.
 *   • إشعار واحد ظاهر لكل نوع (يحلّ الجديد محل القديم)، والضغط عليه يفتح التطبيق ومعه نوعه (QuranRemindersPlugin).
 */
public final class ReminderAlarms {

    static final String ACTION_FIRE = "com.quranalsalaf.app.reminders.FIRE";
    static final String EXTRA_TYPE = "type";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    /** في نيّة فتح التطبيق من الإشعار: نوع الختمة. */
    public static final String EXTRA_OPEN = "quranReminder";

    private static final String PREFS = "quran-reminders";
    private static final String CHANNEL = "reminders";
    private static final long WINDOW_MS = 10 * 60 * 1000L;
    private static final int NOTIF_BASE = 7400;

    private ReminderAlarms() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** يحفظ إشعارات النوع ([{ day, time, title, body }]) ويعيد جدولتها كلها. */
    static void set(Context c, String type, String itemsJson) {
        prefs(c).edit().putString(type, itemsJson).apply();
        schedule(c, type);
    }

    static void scheduleAll(Context c) {
        for (String type : ReminderSchedule.TYPES) schedule(c, type);
    }

    /** يلغي ما جُدول للنوع، ثم يجدول ما بقي وقته من إشعاراته المحفوظة. */
    static void schedule(Context c, String type) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < ReminderSchedule.MAX_ITEMS; i++) {
            PendingIntent old = PendingIntent.getBroadcast(c, ReminderSchedule.requestCode(type, i), fireIntent(c),
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (old != null) {
                am.cancel(old);
                old.cancel();
            }
        }
        JSONArray items;
        try {
            items = new JSONArray(prefs(c).getString(type, "[]"));
        } catch (JSONException e) {
            return;
        }
        long now = System.currentTimeMillis();
        TimeZone tz = TimeZone.getDefault();
        long window = Build.VERSION.SDK_INT >= 31 ? WINDOW_MS : 60 * 1000L;
        for (int i = 0; i < items.length() && i < ReminderSchedule.MAX_ITEMS; i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            long at = ReminderSchedule.triggerAt(it.optString("day", null), it.optString("time", null), tz);
            if (at <= now) continue;
            Intent fire = fireIntent(c)
                .putExtra(EXTRA_TYPE, type)
                .putExtra(EXTRA_TITLE, it.optString("title", ""))
                .putExtra(EXTRA_BODY, it.optString("body", ""));
            PendingIntent pi = PendingIntent.getBroadcast(c, ReminderSchedule.requestCode(type, i), fire,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setWindow(AlarmManager.RTC_WAKEUP, at, window, pi);
        }
    }

    private static Intent fireIntent(Context c) {
        return new Intent(c, ReminderReceiver.class).setAction(ACTION_FIRE);
    }

    private static int notifId(String type) {
        return NOTIF_BASE + ReminderSchedule.typeIndex(type);
    }

    /** يُظهر الإشعار (إن كانت الإشعارات مسموحة). */
    static void show(Context c, String type, String title, String body) {
        if (ReminderSchedule.typeIndex(type) == 0) return;
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "تذكير الختمة", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("تذكير يومي بالورد وبخطوات ختمة الحفظ");
            nm.createNotificationChannel(ch);
        }
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open == null) return;
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(EXTRA_OPEN, type);
        PendingIntent pi = PendingIntent.getActivity(c, 100 + ReminderSchedule.typeIndex(type), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_quran)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build();
        nm.notify(notifId(type), n);
    }

    /** يزيل إشعار النوع الظاهر (أتمّ المستخدم ما عليه، أو ألغى التذكير). */
    static void dismiss(Context c, String type) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(notifId(type));
    }
}
