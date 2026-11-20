package com.quranalsalaf.app.audio;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * مشغّل التلاوة الأصلي (الجلسة ٢ من التطبيق الأصلي، ٢٠٢٦-١١-١٨).
 *
 * يملكه QuranAudioService (فيبقى والشاشة مقفلة والتطبيق مغلق)، ويأمره التطبيق عبر QuranAudioPlugin.
 * الترتيب كله هنا (Sequencer)، لا في كود الصفحة، فلا تتأثر التلاوة إذا أوقف أندرويد الصفحة في الخلفية:
 * البسملة، وتكرار الآية والمقدار، والسابق والتالي، ومؤقّت التلاوة.
 *
 * قائمة المشغّل دائمًا: الملف الجاري ثم الذي بعده، فيحمّل المشغّل التالي مسبقًا وتتصل التلاوة بلا فراغ.
 * وعند كل انتقال يُحذف ما قبل الجاري ويُضاف ما بعده.
 *
 * مؤقّت التلاوة: يعدّ ما دامت التلاوة تعمل (أو تتحمّل)، ويتجمّد في الإيقاف. وإذا انتهى الوقت أكملت الآية
 * الجارية ثم وقفت (لا يُضاف بعدها شيء، فتنتهي القائمة) — كما في الموقع (src/lib/player.js).
 *
 * كل ما هنا على الخيط الرئيسي (خيط المشغّل).
 */
public final class AudioEngine implements Player.Listener {

    private static final String TAG = "QuranAudio";

    /** ما يُبلَّغ به التطبيق عند كل تغيّر (QuranAudioPlugin ← حدث «state» في src/lib/nativeAudio.js). */
    public interface Listener {
        void onState(JSONObject state);
    }

    /** بيانات المقطع للعرض: عنوانه في الإشعار، وأول آياته، وما يُظلَّل منها (أرقامها في المصحف). */
    public static final class Meta {
        final String title;
        final int v;
        final int[] shown;

        public Meta(String title, int v, int[] shown) {
            this.title = title;
            this.v = v;
            this.shown = shown;
        }
    }

    /** أمر تحميل مقدار من التطبيق (loadRange في src/lib/nativeAudio.js). */
    public static final class Load {
        /** start: من أول المقدار بعدّادات جديدة · continue: يكمل الجاري بمقدار جديد · restart: يعيد المقطع pos (تغيير القارئ). */
        public String mode;
        public List<Sequencer.Item> items;
        public List<Meta> metas;
        public int pos;
        public int verseRepeat;
        public int rangeRepeat;
        public boolean continuous;
        public boolean withBasmala;
        /** ما بقي من مؤقّت التلاوة بالملي ثانية عند start (أقل من ٠: بلا مؤقّت). */
        public long timerLeft = -1;
        public String artist;
    }

    // ---------- النسخة الوحيدة (يُنشئها QuranAudioService) ----------
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static AudioEngine instance;
    private static final List<Consumer<AudioEngine>> pending = new ArrayList<>();
    private static Listener listener;

    /** ينفّذ task على المشغّل في الخيط الرئيسي؛ وإن لم تكن الخدمة قائمة شغّلها ثم نفّذه (start = true). */
    public static void run(Context ctx, boolean start, Consumer<AudioEngine> task) {
        Context app = ctx.getApplicationContext();
        MAIN.post(() -> {
            if (instance != null) {
                task.accept(instance);
                return;
            }
            if (!start) return;
            pending.add(task);
            try {
                app.startService(new Intent(app, QuranAudioService.class));
            } catch (RuntimeException e) {
                Log.w(TAG, "تعذّر تشغيل خدمة الصوت", e);
                pending.clear();
            }
        });
    }

    /** حالة المشغّل الآن، أو «idle» إن لم تكن الخدمة قائمة. */
    public static void snapshot(Consumer<JSONObject> out) {
        MAIN.post(() -> out.accept(instance != null ? instance.state(null) : idleState()));
    }

    public static void setListener(@Nullable Listener l) {
        listener = l;
    }

