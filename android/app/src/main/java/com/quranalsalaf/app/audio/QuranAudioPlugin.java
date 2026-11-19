package com.quranalsalaf.app.audio;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * صلة الصفحة بمشغّل التلاوة الأصلي (src/lib/nativeAudio.js ← registerPlugin('QuranAudio')).
 *
 * الأوامر: loadRange · pause · resume · stop · skip · setOptions · setTimer · getState، ولكلٍّ رقم cmd يُعاد في الحالة.
 * والحدث «state» عند كل تغيّر (AudioEngine.state). وشكل الأوامر عام لا يخصّ أندرويد، فيُكتب مشغّل الآيفون
 * لاحقًا على الشكل نفسه.
 */
@CapacitorPlugin(name = "QuranAudio")
public class QuranAudioPlugin extends Plugin implements AudioEngine.Listener {

    @Override
    public void load() {
        AudioEngine.setListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        AudioEngine.setListener(null);
    }

    @Override
    public void onState(JSONObject state) {
        try {
            notifyListeners("state", new JSObject(state.toString()));
        } catch (JSONException ignored) {
        }
    }

    private void send(PluginCall call, boolean start, Consumer<AudioEngine> task) {
        int cmd = call.getData().optInt("cmd", 0);
        AudioEngine.run(getContext(), start, e -> {
            e.setCmd(cmd);
            task.accept(e);
        });
        call.resolve();
    }

    /**
     * يحمّل مقدارًا. items: [{ f: روابط ملفات المقطع، b: رابط البسملة أو null، t: عنوانه، v: أول آياته، s: ما يُظلَّل }]
     */
    @PluginMethod
    public void loadRange(PluginCall call) {
        JSObject d = call.getData();
        AudioEngine.Load a = new AudioEngine.Load();
        try {
            a.mode = d.optString("mode", "start");
            a.pos = d.optInt("pos", 0);
            a.verseRepeat = d.optInt("verseRepeat", 1);
            a.rangeRepeat = d.optInt("rangeRepeat", 1);
            a.continuous = d.optBoolean("continuous", false);
            a.withBasmala = d.optBoolean("withBasmala", true);
            a.timerLeft = d.isNull("timerLeft") ? -1 : d.optLong("timerLeft", -1);
            a.artist = d.optString("artist", "");
            JSONArray items = d.getJSONArray("items");
            a.items = new ArrayList<>(items.length());
            a.metas = new ArrayList<>(items.length());
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                JSONArray f = it.getJSONArray("f");
                String[] files = new String[f.length()];
                for (int k = 0; k < files.length; k++) files[k] = f.getString(k);
                String basmala = it.isNull("b") ? null : it.optString("b", null);
                a.items.add(new Sequencer.Item(files, basmala));
                JSONArray s = it.getJSONArray("s");
                int[] shown = new int[s.length()];
                for (int k = 0; k < shown.length; k++) shown[k] = s.getInt(k);
                a.metas.add(new AudioEngine.Meta(it.optString("t", ""), it.getInt("v"), shown));
            }
        } catch (JSONException e) {
            call.reject("bad load", e);
            return;
        }
        send(call, "start".equals(a.mode), e -> e.load(a));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        send(call, false, AudioEngine::pause);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        send(call, false, AudioEngine::resume);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        send(call, false, e -> {
            if (e.active()) e.end("stopped");
        });
    }

    @PluginMethod
    public void skip(PluginCall call) {
        int d = call.getData().optInt("d", 1);
        send(call, false, e -> e.skip(d));
    }

    @PluginMethod
    public void setOptions(PluginCall call) {
        JSObject d = call.getData();
        int verseRepeat = d.optInt("verseRepeat", 1);
        int rangeRepeat = d.optInt("rangeRepeat", 1);
        send(call, false, e -> e.setOptions(verseRepeat, rangeRepeat));
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        JSObject d = call.getData();
        long left = d.isNull("left") ? -1 : d.optLong("left", -1);
        send(call, false, e -> e.setTimer(left));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        AudioEngine.snapshot(s -> {
            try {
                call.resolve(new JSObject(s.toString()));
            } catch (JSONException e) {
                call.resolve(new JSObject());
            }
        });
    }
}
