package com.quranalsalaf.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.quranalsalaf.app.audio.QuranAudioPlugin;
import com.quranalsalaf.app.audio.QuranDownloadsPlugin;
import com.quranalsalaf.app.feedback.QuranFeedbackPlugin;
import com.quranalsalaf.app.gallery.QuranGalleryPlugin;
import com.quranalsalaf.app.reminders.QuranRemindersPlugin;
import com.quranalsalaf.app.update.QuranUpdatePlugin;
import com.quranalsalaf.app.widgets.QuranWidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // مشغّل التلاوة الأصلي (src/lib/nativeAudio.js): إضافة من التطبيق نفسه، تُسجَّل قبل إنشاء الصفحة
        registerPlugin(QuranAudioPlugin.class);
        // حفظ صوت القرّاء والمقدار على الجهاز (src/lib/nativeFiles.js)
        registerPlugin(QuranDownloadsPlugin.class);
        // تذكير الختمة اليومي (src/lib/reminders.js)
        registerPlugin(QuranRemindersPlugin.class);
        // «رأيك يهمنا»: نافذة التقييم، وصفحة المتجر، وفتح واتساب (src/lib/feedback.js)
        registerPlugin(QuranFeedbackPlugin.class);
        // ويدجتات الشاشة الرئيسية: «ختمتي اليوم» (src/lib/widgets.js)
        registerPlugin(QuranWidgetsPlugin.class);
        // تنبيه التحديث: تحديثات جوجل بلاي داخل التطبيق (src/lib/appUpdate.js)
        registerPlugin(QuranUpdatePlugin.class);
        // حفظ صور المشاركة في معرض الجوال (src/lib/shareFiles.js)
        registerPlugin(QuranGalleryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
