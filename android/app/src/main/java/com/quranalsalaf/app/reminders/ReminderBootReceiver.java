package com.quranalsalaf.app.reminders;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * إعادة جدولة تذكير الختمة والتطبيق مغلق: أندرويد يمحو المواعيد عند إعادة تشغيل الجوال وعند تحديث التطبيق،
 * وتغيّر المنطقة الزمنية أو ساعة الجهاز يغيّر لحظة الوقت المحلي نفسه.
 */
public class ReminderBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)) {
            ReminderAlarms.scheduleAll(context);
        }
    }
}
