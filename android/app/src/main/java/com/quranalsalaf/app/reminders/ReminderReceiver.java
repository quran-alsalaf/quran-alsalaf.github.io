package com.quranalsalaf.app.reminders;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** يحين وقت تذكير ختمة (ReminderAlarms.schedule): يُظهر إشعاره. داخلي، لا يستقبل من تطبيق آخر. */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ReminderAlarms.ACTION_FIRE.equals(intent.getAction())) return;
        ReminderAlarms.show(
            context,
            intent.getStringExtra(ReminderAlarms.EXTRA_TYPE),
            intent.getStringExtra(ReminderAlarms.EXTRA_TITLE),
            intent.getStringExtra(ReminderAlarms.EXTRA_BODY)
        );
    }
}
