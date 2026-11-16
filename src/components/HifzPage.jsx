import { useCallback, useEffect, useMemo, useState } from 'react';
import Reader from './Reader.jsx';
import { MistakesPicker, ReciteBar } from './Recite.jsx';
import { toArabicDigits } from '../data/quran.js';
import { spreadStart } from '../lib/layout.js';
import { useLayer } from '../lib/layers.js';
import { allRevealed, hideFrom, reveal } from '../lib/recite.js';
import { shownRange } from '../lib/verseMap.js';
import { FOREVER, pause, play, resume, setSettings, stop, usePlayer } from '../lib/player.js';
import { hifzLabel } from './HifzTab.jsx';
import './Khatma.css';

/*
  صفحة ختمة الحفظ (٢٠٢٦-١١-١٦): تُفتح من خطوات اليوم في تبويب «الختمة»، فوق المصحف بملء الشاشة كصفحة الورد.
  • 'learn' (احفظ): ورد اليوم وحده في المصحف (وما خارجه من صفحاته مُخفَت)، وتشغيله بالتكرار بالقارئ المختار
    (تكرار الآية والورد من إعدادات الاستماع نفسها، ولا يتغيّر مقدار الاستماع المحفوظ). ثم «سمّع الورد».
  • 'recite' وكذلك 'near' و'far': وضع التسميع على آيات الخطوة وحدها (ورد اليوم، أو آخر الأوراد، أو وحدة
    المراجعة البعيدة)، وبقية الصفحة ظاهرة. والقطع غير المتصلة في المصحف (أوراد الاتجاه العكسي، أو ما حُفظ
    من وحدة المراجعة) تُسمَّع قطعةً بعد قطعة، وكل قطعة محدودة بصفحاتها.
  • إذا كُشف آخر كلمة ظهر زرّ الإتمام: «أتممت حفظ الورد» أو «أتممت المراجعة».
  segments: مقادير الخطوة بترقيم حفص؛ وتُنقل هنا إلى ترقيم المصحف المعروض.
*/
const n = toArabicDigits;
const VERSE_REPEATS = [1, 3, 5, 10];
const WIRD_REPEATS = [1, 3, 5, FOREVER];
const TITLES = { learn: 'حفظ الورد', recite: 'تسميع الورد', near: 'المراجعة القريبة', far: 'المراجعة البعيدة' };

