import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  sharedNote,
  actionsInRange,
  loadTafsir,
  memoIndex,
  paragraphs,
  sectionLabel,
  sectionsInRange,
  copyContent,
  tafsirBlocks,
  tafsirInfo,
  shownTafsirText,
  useTafsirSource,
  verseLabel,
  verseText,
} from '../lib/study.js';
import { copyText } from '../lib/userdata.js';
import { NO_FAWAID, emphasisParts, faidaPlain, fawaidBlocks, loadFawaid, wholeHeading } from '../lib/fawaid.js';
import { useLayer } from '../lib/layers.js';
import { isWarsh } from '../lib/riwayah.js';
import { actionGroups, fawaidGroups, meaningGroups, rangeFileName, rangeNote, rangeSpec, tafsirGroups } from '../lib/shareContent.js';
import ShareImages from './ShareImages.jsx';
import RangeBar from './RangeBar.jsx';
import TafsirPicker from './TafsirPicker.jsx';
import './StudySheet.css';

/*
  صفحات المحتوى (الفصل ٥، وبهذا الاسم منذ ٢٠٢٦-١١-١٠): تفسير · معاني الكلمات · العمل بالآيات.
  واسمها في الواجهة «التدبّر» منذ ٢٠٢٦-١١-٢٣ (بقرار صاحب المشروع؛ لأن «صفحات المحتوى» لا يبيّن ما فيها).
  تُفتح بزرّ «التدبّر» في الشريط السفلي وحده (لا بالسحب):
  • في عرض الصفحة الواحدة («نسخة الجوال»): صفحة كاملة تغطي الشاشة، تُغلق بزرّ الرجوع في
    أولها وبزرّ الرجوع في أندرويد (يتولّاه App بسجل المتصفح).
  • في عرض الصفحتين («نسخة اللابتوب»): لوحة متمركزة فوق المصحف، تُغلق بـ✕ وEsc والنقر خارجها.
  وفوق التبويبات شريط «تحديد مقدار الآيات» خاص بصفحات المحتوى (مستقل عن مقدار الاستماع)؛
  وإن لم يُحدَّد فالمحتوى لآيات الصفحة الظاهرة أو الصفحتين الظاهرتين.
  والتبويبات ثلاثة ثابتة من اليمين، يُنتقل بينها باللمس أو بالسحب يمينًا ويسارًا (كتقليب
  المصحف: السحب نحو اليمين إلى التبويب الذي على اليسار). و«من فوائد الآيات» لصفحات النطاق،
  وفي كل تبويب زرّ «نسخ المحتوى» (٢٠٢٦-١١-١٤): الآية ثم محتواها، ثم التالية ثم محتواها، في المقدار كله.
  والتبويب الرابع «الفوائد» (٢٠٢٦-١١-٢٢): فوائد ختمات «التفسير والتدبر» لآيات المقدار (src/lib/fawaid.js).
  وبجانب «نسخ المحتوى» زرّ «مشاركة» (٢٠٢٦-١١-٢٣، «المشاركة» الجلسة ٢): صور آيات المقدار ومحتواها كما تُنسخ
  (src/lib/shareContent.js ← rangeSpec)، بمعاينة ShareImages نفسها.
*/
const TABS = [
  { id: 'tafsir', name: 'تفسير' },
  { id: 'meanings', name: 'معاني الكلمات' },
  { id: 'actions', name: 'العمل بالآيات' },
  { id: 'fawaid', name: 'الفوائد' },
];
const ACTIVE_TABS = TABS.map((t) => t.id);
const TAB_SWIPE_PX = 60;

// خارج نطاق المذكرات، ورسالتا الغياب بنصّهما (بتعديل صاحب المشروع)
export const UNAVAILABLE =
  'هذا المحتوى غير متوفر لهذه الآيات حاليًّا، وقد يُضاف في أي وقت. وهو متوفر الآن من سورة الفاتحة إلى سورة الأنعام، ومن سورة الملك إلى سورة الناس.';
export const NO_MEANINGS = 'لا توجد معاني كلمات ذُكرت في هذه الآية';
// مصدر معاني السور التي لا مذكرات فيها (٢٠٢٦-١١-٢٥، src/lib/study.js ← gharibOf)
export const GHARIB_CREDIT = 'المصدر: الميسّر في غريب القرآن الكريم — مجمع الملك فهد';
export const NO_ACTIONS = 'لا يوجد عمل بالآيات ذُكر في هذه الآية';

