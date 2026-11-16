import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { countNoun, countText, MINUTES } from '../lib/count.js';
import { covers, reciterTitle } from '../lib/reciters.js';
import { FOREVER, REPEATS, TIMER_OPTIONS, cancelDownload, chosenReciter, downloadRange, isDownloaded, parseMinutes, reciterKey, setSettings, setTimer, timerShort, usePlayer, useTimerTick } from '../lib/player.js';
import ReciterPicker from './ReciterPicker.jsx';
import RangeBar from './RangeBar.jsx';
import './ListenSheet.css';
import { useLayer } from '../lib/layers.js';

/*
  إعدادات الاستماع (الفصل ٦): بطاقة تنزلق من أسفل الشاشة عند الخانة اليمنى —
  القارئ (يُفتح من صفه قائمة كاملة، لا قائمة منسدلة)، وتكرار الآية، وتكرار المقدار
  (ومعه «بلا نهاية»)، ثم زرّ التشغيل الفوري، وتحته تنزيل منفصل اختياري للاستماع بلا إنترنت.
  continuous: لا مقدار كامل، فالاستماع متتابع إلى آخر المصحف بلا تكرار للمقدار — من آية البداية إن حُددت
  وحدها (٢٠٢٦-١١-١٢)، وإلا من الصفحة الظاهرة
  (فيُعطَّل «تكرار المقدار»)، وverses آيات الصفحة أو الصفحتين الظاهرتين للتنزيل وحده.
  label: وصف المقدار المسموع (مقدار الاستماع المحدد، وإلا «من الصفحة … متتابعًا»)، suras: سوره.
  وفي أعلاها شريط «تحديد مقدار الآيات» خاص بالاستماع (٢٠٢٦-١١-١٠): range وonPickStart/onPickEnd/onClearRange،
  مستقل عن مقدار صفحات المحتوى، ولا يُخفت شيئًا في المصحف. وتعديله أثناء التشغيل يُطبَّق عند الإغلاق («تم»).
  والقارئ قارئ رواية المصحف المعروض (٢٠٢٦-١١-١٥): في ورش قرّاء ورش وحدهم، ولكل رواية قارئها المختار.
  و«مؤقّت التلاوة» (٢٠٢٦-١١-١٦) تحت «تكرار المقدار»: بلا مؤقت أو دقائق من القائمة أو «وقت آخر…» (١–٣٦٠
  دقيقة). قبل التشغيل يُضبط فورًا (ويبدأ عدّه مع «تشغيل»)، وأثناءه يُطبَّق عند إغلاق النافذة كالمقدار.
*/
export default function ListenSheet({ quran, verses, continuous, label, suras, range, onPickStart, onPickEnd, onClearRange, onPlay, onClose, onToast }) {
  const player = usePlayer();
  const { settings, download } = player;
  const active = player.status !== 'idle';
  const [pickerOpen, setPickerOpen] = useState(false);
  // اختيار المؤقّت أثناء التشغيل ينتظر الإغلاق: { minutes } (null = بلا مؤقت)
  const pendingTimer = useRef(null);
  const close = () => {
    if (pendingTimer.current) setTimer(pendingTimer.current.minutes);
    pendingTimer.current = null;
    onClose();
  };
  const chooseTimer = (minutes) => {
    if (active) pendingTimer.current = { minutes };
    else setTimer(minutes);
  };
  useLayer(close);
  const [downloaded, setDownloaded] = useState(false);
  const key = reciterKey(quran);
  useEffect(() => setDownloaded(isDownloaded(quran, verses)), [quran, verses, settings[key], download?.done]);

  const chosen = chosenReciter(quran, settings);
  const missing = !covers(chosen, suras);

  const chooseReciter = (id) => {
    if (!setSettings({ [key]: id })) onToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
  };

  const startDownload = async () => {
    const result = await downloadRange(quran, verses);
    if (result === 'unsupported') onToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
    else if (result === 'failed') onToast('تعذّر تنزيل الصوت. تحقّق من اتصالك بالإنترنت.');
  };

  return (
    <div className="listen">
      <div className="listen__backdrop" onClick={close} />
      <section className="listen__card" role="dialog" aria-label="الاستماع للآيات">
        <header className="listen__head">
          <div>
            <h2>الاستماع للآيات</h2>
            <span>{label}</span>
          </div>
          <button type="button" className="listen__close" onClick={close} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <RangeBar quran={quran} range={range} onPickStart={onPickStart} onPickEnd={onPickEnd} onClear={onClearRange} />

        <button type="button" className="listen__row listen__row--link" onClick={() => setPickerOpen(true)}>
          <span>القارئ</span>
          <span className="listen__value">
            {missing ? 'اختر قارئًا' : reciterTitle(chosen)}
            <ChevronIcon />
          </span>
        </button>
        {missing && <p className="listen__warn">تسجيل {reciterTitle(chosen)} لا يشمل هذا الموضع؛ اختر قارئًا آخر.</p>}

        <label className="listen__row">
          <span>تكرار الآية</span>
          <select value={settings.verseRepeat} onChange={(e) => setSettings({ verseRepeat: Number(e.target.value) })}>
            <option value={1}>بدون تكرار</option>
            {REPEATS.map((n) => (
              <option key={n} value={n}>
                {toArabicDigits(n)}
              </option>
            ))}
          </select>
        </label>

        <label className={`listen__row${continuous ? ' listen__row--off' : ''}`}>
          <span>تكرار المقدار</span>
          <select disabled={continuous} title={continuous ? (range?.length === 1 ? 'حدّد نهاية المقدار لتكراره' : 'حدّد مقدارًا لتكراره') : undefined} value={continuous ? 1 : settings.rangeRepeat} onChange={(e) => setSettings({ rangeRepeat: Number(e.target.value) })}>
            <option value={1}>بدون تكرار</option>
            {REPEATS.map((n) => (
              <option key={n} value={n}>
                {toArabicDigits(n)}
              </option>
            ))}
            <option value={FOREVER}>بلا نهاية ∞</option>
          </select>
        </label>

        <TimerRow timer={player.timer} active={active} onChoose={chooseTimer} />

        {active ? (
          <button type="button" className="listen__play" onClick={close}>
            تم
          </button>
        ) : (
          <button type="button" className="listen__play" onClick={onPlay} disabled={missing}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />
            </svg>
            تشغيل
          </button>
        )}

        {/* تنزيل منفصل واختياري: يُحمَّل الصوت كاملًا مقدمًا، فيعمل بعدها التشغيل بلا إنترنت */}
        {download?.active ? (
          <button type="button" className="listen__download listen__download--active" onClick={cancelDownload}>
            <span className="listen__spin" />
            {download.fileCount > 1 ? `جارٍ تنزيل الملف ${toArabicDigits(download.fileIndex)} من ${toArabicDigits(download.fileCount)}` : 'جارٍ تنزيل الصوت'}
            {download.pct != null && ` — ${toArabicDigits(download.pct)}٪`}
            <span className="listen__download-cancel">إلغاء</span>
          </button>
        ) : downloaded ? (
          <p className="listen__downloaded">
            <CheckIcon /> تم تنزيله — يعمل الآن بلا إنترنت
          </p>
        ) : (
          <button type="button" className="listen__download" onClick={startDownload} disabled={missing}>
            <DownloadIcon />
            تنزيل للاستماع بلا إنترنت
          </button>
        )}
      </section>

      {pickerOpen && (
        <ReciterPicker
          chosen={chosen.id}
          riwayah={quran.riwayah === 'warsh' ? 'warsh' : 'hafs'}
          suras={suras}
          onPick={chooseReciter}
          onClose={() => setPickerOpen(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
}

// سطر «مؤقّت التلاوة»: القائمة، وخانة الدقائق لـ«وقت آخر…»، وما بقي من المؤقّت ما دام يعدّ
function TimerRow({ timer, active, onChoose }) {
  const left = useTimerTick();
  const fromTimer = () => (!timer ? '' : TIMER_OPTIONS.includes(timer.minutes) ? String(timer.minutes) : 'custom');
  const [choice, setChoice] = useState(fromTimer);
  const [custom, setCustom] = useState(() => (timer && !TIMER_OPTIONS.includes(timer.minutes) ? toArabicDigits(timer.minutes) : ''));
  const [edited, setEdited] = useState(false);
  // انتهى المؤقّت أو أُلغي والنافذة مفتوحة (ولم يُغيَّر الاختيار فيها): يرجع السطر إلى «بلا مؤقت»
  useEffect(() => {
    if (!timer && !edited) setChoice('');
  }, [timer, edited]);

  const pick = (value) => {
    setChoice(value);
    setEdited(true);
    if (value === 'custom') {
      const n = parseMinutes(custom);
      if (n) onChoose(n);
      return;
    }
    onChoose(value ? Number(value) : null);
  };
  const type = (text) => {
    setCustom(text);
    setEdited(true);
    const n = parseMinutes(text);
    if (n) onChoose(n);
  };
  const invalid = choice === 'custom' && custom.trim() !== '' && !parseMinutes(custom);

  return (
    <>
      <label className="listen__row">
        <span className="listen__label">
          مؤقّت التلاوة
          {active && timer && left != null && !edited && (
            <small className="listen__left" aria-label={left > 0 ? `يتبقى ${countText(Math.ceil(left / 60000), MINUTES, toArabicDigits, true)}` : 'تقف التلاوة بعد الآية الجارية'}>
              {left > 0 ? `يتبقى ${timerShort(left)}` : 'تقف بعد الآية'}
            </small>
          )}
        </span>
        <select value={choice} onChange={(e) => pick(e.target.value)}>
          <option value="">بلا مؤقت</option>
          {TIMER_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {toArabicDigits(n)} {countNoun(n, MINUTES)}
            </option>
          ))}
          <option value="custom">وقت آخر…</option>
        </select>
      </label>
      {choice === 'custom' && (
        <label className="listen__row listen__row--custom">
          <span>عدد الدقائق</span>
          <span className="listen__minutes">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              placeholder="١–٣٦٠"
              aria-invalid={invalid || undefined}
              value={custom}
              onChange={(e) => type(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={edited}
            />
            دقيقة
          </span>
        </label>
      )}
      {invalid && <p className="listen__warn">اكتب عددًا من ١ إلى ٣٦٠ دقيقة.</p>}
    </>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="listen__chevron">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
