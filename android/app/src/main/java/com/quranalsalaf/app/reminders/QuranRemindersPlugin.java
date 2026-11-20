package com.quranalsalaf.app.reminders;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * صلة الصفحة بتذكير الختمة اليومي (src/lib/reminders.js ← registerPlugin('QuranReminders')، الجلسة ٣ أ):
 *   set({ type, items, dismiss }): يستبدل إشعارات النوع (wird أو hifz) بـitems [{ day, time, title, body }]،
 *     وقائمة فارغة تلغيها؛ وdismiss يزيل إشعار النوع الظاهر.
 *   checkPermission() / requestPermission() ← { granted }: إذن الإشعارات (يُسأل عنه في أندرويد ١٣ فأحدث).
 *   openSettings(): إعدادات إشعارات التطبيق في الجهاز (لمن رفض الإذن).
 *   والحدث «open» { type } عند الضغط على الإشعار، ولو فُتح التطبيق به من الإغلاق (يُحفظ حتى تستمع الصفحة).
 */
@CapacitorPlugin(
    name = "QuranReminders",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class QuranRemindersPlugin extends Plugin {

    @Override
    public void load() {
        if (getActivity() != null) deliver(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        deliver(intent);
    }

    private void deliver(Intent intent) {
        if (intent == null) return;
        String type = intent.getStringExtra(ReminderAlarms.EXTRA_OPEN);
        if (type == null) return;
        intent.removeExtra(ReminderAlarms.EXTRA_OPEN); // لا يُعاد عند إعادة إنشاء الصفحة
        JSObject o = new JSObject();
        o.put("type", type);
        notifyListeners("open", o, true);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String type = call.getString("type");
        if (ReminderSchedule.typeIndex(type) == 0) {
            call.reject("unknown type");
            return;
        }
        JSArray items = call.getArray("items", new JSArray());
        ReminderAlarms.set(getContext(), type, items.toString());
        if (Boolean.TRUE.equals(call.getBoolean("dismiss", false))) ReminderAlarms.dismiss(getContext(), type);
        call.resolve();
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        resolveGranted(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        resolveGranted(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        resolveGranted(call);
    }

    private void resolveGranted(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(o);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String pkg = getContext().getPackageName();
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }
}