    static void attach(AudioEngine e) {
        instance = e;
        List<Consumer<AudioEngine>> tasks = new ArrayList<>(pending);
        pending.clear();
        for (Consumer<AudioEngine> t : tasks) t.accept(e);
    }

    static void detach(AudioEngine e) {
        if (instance == e) instance = null;
    }

    // ---------- المشغّل ----------
    private final ExoPlayer player;
    private final Uri artwork;
    private Sequencer seq;
    private List<Meta> metas = new ArrayList<>();
    private String artist = "";
    /** الجاري الآن، أو null والمشغّل متوقف. */
    private Sequencer.Cursor cur;
    /** يُزاد عند بدء كل ملف (آية أو بسملة أو إعادتها): به يعرف التطبيق بدء الآية التالية ولو كانت هي نفسها. */
    private int segment;
    /** رقم آخر أمر من التطبيق، يُعاد في كل حالة: فيُهمل التطبيق ما سبق أوامره الأخيرة. */
    private int cmd;
    private int ids;
    private final Map<String, Sequencer.Cursor> cursors = new HashMap<>();

    // مؤقّت التلاوة: timerLeft ما بقي عند آخر تجميد (أقل من ٠: بلا مؤقّت)، وtimerEndsAt موعد انتهائه ما دام يعدّ
    private long timerLeft = -1;
    private long timerEndsAt = -1;
    private final Runnable timerCheck = this::onTimerCheck;

    AudioEngine(ExoPlayer player, Uri artwork) {
        this.player = player;
        this.artwork = artwork;
        player.addListener(this);
    }

    public boolean active() {
        return cur != null;
    }

    public void setCmd(int c) {
        if (c > cmd) cmd = c;
    }

    // ---------- أوامر التطبيق ----------
    public void load(Load a) {
        Sequencer next = new Sequencer(a.items, Math.max(1, a.verseRepeat), a.rangeRepeat, a.continuous);
        if (a.items.isEmpty() || a.pos < 0 || a.pos >= a.items.size()) {
            emit(null);
            return;
        }
        if ("continue".equals(a.mode) || "restart".equals(a.mode)) {
            if (cur == null) {
                emit(null);
                return;
            }
            Sequencer.Cursor was = cur;
            seq = next;
            metas = a.metas;
            artist = a.artist;
            if ("restart".equals(a.mode)) {
                playFrom(seq.start(a.pos, was.verseRep, was.rangeRep, a.withBasmala));
                return;
            }
            // يكمل الملف الجاري كما هو، ويُحسب ما بعده من المقدار الجديد
            int files = a.items.get(a.pos).files.length;
            int part = was.isBasmala() ? Sequencer.BASMALA : Math.min(was.part, files - 1);
            cur = new Sequencer.Cursor(a.pos, part, was.verseRep, was.rangeRep);
            refreshNext();
            emit(null);
            return;
        }
        seq = next;
        metas = a.metas;
        artist = a.artist;
        clearTimer();
        if (a.timerLeft >= 0) timerLeft = a.timerLeft;
        playFrom(seq.start(a.pos, 0, 0, true));
    }

    public void pause() {
        if (cur != null) player.pause();
        emit(null);
    }

    public void resume() {
        if (cur != null) {
            if (player.getPlaybackState() == Player.STATE_IDLE) player.prepare();
            player.play();
        }
        emit(null);
    }

    /** السابق (-1) أو التالي (1): من الإشعار وشاشة القفل. */
    public void skip(int d) {
        if (cur == null) return;
        playFrom(seq.skip(cur, d));
    }

    /** تغيّر تكرار الآية أو المقدار أثناء التلاوة: يسري من نهاية الجاري. */
    public void setOptions(int verseRepeat, int rangeRepeat) {
        if (seq == null) return;
        seq.verseRepeat = Math.max(1, verseRepeat);
        seq.rangeRepeat = rangeRepeat;
        if (cur != null) refreshNext();
        emit(null);
    }

