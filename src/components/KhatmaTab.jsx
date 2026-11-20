import { useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { pageVerses } from '../lib/study.js';
import {
  DAY_PRESETS,
  DEFAULT_PLAN,
  PAGE_PRESETS,
  completeWird,
  dayKey,
  addDays,
  daysText,
  editWird,
  formatDates,
  pagesText,
  previewPlan,
  removeWird,
  setReminder,
  startWird,
  useKhatma,
  wirdState,
} from '../lib/khatma.js';
import { FIRST_PAGE, LAST_PAGE } from '../lib/position.js';
import { countNoun, countText, KHATMAS, PAGES } from '../lib/count.js';
import { HifzCard, HifzFinished, HifzForm } from './HifzTab.jsx';
import ReminderField, { ReminderLine } from './ReminderField.jsx';
import { CardHead, Details, DetailsFooter, Task, withUndo } from './KhatmaTasks.jsx';
import './Khatma.css';

/*
  تبويب «الختمة» في القائمة اليمنى (٢٠٢٦-١١-١٢): ختمة الورد اليومي (src/lib/khatma.js)، وختمة الحفظ
  (٢٠٢٦-١١-١٦، HifzTab.jsx). تجتمع الختمتان، ومن كل نوع واحدة؛ وبلا ختمة يُختار النوع أعلى النموذج.
  • بلا ختمة: نموذج الإنشاء — بالأيام أو بالصفحات يوميا، ويظهر المقابل ويوم الختم قبل التأكيد.
  • أثناء الختمة (تنسيق ٢٠٢٦-١١-٢٠): بطاقة مختصرة — التقدم والحالة، ثم مهمة اليوم سطرًا بدائرة تسجّله
    (ومعها «تراجع») وزرّ «اقرأ» يفتح صفحة الختمة، ثم «التفاصيل» المطوية: الختم المتوقع بالميلادي والهجري،
    والتذكير، وتعديل الخطة وحذف الختمة (KhatmaTasks.jsx).
  • بعد الختم: تهنئة وزر «ابدأ ختمة جديدة».
*/
const n = toArabicDigits;

export default function KhatmaTab({ quran, hafs, onRead, onHifz, onToast }) {
  const { wird, hifz, doneCount, hifzDoneCount } = useKhatma();
  const [editing, setEditing] = useState(false);
  const [hifzEditing, setHifzEditing] = useState(false);
  // نوع الختمة الجديدة: في الإنشاء بلا ختمة يُختار بأعلى النموذج، ومع ختمة قائمة بزرّ النوع الآخر تحتها
  const [newType, setNewType] = useState('wird');
  const [adding, setAdding] = useState(false);
  const today = dayKey();

  const wirdForm = (cancel) => {
    const state = wird && wirdState(wird, today);
    return (
      <PlanForm
        editing={!!wird}
        initial={wird ? { mode: wird.mode, value: wird.value, reminder: wird.reminder ?? null } : { ...DEFAULT_PLAN, reminder: null }}
        from={state ? state.next : FIRST_PAGE}
        start={wird?.lastDone === today ? addDays(today, 1) : today}
        doneCount={doneCount}
        onSubmit={(mode, value, reminder) => {
          if (wird) {
            // تغيير التذكير وحده لا يعيد تقسيم الخطة
            const onlyReminder = mode === wird.mode && value === wird.value && reminder !== (wird.reminder ?? null);
            if (!onlyReminder) editWird(mode, value, today);
            setReminder('wird', reminder);
            onToast(onlyReminder ? 'تم حفظ التذكير' : 'تم تعديل الخطة');
          } else startWird(mode, value, today, reminder);
          setEditing(false);
          setAdding(false);
        }}
        onCancel={cancel}
      />
    );
  };
  const hifzForm = (cancel) => (
    <HifzForm
      quran={quran}
      hafs={hafs}
      k={hifz && !hifz.finished ? hifz : null}
      onDone={(msg) => {
        if (msg) onToast(msg);
        setHifzEditing(false);
        setAdding(false);
      }}
      onCancel={cancel}
    />
  );

  // بلا ختمة: اختيار النوع ثم نموذجه
  if (!wird && !hifz) {
    return (
      <>
        <TypeSwitch type={newType} onType={setNewType} />
        {newType === 'wird' ? wirdForm(null) : hifzForm(null)}
      </>
    );
  }

  const missing = !wird ? 'wird' : !hifz ? 'hifz' : null;
  return (
    <>
      {wird &&
        (editing ? (
          wirdForm(() => setEditing(false))
        ) : wird.finished ? (
          <Finished date={wird.finished} doneCount={doneCount} />
        ) : (
          <Active quran={quran} wird={wird} today={today} doneCount={doneCount} onRead={onRead} onEdit={() => setEditing(true)} onToast={onToast} />
        ))}
      {hifz &&
        (hifzEditing ? (
          hifzForm(() => setHifzEditing(false))
        ) : hifz.finished ? (
          <HifzFinished date={hifz.finished} doneCount={hifzDoneCount} />
        ) : (
          <HifzCard quran={quran} hafs={hafs} k={hifz} doneCount={hifzDoneCount} onOpen={onHifz} onEdit={() => setHifzEditing(true)} onToast={onToast} />
        ))}
      {missing &&
        (adding ? (
          missing === 'wird' ? wirdForm(() => setAdding(false)) : hifzForm(() => setAdding(false))
        ) : (
          <div className="khatma-extra khatma-extra--add">
            <button type="button" className="khatma__btn khatma__add" onClick={() => setAdding(true)}>
              {missing === 'wird' ? 'ختمة ورد جديدة' : 'ختمة حفظ جديدة'}
            </button>
          </div>
        ))}
    </>
  );
}

// نوع الختمة الجديدة (٢٠٢٦-١١-١٦): الورد أو الحفظ. وتجتمع الختمتان، ومن كل نوع واحدة
function TypeSwitch({ type, onType }) {
  return (
    <div className="khatma-extra">
      <div className="khatma__segment" role="radiogroup" aria-label="نوع الختمة">
        <button type="button" role="radio" aria-checked={type === 'wird'} onClick={() => onType('wird')}>
          ختمة الورد
        </button>
        <button type="button" role="radio" aria-checked={type === 'hifz'} onClick={() => onType('hifz')}>
          ختمة الحفظ
        </button>
      </div>
    </div>
  );
}

// ---------- نموذج الإنشاء وتعديل الخطة ----------
function PlanForm({ editing, initial, from, start, doneCount, onSubmit, onCancel }) {
  const [mode, setMode] = useState(initial.mode);
  const presets = mode === 'days' ? DAY_PRESETS : PAGE_PRESETS;
  const [value, setValue] = useState(initial.value);
  const [custom, setCustom] = useState(!presets.includes(initial.value));
  const [draft, setDraft] = useState(custom ? String(initial.value) : '');
  const [reminder, setReminderTime] = useState(initial.reminder ?? null);
  const remaining = LAST_PAGE - from + 1;

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setValue(m === 'days' ? DEFAULT_PLAN.value : 5);
    setCustom(false);
    setDraft('');
  };
  // العدد المكتوب باليد: من ١ إلى عدد الصفحات الباقية (فلا يقل ورد اليوم عن صفحة)
  const typed = parseInt(draft.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
  const chosen = custom ? (typed >= 1 ? Math.min(typed, remaining) : null) : value;
  const plan = chosen ? previewPlan(mode, chosen, from, start) : null;
  const dates = plan && formatDates(plan.end);

  return (
    <div className="khatma">
      <section className="khatma__card">
        <h3 className="khatma__title">{editing ? 'تعديل الخطة' : 'ختمة جديدة'}</h3>
        {/* في الإنشاء بلا جملة شرح (بطلب صاحب المشروع)؛ وفي التعديل يبين ما يعاد تقسيمه */}
        {editing && (
          <p className="khatma__hint">{`يعاد تقسيم ما بقي (${pagesText(remaining, n, true)}، من الصفحة ${n(from)}) دون أن يضيع ما قرأته.`}</p>
        )}

        <div className="khatma__segment" role="radiogroup" aria-label="طريقة التحديد">
          <button type="button" role="radio" aria-checked={mode === 'days'} onClick={() => switchMode('days')}>
            بالأيام
          </button>
          <button type="button" role="radio" aria-checked={mode === 'pages'} onClick={() => switchMode('pages')}>
            بالصفحات يوميا
          </button>
        </div>

        <div className="khatma__chips" role="radiogroup" aria-label={mode === 'days' ? 'عدد الأيام' : 'عدد الصفحات يوميا'}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={!custom && value === p}
              onClick={() => {
                setCustom(false);
                setValue(p);
              }}
            >
              {mode === 'days' ? daysText(p, n, true) : pagesText(p, n, true)}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)}>
            عدد آخر
          </button>
        </div>

        {custom && (
          <label className="khatma__custom">
            <span>{mode === 'days' ? 'عدد الأيام' : 'عدد الصفحات يوميا'}</span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9٠-٩]/g, '').slice(0, 3))}
              placeholder={`١–${n(remaining)}`}
            />
          </label>
        )}

        {plan ? (
          <div className="khatma__summary" aria-live="polite">
            <p className="khatma__summaryMain">
              {daysText(plan.days, n, true)}، {mode === 'days' ? (plan.min === plan.max ? pagesText(plan.max, n, true) : `${n(plan.min)}–${n(plan.max)} ${countNoun(plan.max, PAGES)}`) : pagesText(chosen, n, true)} يوميا
            </p>
            <p className="khatma__date">
              <span>تختم يوم</span>
              <strong>{dates.gregorian}</strong>
              <strong>{dates.hijri}</strong>
            </p>
          </div>
        ) : (
          <p className="khatma__summary khatma__summary--empty">اكتب عددا من ١ إلى {n(remaining)}</p>
        )}

        <ReminderField value={reminder} onChange={setReminderTime} label="ورد اليوم" />

        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" disabled={!plan} onClick={() => onSubmit(mode, chosen, reminder)}>
            {editing ? 'حفظ الخطة' : 'ابدأ الختمة'}
          </button>
          {onCancel && (
            <button type="button" className="khatma__btn" onClick={onCancel}>
              إلغاء
            </button>
          )}
        </div>
      </section>
      {!editing && doneCount > 0 && <p className="khatma__count">أتممت {khatmasText(doneCount)} في هذا التطبيق</p>}
    </div>
  );
}