export default function HifzPage({ quran, kind, segments, title, onClose, onComplete, onToast, marks }) {
  const [mode, setMode] = useState(kind); // learn ثم recite
  const layer = useLayer(onClose);
  const segs = useMemo(() => segments.map((r) => shownRange(quran, [r[0], r[1]])), [quran, segments]);
  const [seg, setSeg] = useState(0);
  const [a, b] = segs[Math.min(seg, segs.length - 1)];
  const bounds = useMemo(() => [quran.verses[a].p, quran.verses[b].p], [quran, a, b]);
  const [page, setPage] = useState(bounds[0]);
  const [spread, setSpread] = useState(false);
  const onPage = useCallback((p) => setPage(p), []);
  const onSpread = useCallback((s) => setSpread(s), []);
  const shown = (spread ? [spreadStart(page), spreadStart(page) + 1] : [page]).filter((p) => p >= bounds[0] && p <= bounds[1]);
  const [goto, setGoto] = useState(null);
  const reciting = mode !== 'learn';

  // ---------- الاستماع (احفظ) ----------
  const player = usePlayer();
  const verses = useMemo(() => Array.from({ length: b - a + 1 }, (_, i) => a + i), [a, b]);
  // يقف الصوت عند الخروج من الصفحة أو الانتقال إلى التسميع
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (reciting) stop();
  }, [reciting]);
  // التقليب مع القارئ: آية خارج الصفحات الظاهرة ⇐ صفحتها
  useEffect(() => {
    if (reciting || player.v == null || !quran.verses[player.v]) return;
    const p = quran.verses[player.v].p;
    if (p >= bounds[0] && p <= bounds[1] && !shown.includes(p)) setGoto({ page: p, n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.v, player.n]);
  const startPlay = () => {
    if (play(quran, verses) === 'unsupported') onToast('تسجيل هذا القارئ لا يشمل هذا الموضع؛ اختر قارئًا آخر.');
  };

  // ---------- التسميع ----------
  const scope = useMemo(() => new Set(verses), [verses]);
  const [state, setState] = useState({});
  const [mistakes, setMistakes] = useState(false);
  const segPages = useMemo(() => Array.from({ length: bounds[1] - bounds[0] + 1 }, (_, i) => bounds[0] + i), [bounds]);
  const last = seg === segs.length - 1;
  const complete = reciting && last && allRevealed(quran, segPages, state, scope);
  // الكشف في أول صفحة من القطعة بقي فيها مخفي؛ فإن لم تكن ظاهرة انتقل إليها أولًا (لا «قلب» بعد قلب: الضغط
  // السريع أثناء حركة القلب كان يقلب صفحتين فتُتخطى صفحة). فإذا كُشفت القطعة كلها انتقل إلى التي بعدها
  const revealNext = (max) => {
    const pending = segPages.find((p) => !allRevealed(quran, [p], state, scope));
    if (pending != null) {
      if (!shown.includes(pending)) return setGoto({ page: pending, n: Date.now() });
      const next = reveal(quran, [pending], state, max, scope);
      if (next) setState(next);
      return;
    }
    if (!last) {
      // القارئ يُبنى من جديد للقطعة التالية، فلا يبقى له طلب انتقال سابق
      setGoto(null);
      setSeg(seg + 1);
      setState({});
      onToast(`القطعة ${n(seg + 2)} من ${n(segs.length)}`);
    }
  };
  const onWordTap = useCallback(
    (p, wi) => setState((s) => hideFrom(s, shown, p, wi) ?? s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown.join()]
  );

  const pageMarks = useMemo(
    () =>
      reciting
        ? { ...marks, bookmarks: null, range: null, selected: null, playing: null, flash: null, rubFlash: null, recite: state, reciteScope: scope }
        : { ...marks, range: [a, b], selected: null, flash: null, rubFlash: null, playing: player.vs },
    [reciting, marks, state, scope, a, b, player.vs]
  );

  const heading = kind === 'far' ? `${TITLES.far}، ${title}` : TITLES[mode];
  const where = segs.length > 1 ? `القطعة ${n(seg + 1)} من ${n(segs.length)}: ` : '';
  const playing = player.status !== 'idle';

  return (
    <div className="kpage hpage" role="dialog" aria-modal="true" aria-label={heading}>
      <header className="kpage__head">
        <button type="button" className="kpage__back" onClick={onClose} aria-label="رجوع">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="kpage__title">
          <h2>{heading}</h2>
          <span>
            {where}
            {hifzLabel(quran, [a, b])}
          </span>
        </div>
      </header>

      <div className="kpage__reader">
        <Reader
          key={`${mode}-${seg}`}
          quran={quran}
          bounds={bounds}
          startPage={bounds[0]}
          persist={false}
          layer={layer}
          goto={goto}
          onPage={onPage}
          onSpread={onSpread}
          onWordTap={reciting ? onWordTap : undefined}
          marks={pageMarks}
          arrows
        />
      </div>

      <footer className="kpage__foot hpage__foot">
        {complete ? (
          <button type="button" className="khatma__btn khatma__btn--primary kpage__done" onClick={onComplete}>
            {kind === 'learn' ? 'أتممت حفظ الورد ✓' : 'أتممت المراجعة ✓'}
          </button>
        ) : reciting ? (
          <ReciteBar inline onWords={() => revealNext(2)} onVerse={() => revealNext(Infinity)} onMistakes={() => setMistakes(true)} />
        ) : (
          <div className="hpage__learn">
            <div className="hpage__repeats">
              <Repeats label="تكرار الآية" options={VERSE_REPEATS} value={player.settings.verseRepeat} onPick={(v) => setSettings({ verseRepeat: v })} />
              <Repeats label="تكرار الورد" options={WIRD_REPEATS} value={player.settings.rangeRepeat} onPick={(v) => setSettings({ rangeRepeat: v })} />
            </div>
            <div className="khatma__actions">
              {playing ? (
                <>
                  <button type="button" className="khatma__btn" onClick={player.status === 'paused' ? resume : pause}>
                    {player.status === 'paused' ? 'استئناف' : 'إيقاف مؤقت'}
                  </button>
                  <button type="button" className="khatma__btn" onClick={stop}>
                    إيقاف
                  </button>
                </>
              ) : (
                <button type="button" className="khatma__btn" onClick={startPlay}>
                  تشغيل الورد
                </button>
              )}
              <button
                type="button"
                className="khatma__btn khatma__btn--primary"
                onClick={() => {
                  setGoto(null);
                  setMode('recite');
                }}
              >
                سمع الورد
              </button>
            </div>
          </div>
        )}
      </footer>
      {mistakes && <MistakesPicker quran={quran} pages={shown} state={state} scope={scope} onClose={() => setMistakes(false)} onToast={onToast} />}
    </div>
  );
}

// خيارات التكرار: «مرة» ثم أعداد، و∞ بلا نهاية
function Repeats({ label, options, value, onPick }) {
  return (
    <div className="hpage__repeat" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onPick(o)}>
          {o === 1 ? 'مرة' : o === FOREVER ? '∞' : n(o)}
        </button>
      ))}
    </div>
  );
}
