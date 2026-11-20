package com.quranalsalaf.app.feedback;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * «رأيك يهمنا» (src/lib/feedback.js ← registerPlugin('QuranFeedback')، الجلسة ٣ ب):
 *   requestReview(): نافذة تقييم جوجل بلاي داخل التطبيق. جوجل تقرّر هل تظهر (حدّ لعدد مرات ظهورها، ولا تظهر
 *     إلا لتطبيق مثبّت من المتجر)، ولا تخبر هل ظهرت ولا هل قيّم المستخدم؛ فيُحلّ الطلب في كل حال.
 *   openStore(): صفحة التطبيق في متجر جوجل بلاي (تطبيق المتجر، وإلا المتصفح).
 *   openUrl({ url }): رابط خارجي (واتساب) بتطبيقه في الجهاز.
 *   deviceInfo() ← { version, manufacturer, model, android }: لسطر المعلومات في رسالة «تواصل معنا».
 */
@CapacitorPlugin(name = "QuranFeedback")
public class QuranFeedbackPlugin extends Plugin {

    @PluginMethod
    public void requestReview(PluginCall call) {
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager.requestReviewFlow().addOnCompleteListener(request -> {
            if (!request.isSuccessful() || getActivity() == null) {
                call.resolve();
                return;
            }
            ReviewInfo info = request.getResult();
            manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(done -> call.resolve());
        });
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        String id = getContext().getPackageName();
        if (!open(Uri.parse("market://details?id=" + id))
                && !open(Uri.parse("https://play.google.com/store/apps/details?id=" + id))) {
            call.reject("no store");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("bad url");
            return;
        }
        if (!open(Uri.parse(url))) {
            call.reject("no app");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject o = new JSObject();
        o.put("version", versionName(getContext()));
        o.put("manufacturer", Build.MANUFACTURER);
        o.put("model", Build.MODEL);
        o.put("android", Build.VERSION.RELEASE);
        call.resolve(o);
    }

    private boolean open(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    private static String versionName(Context ctx) {
        try {
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return info.versionName;
        } catch (Exception e) {
            return null;
        }
    }
}