// ---------- أثناء الختمة ----------
// البطاقة: الرأس (الاسم ورقم الورد، والتقدّم والحالة)، ثم المهمة (ورد اليوم، وبعد إتمامه «الورد التالي» لمن يتقدّم)،
// ثم «التفاصيل» المطوية
function Active({ quran, wird, today, doneCount, onRead, onEdit, onToast }) {
  const s = wirdState(wird, today);
  const [confirm, setConfirm] = useState(false);
  const [a, b] = s.current;
  const dates = formatDates(s.end);
  const status = s.behind
    ? { text: `متأخر عن الخطة ${daysText(s.behind, n)}`, kind: 'behind' }
    : s.ahead
      ? { text: `متقدم على الخطة ${daysText(s.ahead, n)}`, kind: 'ahead' }
      : s.doneToday
        ? { text: 'أتممت ورد اليوم ✓', kind: 'done' }
        : { text: 'على الخطة', kind: 'on' };
  // ورد اليوم المتمّ (إن بقي في الخطة الحالية بعد تعديلها)
  const doneWird = s.doneToday ? s.wirds[wird.done - 1] : null;

  const complete = () =>
    withUndo(onToast, (toast) => {
      const result = completeWird(today);
      if (result === 'next') toast('أحسنت، تم تسجيل الورد');
      else if (result === 'finished') toast('أتممت الختمة، تقبل الله منك');
    });

  return (
    <div className="khatma">
      <section className="khatma__card">
        <CardHead title="ختمة الورد" index={s.index} total={s.total} percent={s.percent} label="تقدم الختمة" status={status} />

        <ul className="tasks">
          {s.doneToday && <Task title="ورد اليوم" done detail={doneWird ? pagesRange(doneWird) : null} />}
          <Task
            title={s.doneToday ? 'الورد التالي' : 'ورد اليوم'}
            detail={pagesRange(s.current)}
            sub={`${wirdSuras(quran, a, b)}، ${pagesText(b - a + 1, n, true)}`}
            action={{ label: 'اقرأ', onClick: onRead }}
            onCheck={complete}
          />
        </ul>

        <Details>
          <p className="khatma__progress">
            قرأت {n(s.read)} من {n(LAST_PAGE)} {countNoun(LAST_PAGE, PAGES)}
          </p>
          <p className="khatma__date">
            <span>الختم المتوقع</span>
            <strong>{dates.gregorian}</strong>
            <strong>{dates.hijri}</strong>
          </p>
          <ReminderLine time={wird.reminder} />
          {doneCount > 0 && <p className="khatma__count">أتممت قبلها {khatmasText(doneCount)}</p>}
          <DetailsFooter confirm={confirm} setConfirm={setConfirm} onEdit={onEdit} onRemove={removeWird} question="حذف الختمة وكل تقدمها؟" />
        </Details>
      </section>
    </div>
  );
}

