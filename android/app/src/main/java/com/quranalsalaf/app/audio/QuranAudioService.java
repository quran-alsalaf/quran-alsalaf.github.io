package com.quranalsalaf.app.audio;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.CommandButton;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionCommands;
import androidx.media3.session.SessionResult;

import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.quranalsalaf.app.R;

/**
 * خدمة التلاوة (الجلسة ٢ من التطبيق الأصلي، ٢٠٢٦-١١-١٨): تملك المشغّل (AudioEngine) وجلسة الوسائط، فتستمر
 * التلاوة والشاشة مقفلة، وبعد إغلاق التطبيق من قائمة التطبيقات المفتوحة (بقرار صاحب المشروع).
 *
 *   • الإشعار وشاشة القفل (Media3): «سورة … — الآية …» واسم القارئ، وأزرار السابق وتشغيل/إيقاف والتالي
 *     و«إنهاء» (يوقف التلاوة ويُخفي الإشعار، بقرار صاحب المشروع). والضغط على الإشعار يفتح التطبيق.
 *   • السابق والتالي آيةً آية (Sequencer.skip)، لا ملفات قائمة المشغّل.
 *   • احترام أصوات التطبيقات الأخرى (Audio Focus): الاتصال والتنبيه القصير يوقفانها ثم تكمل وحدها، وتشغيل
 *     مقطع في تطبيق آخر يوقفها وتبقى موقوفة. وفصل السمّاعة أو انقطاع البلوتوث يوقفها.
 */
public class QuranAudioService extends MediaSessionService {

    static final SessionCommand END = new SessionCommand("quran.END", Bundle.EMPTY);

    private MediaSession session;
    private AudioEngine engine;

    @Override
    public void onCreate() {
        super.onCreate();
        ExoPlayer player = new ExoPlayer.Builder(this)
            .setAudioAttributes(
                new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(),
                /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();
        engine = new AudioEngine(player, Uri.parse("asset:///public/icons/icon-512.png"));

        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent activity = open == null ? null
            : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        CommandButton endButton = new CommandButton.Builder(CommandButton.ICON_STOP)
            .setDisplayName(getString(R.string.audio_end))
            .setSessionCommand(END)
            .build();

        MediaSession.Builder builder = new MediaSession.Builder(this, new SessionPlayer(player, engine))
            .setId("quran")
            .setCallback(new Callback())
            .setMediaButtonPreferences(ImmutableList.of(endButton));
        if (activity != null) builder.setSessionActivity(activity);
        session = builder.build();

        DefaultMediaNotificationProvider provider = new DefaultMediaNotificationProvider.Builder(this)
            .setChannelName(R.string.audio_channel)
            .build();
        provider.setSmallIcon(R.drawable.ic_stat_quran);
        setMediaNotificationProvider(provider);

        AudioEngine.attach(engine);
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    // إغلاق التطبيق من قائمة التطبيقات المفتوحة: تستمر التلاوة إن كانت جارية، وإلا تُغلق الخدمة
    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (!engine.active() || !session.getPlayer().getPlayWhenReady()) stopSelf();
    }

    @Override
    public void onDestroy() {
        AudioEngine.detach(engine);
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    /** زرّ «إنهاء» في الإشعار وشاشة القفل. */
    private final class Callback implements MediaSession.Callback {
        @Override
        public MediaSession.ConnectionResult onConnect(MediaSession s, MediaSession.ControllerInfo controller) {
            SessionCommands commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().add(END).build();
            return new MediaSession.ConnectionResult.AcceptedResultBuilder(s).setAvailableSessionCommands(commands).build();
        }

        @Override
        public ListenableFuture<SessionResult> onCustomCommand(
            MediaSession s, MediaSession.ControllerInfo controller, SessionCommand command, Bundle args) {
            if (END.customAction.equals(command.customAction)) engine.end("stopped");
            return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
        }
    }

    /**
     * المشغّل كما تراه جلسة الوسائط: السابق والتالي والإيقاف التام تمرّ بالمحرّك، وزرّا السابق والتالي ظاهران
     * دائمًا (قائمة المشغّل الفعلية ملفان فقط: الجاري والذي بعده).
     */
    private static final class SessionPlayer extends ForwardingPlayer {
        private final AudioEngine engine;

        SessionPlayer(Player player, AudioEngine engine) {
            super(player);
            this.engine = engine;
        }

        private static final int[] SKIP = {
            Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
        };

        @Override
        public Player.Commands getAvailableCommands() {
            return super.getAvailableCommands().buildUpon().addAll(SKIP).build();
        }

        @Override
        public boolean isCommandAvailable(int command) {
            for (int c : SKIP) if (c == command) return true;
            return super.isCommandAvailable(command);
        }

        @Override
        public boolean hasNextMediaItem() {
            return engine.active();
        }

        @Override
        public boolean hasPreviousMediaItem() {
            return engine.active();
        }

        @Override
        public void seekToNext() {
            engine.skip(1);
        }

        @Override
        public void seekToNextMediaItem() {
            engine.skip(1);
        }

        @Override
        public void seekToPrevious() {
            engine.skip(-1);
        }

        @Override
        public void seekToPreviousMediaItem() {
            engine.skip(-1);
        }

        @Override
        public void play() {
            engine.resume();
        }

        @Override
        public void pause() {
            engine.pause();
        }

        @Override
        public void stop() {
            if (engine.active()) engine.end("stopped");
        }
    }
}
