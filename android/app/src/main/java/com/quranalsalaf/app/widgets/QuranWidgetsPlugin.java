package com.quranalsalaf.app.widgets;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * صلة الصفحة بويدجتات الشاشة الرئيسية (src/lib/widgets.js ← registerPlugin('QuranWidgets')، الجلسة ٣ ج ١):
 *   setKhatma({ data: { theme, days } }): يحفظ حال الأيام القادمة لويدجت «ختمتي اليوم» ويعيد رسمه (KhatmaWidget).
 *   setAyah({ data: { theme, riwayah } }): ألوان التطبيق وروايته لويدجت «آية اليوم» (AyahWidget، الجلسة ٣ ج ٢).
 *   والضغط على الويدجت يصل إلى الصفحة بحدث «open» في QuranReminders، كالضغط على إشعار التذكير.
 */
@CapacitorPlugin(name = "QuranWidgets")
public class QuranWidgetsPlugin extends Plugin {

    @PluginMethod
    public void setKhatma(PluginCall call) {
        JSObject data = call.getObject("data");
        if (data == null) {
            call.reject("no data");
            return;
        }
        KhatmaWidget.save(getContext(), data.toString());
        call.resolve();
    }

    @PluginMethod
    public void setAyah(PluginCall call) {
        JSObject data = call.getObject("data");
        if (data == null) {
            call.reject("no data");
            return;
        }
        AyahWidget.save(getContext(), data.toString());
        call.resolve();
    }
}
