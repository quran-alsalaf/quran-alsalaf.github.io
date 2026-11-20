package com.quranalsalaf.app.audio;

import android.Manifest;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * صلة الصفحة بحفظ الصوت على الجهاز (src/lib/nativeFiles.js ← registerPlugin('QuranDownloads')، الجلسة ٢ ب).
 *
 * تحميل القارئ لكامل القرآن (في الخلفية، QuranDownloadService):
 *   getState() ← { items, active, queue } · start({ id, name, urls }) ← { result: started | queued | done }
 *   pause({ id }) · والحدثان «state» (عند كل تغيّر) و«notice» { id, name, result } عند انتهاء تحميل قارئ.
 * «تنزيل» مقدار (والتطبيق مفتوح):
 *   saveFiles({ urls }) ← { result: ok | cancelled | failed | nospace }، والحدث «files» { saved, total }
 *   cancelFiles() · missing({ urls }) ← { count } · freeSpace() ← { mb }
 */
@CapacitorPlugin(
    name = "QuranDownloads",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class QuranDownloadsPlugin extends Plugin implements QuranDownloads.Listener {

    private static final String ASKED = "askedNotifications";
    private BulkDownload files;

    private QuranDownloads downloads() {
        return QuranDownloads.get(getContext());
    }

    @Override
    public void load() {
        downloads().setListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        downloads().setListener(null);
        if (files != null) files.cancel();
    }

    @Override
    public void onState(JSONObject state) {
        notifyListeners("state", toJs(state));
    }

    @Override
    public void onNotice(String id, String name, String result) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("name", name);
        o.put("result", result);
        notifyListeners("notice", o);
    }

    private static JSObject toJs(JSONObject o) {
        try {
            return new JSObject(o.toString());
        } catch (JSONException e) {
            return new JSObject();
        }
    }

    private static List<String> urls(PluginCall call) throws JSONException {
        JSArray a = call.getArray("urls");
        List<String> out = new ArrayList<>();
        if (a == null) return out;
        for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        return out;
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(toJs(downloads().state()));
    }

    /** يبدأ تحميل قارئ أو يضعه في الانتظار. ويُطلب إذن الإشعارات مرة واحدة عند أول تحميل (أندرويد ١٣ فأحدث). */
    @PluginMethod
    public void start(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("quran-downloads", 0);
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED && !prefs.getBoolean(ASKED, false)) {
            prefs.edit().putBoolean(ASKED, true).apply();
            requestPermissionForAlias("notifications", call, "startAfterPermission");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void startAfterPermission(PluginCall call) {
        doStart(call); // يُحمَّل ولو رُفض الإذن، بلا إشعار ظاهر
    }

    private void doStart(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("no id");
            return;
        }
        try {
            String result = downloads().start(id, call.getString("name", ""), urls(call));
            JSObject o = new JSObject();
            o.put("result", result);
            call.resolve(o);
        } catch (JSONException e) {
            call.reject("bad urls", e);
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        String id = call.getString("id");
        if (id != null) downloads().pause(id);
        call.resolve();
    }

    // ---------- «تنزيل» المقدار ----------
    @PluginMethod
    public void saveFiles(PluginCall call) {
        List<String> list;
        try {
            list = urls(call);
        } catch (JSONException e) {
            call.reject("bad urls", e);
            return;
        }
        if (files != null) files.cancel();
        BulkDownload b = new BulkDownload();
        files = b;
        File root = downloads().root();
        new Thread(() -> {
            BulkDownload.Result r = b.run(root, list, (saved, total) -> {
                if (b.isCancelled()) return;
                JSObject p = new JSObject();
                p.put("saved", saved);
                p.put("total", total);
                notifyListeners("files", p);
            });
            if (files == b) files = null;
            JSObject o = new JSObject();
            o.put("result", r == BulkDownload.Result.DONE ? "ok" : r == BulkDownload.Result.CANCELLED ? "cancelled" : r == BulkDownload.Result.NOSPACE ? "nospace" : "failed");
            call.resolve(o);
        }, "quran-save-files").start();
    }

    @PluginMethod
    public void cancelFiles(PluginCall call) {
        if (files != null) files.cancel();
        call.resolve();
    }

    /** كم ملفًّا من urls لم يُحفظ بعد؟ */
    @PluginMethod
    public void missing(PluginCall call) {
        try {
            JSObject o = new JSObject();
            o.put("count", AudioFiles.missing(downloads().root(), urls(call)).size());
            call.resolve(o);
        } catch (JSONException e) {
            call.reject("bad urls", e);
        }
    }

    /** المساحة الفارغة على الجهاز بالميغابايت. */
    @PluginMethod
    public void freeSpace(PluginCall call) {
        File root = downloads().root();
        File probe = root.exists() ? root : getContext().getFilesDir();
        JSObject o = new JSObject();
        o.put("mb", probe.getUsableSpace() / 1_000_000L);
        call.resolve(o);
    }
}
