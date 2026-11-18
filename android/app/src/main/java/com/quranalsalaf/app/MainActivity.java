package com.quranalsalaf.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.quranalsalaf.app.audio.QuranAudioPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // مشغّل التلاوة الأصلي (src/lib/nativeAudio.js): إضافة من التطبيق نفسه، تُسجَّل قبل إنشاء الصفحة
        registerPlugin(QuranAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