// «من الصفحة ٢١ إلى ٤٠» أو «الصفحة ٥»
const pagesRange = ([a, b]) => (a === b ? `الصفحة ${n(a)}` : `من الصفحة ${n(a)} إلى ${n(b)}`);

// ---------- بعد الختم ----------
function Finished({ date, doneCount }) {
  const dates = formatDates(date);
  return (
    <div className="khatma">
      <section className="khatma__card khatma__card--done">
        <h3 className="khatma__title">أتممت الختمة</h3>
        <p className="khatma__hint">تقبل الله منك، وجعل القرآن ربيع قلبك.</p>
        <p className="khatma__date">
          <span>ختمت يوم</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>
        <p className="khatma__progress">أتممت {khatmasText(doneCount)} في هذا التطبيق</p>
        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" onClick={removeWird}>
            ابدأ ختمة جديدة
          </button>
        </div>
      </section>
    </div>
  );
}

// «ختمة واحدة» · «ختمتين» · «٣ ختمات» · «١١ ختمة» (منصوبة: «أتممت ختمتين»)
const khatmasText = (c) => countText(c, KHATMAS, n);

// سور الورد: من سورة أول آية فيه إلى سورة آخر آية
export function wirdSuras(quran, a, b) {
  const first = quran.verses[pageVerses(quran, a)[0]].s;
  const last = quran.verses[pageVerses(quran, b).at(-1)].s;
  const name = (s) => quran.suras[s - 1].name;
  return first === last ? name(first) : `${name(first)} – ${name(last)}`;
}
