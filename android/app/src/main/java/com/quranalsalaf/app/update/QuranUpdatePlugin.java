package com.quranalsalaf.app.update;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import android.app.Activity;

/**
 * تنبيه التحديث (src/lib/appUpdate.js ← registerPlugin('QuranUpdate')، ٢٠٢٦-١١-٢٣): تحديثات جوجل بلاي داخل
 * التطبيق (In-App Updates) بالنوع المرن: يتنزّل التحديث في الخلفية والمستخدم يكمل، ثم يُثبَّت بإعادة التشغيل.
 * جوجل لا تخبر بالتحديث إلا إذا نُشرت نسخة أحدث فعلًا وصارت متاحة لهذا الجهاز، ولا يعمل إلا في تطبيق مثبّت
 * من المتجر (في نسخة التجربة يرجع check بلا تحديث).
 *   check() ← { available, versionCode, downloaded }: هل توجد نسخة أحدث تُنزَّل بالنوع المرن، وهل نُزّلت ولم تُثبَّت
 *   start() ← { accepted }: نافذة جوجل «يتوفر تحديث»؛ accepted: false إن رفضه المستخدم
 *   complete(): يثبّت التحديث المنزَّل (يعيد تشغيل التطبيق)
 *   الحدث state ← { status: 'downloading' | 'downloaded' | 'installed' | 'failed' | 'canceled' }
 */
@CapacitorPlugin(name = "QuranUpdate")
public class QuranUpdatePlugin extends Plugin {

    private AppUpdateManager manager;
    private final InstallStateUpdatedListener listener = this::onState;

    @Override
    public void load() {
        manager = AppUpdateManagerFactory.create(getContext());
        manager.registerListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.unregisterListener(listener);
    }

    private void onState(InstallState state) {
        String status = statusName(state.installStatus());
        if (status == null) return;
        JSObject o = new JSObject();
        o.put("status", status);
        notifyListeners("state", o);
    }

    private static String statusName(int s) {
        switch (s) {
            case InstallStatus.PENDING:
            case InstallStatus.DOWNLOADING:
                return "downloading";
            case InstallStatus.DOWNLOADED:
                return "downloaded";
            case InstallStatus.INSTALLED:
                return "installed";
            case InstallStatus.FAILED:
                return "failed";
            case InstallStatus.CANCELED:
                return "canceled";
            default:
                return null;
        }
    }

    @PluginMethod
    public void check(PluginCall call) {
        manager.getAppUpdateInfo().addOnCompleteListener(task -> {
            JSObject o = new JSObject();
            if (!task.isSuccessful()) {
                // بلا متجر (نسخة التجربة) أو بلا اتصال: كأن لا تحديث
                o.put("available", false);
                o.put("downloaded", false);
                call.resolve(o);
                return;
            }
            AppUpdateInfo info = task.getResult();
            o.put("available", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
            o.put("versionCode", info.availableVersionCode());
            o.put("downloaded", info.installStatus() == InstallStatus.DOWNLOADED);
            call.resolve(o);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        manager.getAppUpdateInfo().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || getActivity() == null) {
                call.reject("no update");
                return;
            }
            AppUpdateInfo info = task.getResult();
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE
                    || !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                call.reject("no update");
                return;
            }
            manager.startUpdateFlow(info, getActivity(), AppUpdateOptions.defaultOptions(AppUpdateType.FLEXIBLE))
                    .addOnCompleteListener(flow -> {
                        JSObject o = new JSObject();
                        o.put("accepted", flow.isSuccessful() && flow.getResult() == Activity.RESULT_OK);
                        call.resolve(o);
                    });
        });
    }

    @PluginMethod
    public void complete(PluginCall call) {
        manager.completeUpdate();
        call.resolve();
    }
}
