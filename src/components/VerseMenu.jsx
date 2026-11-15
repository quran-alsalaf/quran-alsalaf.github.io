import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { FOREVER } from '../lib/player.js';
import {
  copyVerse,
  loadTafsir,
  memoIndex,
  noteShareText,
  paragraphs,
  tafsirInfo,
  tafsirText,
  useTafsirSource,
  verseLabel,
  verseText,
} from '../lib/study.js';
import {
  bookmarksAt,
  copyText,
  createBookmark,
  defaultBookmarkColor,
  defaultBookmarkName,
  placeBookmark,
  noteOf,
  readNotes,
  setNote,
  shareText,
  unplaceBookmark,
  useUserData,
} from '../lib/userdata.js';
import BookmarkForm, { bookmarkMeta, typeName } from './BookmarkForm.jsx';
import { CopyIcon, NO_ACTIONS, ShareIcon, NO_MEANINGS, QuotedText, TafsirBody, UNAVAILABLE } from './StudySheet.jsx';
import TafsirPicker from './TafsirPicker.jsx';
import './VerseMenu.css';
import { useLayer } from '../lib/layers.js';

/*
  الضغط المطوّل على آية (الفصل ٤): مربع عائم كبير وسط الشاشة (٢٠٢٦-١١-١٢، بدل البطاقة الصغيرة فوق
  الآية)، في أعلاه اسم الآية ثم مربعات كبيرة، ثلاثة في كل صف من اليمين، بترتيب ثابت (٢٠٢٦-١١-١٤):
  تشغيل · علامة · ملاحظة / تفسير · معاني · عمل / فوائد · نسخ.
  والمربعات من ACTIONS وحدها، فيُضاف مربع جديد بسطر فيها (وبحالته في choose).
  • تشغيل ⇐ تختفي المربعات ويظهر في المربع نفسه (بزرّ رجوع) خياران:
      – «تشغيل الآية وحدها» ⇐ يظهر تحته عدد المرات (مرة · ٥ · ١٠ · ٢٠ · ٥٠ · بلا نهاية)، والضغط على
        أحدها يشغّل فورًا ويغلق المربع (playVerseAlone في App.jsx).
      – «بدء التشغيل من هذه الآية» ⇐ يبدأ فورًا متتابعًا بلا نهاية ولا تكرار (playFromVerse في App.jsx).
  • في أول كل بطاقة (تفسير/معاني/عمل/فوائد/ملاحظة) زرّ رجوع إلى المربعات (٢٠٢٦-١١-١٤).
  • تفسير/معاني/عمل ⇐ بطاقة عائمة أعلى الشاشة بمحتوى هذه الآية وحدها بلا نص الآية (٢٠٢٦-١١-١٤)،
    فيها زرّا نسخ وإغلاق، ونسخ المعاني والعمل للمحتوى وحده.
    والتفسير (٢٠٢٦-١١-١٤) تفسير واحد هو المختار، وفي أعلاه قائمة التبديل (TafsirPicker) وأزرار نسخه ومشاركته.
  • ملاحظة ⇐ كتابة ملاحظة الآية أو تعديلها (واحدة لكل آية)، و«إدراج الآية» فيها، ومشاركتها (NoteCard).
  • فوائد ⇐ بطاقة فيها أن الفوائد تُضاف لاحقًا (تنتظر ملفاتها).
  • نسخ ⇐ ينسخ الآية فورًا ﴿…﴾ [السورة: رقم] ويغلق المربع.
  • علامة ⇐ (٢٠٢٦-١١-١٤) تختفي المربعات ويظهر في المربع نفسه (بزرّ رجوع): «علامة جديدة» (اسم ولون
    ونوع، فتُنشأ وتوضع على الآية)، ثم العلامات التي على الآية ولكلٍّ زرّ إزالة، ثم بقية العلامات:
    الضغط على إحداها يضعها على الآية (والمتنقّلة تنتقل إليها) ويغلق المربع.
*/
const ACTIONS = [
  { id: 'play', name: 'تشغيل', icon: 'M8 5.5v13l10.5-6.5L8 5.5Z' },
  { id: 'bookmark', name: 'علامة', icon: 'M7 4.5h10v15l-5-3.6-5 3.6v-15Z' },
  { id: 'note', name: 'ملاحظة', icon: 'M5 19h3.5L18.5 9a2.1 2.1 0 0 0-3-3L5.5 16v3ZM13.5 8l3 3' },
  { id: 'tafsir', name: 'تفسير', icon: 'M5 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5ZM5 17a2.5 2.5 0 0 1 2.5-2.5H17M8.5 8h5M8.5 11h5' },
  { id: 'meanings', name: 'معاني', icon: 'M4 6.5h16M4 12h10M4 17.5h13' },
  { id: 'actions', name: 'عمل', icon: 'M5 12.5l4 4 10-10' },
  {
    id: 'fawaid',
    name: 'فوائد',
    icon: 'M9.5 17.5h5M10.5 20.5h3M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5v.5h5V15c0-.6.2-1.1.7-1.5a5.5 5.5 0 0 0-3.2-10Z',
  },
  {
    id: 'copy',
    name: 'نسخ',
    icon: 'M10 8h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2',
  },
];