// panel: لوحة متمركزة (نسخة اللابتوب) بدل صفحة كاملة. onClose: الإغلاق بزرّه وبمفتاح Esc.
// range / onPickStart / onPickEnd / onClearRange: مقدار صفحات المحتوى (RangeBar)
const StudySheet = forwardRef(function StudySheet(
  { open, panel, onClose, onToast, quran, verses, pages, range, onPickStart, onPickEnd, onClearRange },
  ref
) {
  const [tab, setTab] = useState('tafsir');
  const [slide, setSlide] = useState(0); // اتجاه آخر انتقال بين التبويبات، لحركة المحتوى
  const bodyRef = useRef(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useLayer(onClose, open);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, verses, open]);

  const goTab = (id) => {
    const from = ACTIVE_TABS.indexOf(tabRef.current);
    const to = ACTIVE_TABS.indexOf(id);
    if (to < 0 || to === from) return;
    setSlide(to > from ? 1 : -1);
    setTab(id);
  };
  const goTabRef = useRef(goTab);
  goTabRef.current = goTab;

  // السحب الأفقي باللمس ينتقل بين التبويبات، وما سواه تمرير عادي للمحتوى
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let s = null;
    const onStart = (e) => {
      if (e.target.closest('input, .rbar')) return;
      const t = e.touches[0];
      s = { x: t.clientX, y: t.clientY, axis: null, dx: 0 };
    };
    const onMove = (e) => {
      if (!s) return;
      const t = e.touches[0];
      s.dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.axis) {
        if (Math.max(Math.abs(s.dx), Math.abs(dy)) < 10) return;
        s.axis = Math.abs(s.dx) > Math.abs(dy) ? 'x' : 'scroll';
      }
      if (s.axis === 'x') e.preventDefault();
    };
    const onEnd = () => {
      if (!s) return;
      const { axis, dx } = s;
      s = null;
      if (axis === 'x' && Math.abs(dx) > TAB_SWIPE_PX) {
        const i = ACTIVE_TABS.indexOf(tabRef.current) + (dx > 0 ? 1 : -1);
        if (i >= 0 && i < ACTIVE_TABS.length) goTabRef.current(ACTIVE_TABS[i]);
      }
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', onEnd);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);

  return (
    <section
      ref={ref}
      className={`study${panel ? ' study--panel' : ''}${open ? ' study--open' : ''}`}
      aria-hidden={!open}
      inert={open ? undefined : ''}
      role="dialog"
      aria-modal="true"
      aria-label="التدبّر"
    >
      {/* في الصفحة الكاملة: سهم الرجوع في أولها (يمينًا) كصفحة الإعدادات. وفي اللوحة: ✕ في آخرها */}
      <header className="study__head">
        {!panel && (
          <button type="button" className="study__back" onClick={onClose} aria-label="رجوع">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h2>التدبّر</h2>
        {panel && (
          <button type="button" className="study__close" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div className="study__range">
        <RangeBar quran={quran} range={range} onPickStart={onPickStart} onPickEnd={onPickEnd} onClear={onClearRange} />
      </div>

      <nav className="study__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="study__tab"
            onClick={() => goTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </nav>

      <div className="study__body" ref={bodyRef}>
        <div key={tab} className={`study__content${slide ? (slide > 0 ? ' study__content--next' : ' study__content--prev') : ''}`}>
          {tab === 'tafsir' && <TafsirTab quran={quran} verses={verses} pages={pages} onToast={onToast} />}
          {tab === 'meanings' && <MeaningsTab quran={quran} verses={verses} onToast={onToast} />}
          {tab === 'actions' && <ActionsTab quran={quran} verses={verses} onToast={onToast} />}
          {tab === 'fawaid' && <FawaidTab quran={quran} verses={verses} onToast={onToast} />}
        </div>
      </div>
    </section>
  );
});

export default StudySheet;

// ---------- تفسير ----------
function TafsirTab({ quran, verses, pages, onToast }) {
  const [source, setSource] = useTafsirSource();
  const [data, setData] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (data[source]) return undefined;
    let alive = true;
    setFailed(false);
    loadTafsir(source).then(
      (t) => alive && setData((d) => ({ ...d, [source]: t })),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [source, data]);

  const t = data[source];
  const mukhtasar = source === 'mukhtasar';
  const shown = t ? verses : [];
  const fawaid = mukhtasar && t ? pages.flatMap((p) => t.fawaid[p] ?? []) : [];
  // تفسير آيات النطاق متتاليًا (والمختصر يجمع أحيانًا آيتين بتفسير واحد، فلا يُكرَّر؛
  // وآية السعدي التي لا كلام خاصًّا بها لا يُنسخ لها شيء)
  // اسم التفسير، ثم كل آية وتفسيرها بفقراته (والمختصر يجمع أحيانًا آيتين بتفسير واحد فتُكتبان معًا ثم
  // تفسيرهما؛ وآية السعدي التي لا كلام خاصًّا بها تُكتب مع الآيات التي قبلها)
  const copyTafsir = () =>
    copyContent(
      quran,
      tafsirInfo(source).title,
      tafsirBlocks(verses, (v) => shownTafsirText(source, t, quran, v)).map((b) => ({ ...b, text: paragraphs(b.text).join('\n') }))
    );

  const shareTafsir = () =>
    rangeSpec(quran, 'tafsir', verses, tafsirGroups(tafsirBlocks(verses, (v) => shownTafsirText(source, t, quran, v))), {
      credit: tafsirInfo(source).title,
    });

  return (
    <>
      {/* صفّ واحد: نسخ المحتوى يمينًا، واختيار التفسير في الوسط، والمشاركة يسارًا */}
      <CopyBar getText={t ? copyTafsir : null} getSpec={t && verses.length ? shareTafsir : null} quran={quran} kind="tafsir" verses={verses} onToast={onToast}>
        <TafsirPicker value={source} onChange={setSource} onToast={onToast} />
      </CopyBar>

      {!t && !failed && <p className="study__note">جارٍ تحميل التفسير…</p>}
      {failed && <p className="study__note">تعذّر تحميل التفسير. يُحمَّل مرة واحدة، ويحتاج لذلك اتصالًا بالإنترنت.</p>}

      {t &&
        shown.map((v) => {
          const verse = quran.verses[v];
          return (
            <div key={v} className="study__item">
              {verse.a === 1 && <SuraTitle quran={quran} sura={verse.s} />}
              {mukhtasar && verse.a === 1 && t.maqasid[verse.s] && (
                <div className="study__box study__box--note">
                  <h3>من مقاصد السورة</h3>
                  <p>{t.maqasid[verse.s]}</p>
                </div>
              )}
              <VerseCard quran={quran} v={v} />
              <div className="study__box study__box--explain">
                <TafsirBody text={shownTafsirText(source, t, quran, v)} source={source} />
              </div>
            </div>
          );
        })}

      {fawaid.length > 0 && (
        <div className="study__box study__box--note">
          <h3>من فوائد الآيات</h3>
          <ul>
            {fawaid.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* رابط يوتيوب قسم التفسير في المذكرات — مع المختصر وحده (الميسّر بلا روابط) */}
      {t && mukhtasar && <Links quran={quran} kind="t" verses={verses} />}
      <p className="study__credit">{tafsirInfo(source).title}</p>
    </>
  );
}

// نص تفسير آية مقسّمًا فقرات للقراءة (paragraphs)، أو تنبيه الآية التي لم يُفرد لها المفسّر (السعدي أو
// البغوي أو ابن كثير أو الطبري) كلامًا خاصًّا
// والآيات المقتبسة ﴿…﴾ بلون التطبيق، وبين الفقرات خط فاصل (٢٠٢٦-١١-١٦، كتطبيق «آية»)
export function TafsirBody({ text, source }) {
  if (!text) return <p className="study__shared">{sharedNote(source)}</p>;
  return paragraphs(text).map((p, i) => (
    <p key={i}>
      <QuotedText text={p} open="﴿" close="﴾" keepMarks className="study__ayah" />
    </p>
  ));
}

// ---------- معاني الكلمات: جدول لكل آية — الكلمة بلفظها من المصحف، ومعناها ----------
function MeaningsTab({ quran, verses, onToast }) {
  const idx = memoIndex(quran);
  const covered = verses.filter((v) => idx.meaningsCovered[v]);
  const copyBar = (getText, getSpec) => (
    <CopyBar getText={getText} getSpec={getSpec} quran={quran} kind="meanings" verses={verses} onToast={onToast} />
  );
  if (!covered.length) return (
    <>
      {copyBar(null, null)}
      <p className="study__note">{UNAVAILABLE}</p>
    </>
  );
  // كل آية لها معانٍ ثم معانيها (والآية بلا معانٍ لا تُنسخ)
  const meaningsText = () =>
    copyContent(
      quran,
      'معاني الكلمات',
      covered
        .filter((v) => idx.meaningsOf.get(v)?.length)
        .map((v) => ({ verses: [v], text: idx.meaningsOf.get(v).map((w) => `${w.mushaf ?? w.word}: ${w.meaning}`).join('\n') }))
    );
  const hasWords = covered.some((v) => idx.meaningsOf.get(v)?.length);
  const meaningsSpec = () =>
    rangeSpec(
      quran,
      'meanings',
      verses,
      meaningGroups(covered.filter((v) => idx.meaningsOf.get(v)?.length).map((v) => ({ v, words: idx.meaningsOf.get(v) })))
    );

  const shown = covered;

  return (
    <>
      {copyBar(hasWords ? meaningsText : null, hasWords ? meaningsSpec : null)}
      {shown.map((v) => {
        const words = idx.meaningsOf.get(v) ?? [];
        return (
          <div key={v} className="study__item">
            {quran.verses[v].a === 1 && <SuraTitle quran={quran} sura={quran.verses[v].s} />}
            <VerseCard quran={quran} v={v} />
            {words.length ? (
              <table className="study__words">
                <tbody>
                  {words.map((w, i) => (
                    <tr key={i}>
                      <th scope="row">{w.mushaf ?? w.word}</th>
                      <td>{w.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="study__box study__box--explain">
                <p className="study__empty">{NO_MEANINGS}</p>
              </div>
            )}
          </div>
        );
      })}
      <Links quran={quran} kind="m" verses={verses} />
      {shown.some((v) => idx.gharibOf[v]) && <p className="study__credit">{GHARIB_CREDIT}</p>}
    </>
  );
}

// ---------- العمل بالآيات: بالموضوع لا بالآية ----------
function ActionsTab({ quran, verses, onToast }) {
  const idx = memoIndex(quran);
  const covered = verses.filter((v) => idx.sectionOf.a[v] >= 0);
  const list = useMemo(() => actionsInRange(quran, verses), [quran, verses]);
  // آيات كل توجيه ثم التوجيه (والتوجيهات المتتالية على الآيات نفسها تُجمع تحتها)
  const actionsText = () =>
    copyContent(quran, 'العمل بالآيات', list.map((i) => ({ verses: idx.actions[i].v, text: `• ${idx.actions[i].t}` })));
  const actionsSpec = () => rangeSpec(quran, 'actions', verses, actionGroups(list.map((i) => idx.actions[i])));
  const copyBar = (
    <CopyBar
      getText={list.length ? actionsText : null}
      getSpec={list.length ? actionsSpec : null}
      quran={quran}
      kind="actions"
      verses={verses}
      onToast={onToast}
    />
  );
  if (!covered.length) return (
    <>
      {copyBar}
      <p className="study__note">{UNAVAILABLE}</p>
    </>
  );

  const shown = list;

  return (
    <>
      {copyBar}
      {!list.length && <p className="study__note">{NO_ACTIONS}</p>}
      {shown.map((i) => {
        const a = idx.actions[i];
        return (
          <div key={i} className="study__box study__box--action">
            <p>
              <QuotedText text={a.t} open="﴿" close="﴾" keepMarks />
            </p>
            <span className="study__ref">{verseLabel(quran, a.v)}</span>
          </div>
        );
      })}
      <Links quran={quran} kind="a" verses={verses} />
    </>
  );
}

// ---------- الفوائد (٢٠٢٦-١١-٢٢): آيات كل فائدة ثم الفائدة، وآيات المقدار التي لا فوائد لها لا تظهر ----------
export function useFawaid() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFawaid().then(
      (d) => alive && setData(d),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, []);
  return [data, failed];
}

function FawaidTab({ quran, verses, onToast }) {
  const [data, failed] = useFawaid();
  const blocks = useMemo(() => (data ? fawaidBlocks(quran, data, verses) : []), [data, quran, verses]);
  // آيات كل فائدة ثم الفائدة، والفوائد المتتالية على الآيات نفسها تحت آياتها مرة واحدة
  const fawaidText = () =>
    copyContent(
      quran,
      'الفوائد',
      blocks.map((b) => ({
        verses: b.verses,
        head: b.all ? wholeHeading(quran, b.verses) : undefined,
        text: b.items.map(faidaPlain).join('\n\n'),
      }))
    );
  // عنوان كل كتلة: اسم السورة مرة واحدة فوق أول ما يُعرض منها (فوائدها العامة أو آيتها الأولى)، والفوائد
  // العامة عن مقطع من السورة تحت عنوانه («الكهف ٩–٢٦»)
  const suraShown = new Set();
  const headingOf = (b) => {
    const v = quran.verses[b.verses[0]];
    const head = b.all ? wholeHeading(quran, b.verses) : null;
    if (head && !head.startsWith('سورة ')) return <h3 className="study__sura">{head}</h3>;
    if (suraShown.has(v.s) || (!head && v.a !== 1)) return null;
    suraShown.add(v.s);
    return <SuraTitle quran={quran} sura={v.s} />;
  };
  return (
    <>
      <CopyBar
        getText={blocks.length ? fawaidText : null}
        getSpec={blocks.length ? () => rangeSpec(quran, 'fawaid', verses, fawaidGroups(blocks, (vs) => wholeHeading(quran, vs))) : null}
        quran={quran}
        kind="fawaid"
        verses={verses}
        onToast={onToast}
      />
      {!data && !failed && <p className="study__note">جارٍ تحميل الفوائد…</p>}
      {failed && <p className="study__note">تعذّر تحميل الفوائد.</p>}
      {data && !blocks.length && <p className="study__note">{NO_FAWAID}</p>}
      {data &&
        blocks.map((b) => (
          <div key={b.items[0].id} className="study__item">
            {headingOf(b)}
            {/* الفوائد العامة بلا سرد آياتها (٢٠٢٦-١١-٢٢، بطلب صاحب المشروع)، وغيرها تحت آياتها */}
            {!b.all && b.verses.map((v) => <VerseCard key={v} quran={quran} v={v} />)}
            <div className="study__box study__box--explain study__fawaid">
              {b.items.map((f) => (
                <FaidaBody key={f.id} f={f} />
              ))}
            </div>
          </div>
        ))}
    </>
  );
}

// فائدة واحدة: جزء الآية الذي تتكلم عنه، والعنوان، والقائل، والنص أسطرًا وبنودًا (البنود بنقطة بلون التطبيق)،
// والآيات المقتبسة والكلمات الملوّنة في صورة الفائدة (⸨…⸩) بلون التطبيق، والمصدر بخط أصغر، ثم التوجيه الدعوي
// (الختمة الثانية) منفصلًا بخط بلون التطبيق في أوله كما تحت الخط في صورته.
// (بلا وسم موضوع الختمة منذ الجلسة ٢، ٢٠٢٦-١١-٢٢، بقرار صاحب المشروع)
export function FaidaBody({ f }) {
  return (
    <article className="faida">
      {f.title && <h4 className="faida__title">{f.title}</h4>}
      {f.q && <p className="faida__q study__ayah">﴿{f.q}﴾</p>}
      {f.by && <p className="faida__by">{f.by}</p>}
      {f.t.split('\n').map((line, i) =>
        line.startsWith('• ') ? (
          <p key={i} className="faida__item">
            <FaidaLine text={line.slice(2)} />
          </p>
        ) : (
          <p key={i}>
            <FaidaLine text={line} />
          </p>
        )
      )}
      <p className="faida__src">{f.src}</p>
      {f.tip && (
        <p className="faida__tip">
          <FaidaLine text={f.tip} />
        </p>
      )}
    </article>
  );
}

// سطر فائدة: الكلمات الملوّنة ⸨…⸩ بلون التطبيق، وفي كلٍّ الآيات المقتبسة ﴿…﴾
function FaidaLine({ text }) {
  return emphasisParts(text).map(([em, part], i) =>
    em ? (
      <span key={i} className="faida__em">
        <QuotedText text={part} open="﴿" close="﴾" keepMarks className="study__ayah" />
      </span>
    ) : (
      <QuotedText key={i} text={part} open="﴿" close="﴾" keepMarks className="study__ayah" />
    )
  );
}

// ---------- أجزاء مشتركة ----------
function SuraTitle({ quran, sura }) {
  return <h3 className="study__sura">سورة {quran.suras[sura - 1].name}</h3>;
}

export function VerseCard({ quran, v }) {
  return (
    <div className="study__box study__box--verse" lang="ar">
      {verseText(quran, v)}
    </div>
  );
}

// نصّ فيه اقتباسات قرآنية بين علامتين (العمل بالآيات): يُكتب المقتبس بخط المصحف
export function QuotedText({ text, open, close, keepMarks, className = 'study__quote' }) {
  const parts = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const a = rest.indexOf(open);
    const b = a >= 0 ? rest.indexOf(close, a + 1) : -1;
    if (a < 0 || b < 0) {
      parts.push(rest);
      break;
    }
    if (a > 0) parts.push(rest.slice(0, a));
    const inner = rest.slice(a + open.length, b);
    parts.push(
      <span key={key++} className={className}>
        {keepMarks ? `${open}${inner}${close}` : inner}
      </span>
    );
    rest = rest.slice(b + close.length);
  }
  return parts;
}

// روابط يوتيوب أقسام المذكرات التي تمسّ النطاق — روابط نصية لا صور QR
function Links({ quran, kind, verses }) {
  const { sections } = memoIndex(quran);
  const list = sectionsInRange(quran, kind, verses);
  if (!list.length) return null;
  return (
    <div className="study__links">
      {list.map((i) => (
        <a key={i} href={sections[i].link} target="_blank" rel="noopener noreferrer" className="study__link">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5Z" fill="currentColor" />
          </svg>
          شرح {sectionLabel(quran, sections[i])} على يوتيوب
        </a>
      ))}
    </div>
  );
}

// زرّ «نسخ المحتوى» الصغير أعلى كل تبويب يمينًا (٢٠٢٦-١١-١٤، أُلغي «نسخ الآيات» بطلب صاحب
// المشروع)، وما بعده (اختيار التفسير) في الوسط، وزرّ «مشاركة» يسارًا (٢٠٢٦-١١-٢٣، «المشاركة» الجلسة ٢):
// getSpec ⇐ مواصفة صور المقدار (rangeSpec)، ومعطَّل كالنسخ إن خلا المقدار من المحتوى
function CopyBar({ getText, getSpec, quran, kind, verses, onToast, children }) {
  const copy = async (text) => onToast?.((await copyText(text)) ? 'نُسخ النص' : 'تعذّر النسخ');
  const [sharing, setSharing] = useState(null);
  return (
    <div className="study__copy">
      <button type="button" disabled={!getText} onClick={() => copy(getText())}>
        <CopyIcon />
        نسخ المحتوى
      </button>
      {children ?? <span />}
      {quran ? (
        <button type="button" disabled={!getSpec} onClick={() => setSharing(getSpec())}>
          <ShareIcon />
          مشاركة
        </button>
      ) : (
        <span />
      )}
      {/* في جسم الصفحة: حركة اللوحة والتبويبات (transform) تجعل الموضع الثابت نسبةً إليها */}
      {sharing &&
        createPortal(
          <ShareImages
            build={() => buildRangeImages(quran, sharing, verses)}
            name={rangeFileName(quran, kind, verses)}
            onClose={() => setSharing(null)}
            onToast={onToast}
          />,
          document.body
        )}
    </div>
  );
}

// صور المقدار، وتنبيه ما شُورك منه إن قُطع (من أصل آيات المقدار)
const buildRangeImages = (quran, spec, verses) =>
  import('../lib/shareImage.js')
    .then((m) => m.buildShareImages(spec, { warsh: isWarsh(quran) }))
    .then((r) => ({ ...r, note: r.truncated && !r.partial ? rangeNote(quran, spec, r.shown, verses.length) : null }));


// أيقونة المشاركة: ثلاث دوائر موصولة
export const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="17.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="6.5" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="17.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