    /** يضبط مؤقّت التلاوة بما بقي منه بالملي ثانية، أو يلغيه (أقل من ٠). */
    public void setTimer(long left) {
        clearTimer();
        if (left >= 0) timerLeft = left;
        syncTimer();
        if (cur != null) refreshNext();
        emit(null);
    }

    /** إيقاف التلاوة كلها. reason: stopped (التطبيق أو «إنهاء») · ended (انتهى المقدار) · timer · error */
    public void end(String reason) {
        cur = null;
        clearTimer();
        cursors.clear();
        player.stop();
        player.clearMediaItems();
        emit(reason);
    }

    // ---------- القائمة ----------
    private void playFrom(Sequencer.Cursor c) {
        cur = c;
        segment++;
        cursors.clear();
        List<MediaItem> list = new ArrayList<>();
        list.add(item(c));
        Sequencer.Cursor after = upcoming();
        if (after != null) list.add(item(after));
        player.setMediaItems(list);
        player.prepare();
        player.play();
        emit(null);
    }

    /** ما يُقرأ بعد الجاري، أو null: انتهى المقدار، أو انتهى المؤقّت والجاري آخر الآية. */
    @Nullable
    private Sequencer.Cursor upcoming() {
        if (cur == null) return null;
        if (timerExpired() && seq.endsVerse(cur)) return null;
        return seq.advance(cur);
    }

    /** يعيد حساب ما بعد الجاري في قائمة المشغّل. */
    private void refreshNext() {
        int i = player.getCurrentMediaItemIndex();
        int count = player.getMediaItemCount();
        if (count > i + 1) player.removeMediaItems(i + 1, count);
        Sequencer.Cursor after = upcoming();
        if (after != null) player.addMediaItem(item(after));
    }

    private MediaItem item(Sequencer.Cursor c) {
        String id = "s" + (++ids);
        cursors.put(id, c);
        Meta m = metas.get(c.pos);
        MediaMetadata md = new MediaMetadata.Builder()
            .setTitle(m.title)
            .setArtist(artist)
            .setArtworkUri(artwork)
            .build();
        return new MediaItem.Builder().setMediaId(id).setUri(uri(seq.file(c))).setMediaMetadata(md).build();
    }

    /** مجلد ملفات الصوت المحفوظة على الجهاز (QuranDownloads.root)، يضبطه QuranAudioService. */
    @Nullable
    static File filesRoot;

    /**
     * رابط الملف للمشغّل. ما في التطبيق نفسه (مقاطع ورش المقطوعة، public/audio/warsh) رابطه في الصفحة على
     * https://localhost (خادم Capacitor الداخلي)، والمشغّل يقرؤه من ملفات التطبيق مباشرة.
     * وما حُفظ على الجهاز (تحميل القارئ لكامل القرآن، أو «تنزيل» مقدار — AudioFiles) يُقرأ من ملفه بلا إنترنت،
     * ولو كان تحميل القارئ ناقصًا؛ وإلا بُثّ من رابطه.
     */
    static Uri uri(String url) {
        Uri u = Uri.parse(url);
        if ("localhost".equals(u.getHost())) return Uri.parse("asset:///public" + u.getEncodedPath());
        File root = filesRoot;
        File saved = root == null ? null : AudioFiles.saved(root, url);
        if (saved != null) return Uri.fromFile(saved);
        return u;
    }

    // ---------- أحداث المشغّل ----------
    @Override
    public void onMediaItemTransition(@Nullable MediaItem item, int reason) {
        if (item == null || reason == Player.MEDIA_ITEM_TRANSITION_REASON_PLAYLIST_CHANGED) return;
        Sequencer.Cursor c = cursors.get(item.mediaId);
        if (c == null || cur == null) return;
        // انتهى المؤقّت قبيل نهاية الآية فبدأ ما بعدها: يقف الآن
        if (timerExpired() && seq.endsVerse(cur)) {
            end("timer");
            return;
        }
        cur = c;
        segment++;
        int i = player.getCurrentMediaItemIndex();
        if (i > 0) player.removeMediaItems(0, i);
        cursors.keySet().retainAll(java.util.Collections.singleton(item.mediaId));
        refreshNext();
        emit(null);
    }

