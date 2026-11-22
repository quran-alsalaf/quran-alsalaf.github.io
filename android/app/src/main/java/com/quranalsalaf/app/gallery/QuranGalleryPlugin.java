package com.quranalsalaf.app.gallery;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * حفظ صور المشاركة في معرض الجوال (src/lib/shareFiles.js ← registerPlugin('QuranGallery')، «المشاركة» الجلسة ١):
 *   save({ images: [{ name, data }] }) ← { result: 'saved' | 'denied' }
 *   data: الصورة PNG بترميز base64. تُحفظ في مجلد «قرآن السلف» داخل الصور (Pictures).
 * أندرويد ١٠ فأحدث: بـ MediaStore بلا إذن. وأقدم منه: يُطلب إذن الكتابة في الذاكرة مرة واحدة.
 */
@CapacitorPlugin(
    name = "QuranGallery",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class QuranGalleryPlugin extends Plugin {

    private static final String FOLDER = "قرآن السلف";

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermission");
            return;
        }
        write(call);
    }

    @PermissionCallback
    private void storagePermission(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            JSObject o = new JSObject();
            o.put("result", "denied");
            call.resolve(o);
            return;
        }
        write(call);
    }

    private void write(PluginCall call) {
        JSArray images = call.getArray("images");
        if (images == null) {
            call.reject("no images");
            return;
        }
        try {
            for (int i = 0; i < images.length(); i++) {
                JSONObject img = images.getJSONObject(i);
                byte[] bytes = Base64.decode(img.getString("data"), Base64.DEFAULT);
                saveOne(img.getString("name"), bytes);
            }
            JSObject o = new JSObject();
            o.put("result", "saved");
            call.resolve(o);
        } catch (Exception e) {
            call.reject("save failed", e);
        }
    }

    private void saveOne(String name, byte[] bytes) throws Exception {
        String file = System.currentTimeMillis() + "-" + name;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, file);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + FOLDER);
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("insert failed");
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new Exception("no stream");
                out.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
        } else {
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), FOLDER);
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("mkdirs failed");
            File out = new File(dir, file);
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(bytes);
            }
            MediaScannerConnection.scanFile(getContext(), new String[] { out.getAbsolutePath() }, new String[] { "image/png" }, null);
        }
    }
}