// عدد مرات قراءة «الآية وحدها» (بطلب صاحب المشروع)
export const ALONE_REPEATS = [1, 5, 10, 20, 50, FOREVER];
const repeatName = (n) => (n === 1 ? 'مرة' : n === FOREVER ? 'بلا نهاية ∞' : toArabicDigits(n));

// noPlay: بلا مربع «تشغيل» (في صفحة ورد الختمة: الاستماع من المصحف نفسه)
export default function VerseMenu({ quran, pressed, onClose, onToast, onPlay, onPlayAlone, noPlay }) {
  // pressed.view: يُفتح المربع على بطاقة بعينها (تعديل الملاحظة من القائمة اليمنى يفتحه على 'note')
  const [view, setView] = useState(pressed.view ?? 'menu');
  const { v } = pressed;
  // Esc يغلق المربع؛ وفي خيارات التشغيل يرجع إلى المربعات؛ وفي الملاحظة يحفظها أولًا كزرّ ✕ فيها
  const saveNote = useRef(null);
  useLayer(() =>
    view === 'note' && saveNote.current ? saveNote.current() : view === 'play' || view === 'bookmark' ? setView('menu') : onClose()
  );

  // «نسخ» ينسخ الآية فورًا ويغلق المربع، وما سواه يفتح ما خلفه
  const choose = async (id) => {
    if (id !== 'copy') return setView(id);
    onClose();
    onToast((await copyText(copyVerse(quran, v))) ? 'نُسخت الآية' : 'تعذّر النسخ');
  };

  const boxed = view === 'menu' || view === 'play' || view === 'bookmark';
  const sub = view === 'play' ? 'تشغيل الآية' : view === 'bookmark' ? 'علامة' : null;

  return (
    <div className="vmenu">
      <div className="vmenu__backdrop" onClick={onClose} />
      {boxed && (
        <VerseBox quran={quran} v={v} sub={sub} onBack={() => setView('menu')} onClose={onClose}>
          {view === 'menu' ? (
            <Tiles onChoose={choose} noPlay={noPlay} />
          ) : view === 'bookmark' ? (
            <BookmarkChoices quran={quran} v={v} onToast={onToast} onDone={onClose} />
          ) : (
            <PlayChoices
              onAlone={(n) => {
                onClose();
                onPlayAlone(v, n);
              }}
              onFrom={() => {
                onClose();
                onPlay(v);
              }}
            />
          )}
        </VerseBox>
      )}
      {(view === 'tafsir' || view === 'meanings' || view === 'actions' || view === 'fawaid') && (
        <DetailCard quran={quran} v={v} kind={view} onClose={onClose} onBack={() => setView('menu')} onToast={onToast} />
      )}
      {view === 'note' && (
        <NoteCard quran={quran} v={v} onClose={onClose} onBack={() => setView('menu')} onToast={onToast} saveRef={saveNote} />
      )}
    </div>
  );
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// المربع العائم الكبير وسط الشاشة: اسم الآية وزرّ إغلاق، وفي خيارات التشغيل والعلامة (sub) عنوانها
// وزرّ رجوع إلى المربعات
function VerseBox({ quran, v, sub, onBack, onClose, children }) {
  const verse = quran.verses[v];
  const name = `${quran.suras[verse.s - 1].name}: ${toArabicDigits(verse.a)}`;
  return (
    <section className="vbox" role="dialog" aria-label={sub ? `${sub.split(' ')[0]} ${name}` : name}>
      <header className="vbox__head">
        {sub && (
          <button type="button" className="vcard__btn" onClick={onBack} aria-label="رجوع">
            <Icon d="M9 6l6 6-6 6" />
          </button>
        )}
        <div className="vbox__title">
          <h2>{sub ?? name}</h2>
          {sub && <span>{name}</span>}
        </div>
        <button type="button" className="vcard__btn" onClick={onClose} aria-label="إغلاق">
          <Icon d="M6 6l12 12M18 6 6 18" />
        </button>
      </header>
      {children}
    </section>
  );
}

// المربعات الكبيرة: لكلٍّ أيقونة وتسمية تحتها
function Tiles({ onChoose, noPlay }) {
  return (
    <div className="vmenu__picker" role="menu">
      {ACTIONS.filter((a) => !(noPlay && a.id === 'play')).map((a) => (
        <button key={a.id} type="button" role="menuitem" onClick={() => onChoose(a.id)} className="vmenu__action">
          <Icon d={a.icon} />
          <span className="vmenu__label">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

// اختيار العلامة للآية (٢٠٢٦-١١-١٤): علامة جديدة، ثم ما على الآية (بزرّ إزالة)، ثم بقية العلامات
function BookmarkChoices({ quran, v, onToast, onDone }) {
  const { bookmarks = [] } = useUserData();
  const [creating, setCreating] = useState(false);
  // إزالة علامة عن الآية بعد تأكيد (بطلب صاحب المشروع): رقم العلامة المسؤول عن إزالتها
  const [unplacing, setUnplacing] = useState(null);
  const here = bookmarksAt(bookmarks, v);
  const others = bookmarks.filter((b) => !here.includes(b));

  const place = (b) => {
    const result = placeBookmark(b.id, v);
    onToast(result === 'moved' ? `نُقلت علامة «${b.name}» إلى هذه الآية` : `وُضعت علامة «${b.name}»`);
    onDone();
  };

  if (creating) {
    return (
      <div className="vmark">
        <BookmarkForm
          initial={{ name: defaultBookmarkName(bookmarks), color: defaultBookmarkColor(bookmarks), multi: false }}
          submitLabel="إنشاء ووضعها على الآية"
          onCancel={() => setCreating(false)}
          onSubmit={(values) => {
            createBookmark(values, v);
            onToast(`وُضعت علامة «${values.name}»`);
            onDone();
          }}
        />
      </div>
    );
  }

  return (
    <div className="vmark">
      <button type="button" className="vmark__new" onClick={() => setCreating(true)}>
        <Icon d="M12 5v14M5 12h14" />
        علامة جديدة
      </button>

      {here.length > 0 && (
        <section className="vmark__group" aria-label="على هذه الآية">
          <h3>على هذه الآية</h3>
          <ul>
            {here.map((b) => (
              <li key={b.id} className={`vmark__row${unplacing === b.id ? ' vmark__row--ask' : ''}`}>
                <span className="vmark__dot" style={{ background: b.color }} />
                <span className="vmark__name">
                  {b.name}
                  <small>{typeName(b.multi)}</small>
                </span>
                <button type="button" className="vmark__remove" aria-label={`إزالة «${b.name}» عن الآية`} onClick={() => setUnplacing(b.id)}>
                  <Icon d="M6 6l12 12M18 6 6 18" />
                </button>
                {unplacing === b.id && (
                  <div className="vmark__ask" role="alert">
                    <span>إزالة «{b.name}» عن الآية؟</span>
                    <button
                      type="button"
                      className="vmark__yes"
                      onClick={() => {
                        unplaceBookmark(b.id, v);
                        setUnplacing(null);
                        onToast(`أُزيلت علامة «${b.name}» عن الآية`);
                      }}
                    >
                      نعم، أزلها
                    </button>
                    <button type="button" className="vmark__no" onClick={() => setUnplacing(null)}>
                      لا
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="vmark__group" aria-label="علاماتك">
          <h3>{here.length ? 'علاماتك الأخرى' : 'علاماتك'}</h3>
          <ul>
            {others.map((b) => (
              <li key={b.id}>
                <button type="button" className="vmark__row vmark__pick" onClick={() => place(b)}>
                  <span className="vmark__dot" style={{ background: b.color }} />
                  <span className="vmark__name">
                    {b.name}
                    <small>{bookmarkMeta(quran, b)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// خيارا التشغيل: الآية وحدها (ويظهر تحته عدد المرات، والضغط على أحدها يشغّل)، أو من هذه الآية متتابعًا
function PlayChoices({ onAlone, onFrom }) {
  const [alone, setAlone] = useState(false);
  return (
    <div className="vplay">
      <button type="button" className="vplay__opt" aria-expanded={alone} onClick={() => setAlone((x) => !x)}>
        <Icon d="M8 5.5v13l10.5-6.5L8 5.5Z" />
        <span>
          تشغيل الآية وحدها
          <small>اختر عدد المرات</small>
        </span>
      </button>
      {alone && (
        <div className="vplay__repeats" role="group" aria-label="عدد المرات">
          {ALONE_REPEATS.map((n) => (
            <button key={n} type="button" className="vplay__repeat" onClick={() => onAlone(n)}>
              {repeatName(n)}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="vplay__opt" onClick={onFrom}>
        <Icon d="M5 5.5v13M9.5 5.5v13l9.5-6.5-9.5-6.5Z" />
        <span>
          بدء التشغيل من هذه الآية
          <small>متتابعًا إلى آخر المصحف</small>
        </span>
      </button>
    </div>
  );
}

// رأس البطاقة: زرّ رجوع إلى المربعات في أوله (٢٠٢٦-١١-١٤، بطلب صاحب المشروع)، ثم العنوان واسم الآية،
// ثم أزرار البطاقة وزرّ الإغلاق
function CardHead({ quran, v, title, children, onClose, onBack }) {
  const verse = quran.verses[v];
  return (
    <header className="vcard__head">
      {onBack && (
        <button type="button" className="vcard__btn" onClick={onBack} aria-label="رجوع">
          <Icon d="M9 6l6 6-6 6" />
        </button>
      )}
      <div className="vcard__title">
        <h2>{title}</h2>
        <span>
          {quran.suras[verse.s - 1].name}: {toArabicDigits(verse.a)}
        </span>
      </div>
      <div className="vcard__buttons">
        {children}
        <button type="button" className="vcard__btn" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function CopyButton({ onCopy }) {
  return (
    <button type="button" className="vcard__btn" onClick={onCopy} aria-label="نسخ">
      <CopyIcon />
    </button>
  );
}

// بطاقة التفسير/المعاني/العمل للآية وحدها، أعلى الشاشة
function DetailCard({ quran, v, kind, onClose, onBack, onToast }) {
  const idx = memoIndex(quran);
  // التفسير (٢٠٢٦-١١-١٤، كان المختصر ثم الميسّر معًا): تفسير واحد هو المختار في صفحات المحتوى،
  // يُبدَّل من القائمة أعلى البطاقة، والاختيار نفسه يتبعه الموضعان
  const [source, setSource] = useTafsirSource();
  const [tafsirs, setTafsirs] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (kind !== 'tafsir' || tafsirs[source]) return undefined;
    let alive = true;
    setFailed(false);
    loadTafsir(source).then(
      (t) => alive && setTafsirs((d) => ({ ...d, [source]: t })),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [kind, source, tafsirs]);

  let title;
  let body;
  let plain = '';

  if (kind === 'tafsir') {
    title = 'التفسير';
    const t = tafsirs[source];
    const text = t ? tafsirText(source, t, v) : '';
    const name = tafsirInfo(source).title;
    // نسخ التفسير وحده بفقراته، بلا الآية ولا اسم كتابه (٢٠٢٦-١١-١٤، بطلب صاحب المشروع: للآية مربع
    // «نسخ» خاص بها، والمشاركة مؤجلة إلى الملاحظات) — بزرّ النسخ في رأس البطاقة كالمعاني والعمل
    plain = text ? paragraphs(text).join('\n') : '';
    let content;
    if (failed) content = <p className="study__note">تعذّر تحميل التفسير. يُحمَّل مرة واحدة، ويحتاج لذلك اتصالًا بالإنترنت.</p>;
    else if (!t) content = <p className="study__note">جارٍ تحميل التفسير…</p>;
    // نص عادي بلا تمييز (بطلب صاحب المشروع)
    else content = <TafsirBody text={text} source={source} />;
    body = (
      <>
        <div className="vcard__source">
          <TafsirPicker value={source} onChange={setSource} align="start" onToast={onToast} />
        </div>
        <div className="vcard__tafsir">{content}</div>
        <p className="vcard__credit">{name}</p>
      </>
    );
  } else if (kind === 'meanings') {
    title = 'معاني الكلمات';
    const words = idx.meaningsOf.get(v) ?? [];
    if (idx.sectionOf.m[v] < 0) body = <p className="vcard__empty">{UNAVAILABLE}</p>;
    else if (!words.length) body = <p className="vcard__empty">{NO_MEANINGS}</p>;
    else {
      body = (
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
      );
      plain = words.map((w) => `${w.mushaf ?? w.word}: ${w.meaning}`).join('\n');
    }
  } else if (kind === 'fawaid') {
    // تنتظر ملفاتها من صاحب المشروع
    title = 'الفوائد';
    body = <p className="vcard__empty">تُضاف فوائد الآيات لاحقًا بإذن الله.</p>;
  } else {
    title = 'العمل بالآيات';
    const list = idx.actionsOf.get(v) ?? [];
    if (idx.sectionOf.a[v] < 0) body = <p className="vcard__empty">{UNAVAILABLE}</p>;
    else if (!list.length) body = <p className="vcard__empty">{NO_ACTIONS}</p>;
    else {
      body = list.map((i) => (
        <div key={i} className="vcard__action">
          <p>
            <QuotedText text={idx.actions[i].t} open="﴿" close="﴾" keepMarks />
          </p>
          <span className="study__ref">{verseLabel(quran, idx.actions[i].v)}</span>
        </div>
      ));
      plain = list.map((i) => `• ${idx.actions[i].t}`).join('\n');
    }
  }

  // المعاني والعمل: المحتوى وحده بلا الآية (٢٠٢٦-١١-١٤)، وللآية مربع «نسخ» خاص بها
  const copy = async () => onToast((await copyText(plain)) ? 'نُسخ النص' : 'تعذّر النسخ');

  return (
    <section className="vcard" role="dialog" aria-label={title}>
      <CardHead quran={quran} v={v} title={title} onClose={onClose} onBack={onBack}>
        {plain && <CopyButton onCopy={copy} />}
      </CardHead>
      <div className="vcard__body">
        <div className="vcard__content">{body}</div>
      </div>
    </section>
  );
}

// ملاحظة الآية: تُكتب وتُعدَّل، وتُحفظ عند الحفظ أو الإغلاق؛ وتُحذف بزرّها أو بتفريغها
// والرجوع إلى المربعات يحفظها أولًا كالإغلاق
// بطاقة الملاحظة (٢٠٢٦-١١-١٥، «تطوير الملاحظات»): زرّ «إدراج الآية» يُظهر الآية بخط المصحف وتشكيله في
// مستطيل منفصل في أول الملاحظة (لا يُكتب قبله ولا بعده، وزرّ ✕ في زاويته يزيله)، وتحته خانة التعليق.
// وزرّ «مشاركة» بدل النسخ: الآية إن أُدرجت ثم التعليق ثم اسم التطبيق ورابطه؛ والنسخ بتحديد النص يدويًّا.
// وحذف الملاحظة بزرّ الحذف وحده يزيل التعليق والآية معًا.
function NoteCard({ quran, v, onClose, onBack, onToast, saveRef }) {
  const initial = noteOf(readNotes(), v);
  const [text, setText] = useState(() => initial?.text ?? '');
  const [withVerse, setWithVerse] = useState(() => initial?.verse ?? false);
  const existed = useRef(Boolean(initial));
  const area = useRef(null);
  const keep = () => {
    const before = noteOf(readNotes(), v);
    if (text !== (before?.text ?? '') || withVerse !== (before?.verse ?? false)) setNote(v, text, withVerse);
  };
  const save = () => {
    keep();
    onClose();
  };
  if (saveRef) saveRef.current = save;
  const remove = () => {
    setNote(v, '');
    onToast('حُذفت الملاحظة');
    onClose();
  };
  const share = async () => {
    keep();
    const result = await shareText(noteShareText(quran, v, { text, verse: withVerse }));
    if (result === 'copied') onToast('نُسخت الملاحظة');
    else if (result === 'failed') onToast('تعذّرت المشاركة');
  };
  const toggleVerse = (on) => {
    setWithVerse(on);
    area.current?.focus();
  };
  return (
    <section className="vcard vcard--note" role="dialog" aria-label="ملاحظة">
      <CardHead
        quran={quran}
        v={v}
        title="ملاحظة"
        onClose={save}
        onBack={() => {
          keep();
          onBack();
        }}
      >
        {(withVerse || text.trim()) && (
          <button type="button" className="vcard__btn" onClick={share} aria-label="مشاركة">
            <ShareIcon />
          </button>
        )}
        {existed.current && (
          <button type="button" className="vcard__btn" onClick={remove} aria-label="حذف الملاحظة">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </CardHead>
      <div className="vnote">
        {withVerse ? (
          <div className="vnote__verse" role="group" aria-label="الآية المُدرجة">
            <p>{verseText(quran, v)}</p>
            <button type="button" className="vnote__unverse" onClick={() => toggleVerse(false)} aria-label="إزالة الآية من الملاحظة">
              <Icon d="M6 6l12 12M18 6 6 18" />
            </button>
          </div>
        ) : (
          <button type="button" className="vnote__insert" onClick={() => toggleVerse(true)}>
            <Icon d="M12 5v14M5 12h14" />
            إدراج الآية
          </button>
        )}
        <textarea
          ref={area}
          className="vcard__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={withVerse ? 'اكتب تعليقك على الآية…' : 'اكتب ملاحظتك على هذه الآية…'}
          aria-label="نص الملاحظة"
          autoFocus
        />
      </div>
      <button type="button" className="vcard__save" onClick={save}>
        حفظ
      </button>
    </section>
  );
}