    @Override
    public void onPlaybackStateChanged(int state) {
        if (state == Player.STATE_ENDED && cur != null) {
            end(timerExpired() ? "timer" : "ended");
            return;
        }
        syncTimer();
        emit(null);
    }

    @Override
    public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
        syncTimer();
        emit(null);
    }

    @Override
    public void onPlaybackSuppressionReasonChanged(int reason) {
        syncTimer();
        emit(null);
    }

    @Override
    public void onPlayerError(PlaybackException error) {
        Log.w(TAG, "خطأ في التشغيل", error);
        if (cur != null) end("error");
    }

    // ---------- مؤقّت التلاوة ----------
    private boolean counting() {
        int s = player.getPlaybackState();
        return cur != null && player.getPlayWhenReady()
            && player.getPlaybackSuppressionReason() == Player.PLAYBACK_SUPPRESSION_REASON_NONE
            && (s == Player.STATE_BUFFERING || s == Player.STATE_READY);
    }

    private boolean hasTimer() {
        return timerLeft >= 0 || timerEndsAt >= 0;
    }

    private long timerRemaining() {
        if (timerEndsAt >= 0) return Math.max(0, timerEndsAt - SystemClock.elapsedRealtime());
        return timerLeft;
    }

    private boolean timerExpired() {
        return hasTimer() && timerRemaining() <= 0;
    }

    private void syncTimer() {
        if (!hasTimer()) return;
        long now = SystemClock.elapsedRealtime();
        if (counting() && timerEndsAt < 0) {
            timerEndsAt = now + timerLeft;
            timerLeft = -1;
            MAIN.removeCallbacks(timerCheck);
            MAIN.postDelayed(timerCheck, Math.max(0, timerEndsAt - now));
        } else if (!counting() && timerEndsAt >= 0) {
            timerLeft = Math.max(0, timerEndsAt - now);
            timerEndsAt = -1;
            MAIN.removeCallbacks(timerCheck);
        }
    }

    private void clearTimer() {
        MAIN.removeCallbacks(timerCheck);
        timerLeft = -1;
        timerEndsAt = -1;
    }

    // انتهى الوقت: لا يُقرأ بعد الآية الجارية شيء (وإن كانت البسملة الجارية قُرئت آيتها ثم وقفت)
    private void onTimerCheck() {
        if (cur == null || !timerExpired()) return;
        refreshNext();
        emit(null);
    }

    // ---------- الحالة للتطبيق ----------
    private String status() {
        if (cur == null) return "idle";
        if (!player.getPlayWhenReady()
            || player.getPlaybackSuppressionReason() != Player.PLAYBACK_SUPPRESSION_REASON_NONE) return "paused";
        return player.getPlaybackState() == Player.STATE_READY ? "playing" : "loading";
    }

    private static JSONObject idleState() {
        JSONObject o = new JSONObject();
        try {
            o.put("status", "idle");
        } catch (JSONException ignored) {
        }
        return o;
    }

    JSONObject state(@Nullable String reason) {
        JSONObject o = new JSONObject();
        try {
            o.put("status", status());
            o.put("cmd", cmd);
            o.put("segment", segment);
            if (reason != null) o.put("reason", reason);
            if (cur != null) {
                Meta m = metas.get(cur.pos);
                o.put("pos", cur.pos);
                o.put("v", m.v);
                JSONArray shown = new JSONArray();
                for (int x : m.shown) shown.put(x);
                o.put("shown", shown);
                o.put("basmala", cur.isBasmala());
            }
            if (hasTimer()) {
                o.put("timerLeft", timerRemaining());
                o.put("counting", timerEndsAt >= 0);
            }
        } catch (JSONException ignored) {
        }
        return o;
    }

    private void emit(@Nullable String reason) {
        if (listener != null) listener.onState(state(reason));
    }
}
