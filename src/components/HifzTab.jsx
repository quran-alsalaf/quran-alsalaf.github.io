import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import RangePicker from './RangePicker.jsx';
import { toArabicDigits } from '../data/quran.js';
import { verseLabel } from '../lib/study.js';
import { hafsOf, shownOf } from '../lib/verseMap.js';
import { dayKey, addDays, daysText, formatDates, setReminder } from '../lib/khatma.js';
import ReminderField, { ReminderLine } from './ReminderField.jsx';
import { CardHead, Details, DetailsFooter, Task, withUndo } from './KhatmaTasks.jsx';
import {
  DEFAULT_LINES,
  DEFAULT_NEAR,
  FAR_NAMES,
  FAR_UNITS,
  LINE_PRESETS,
  LINES,
  MAX_LINES,
  MAX_NEAR,
  NEAR_PRESETS,
  beforeRanges,
  completeHifz,
  completeReview,
  dismissHint,
  editHifz,
  hifzState,
  linesOf,
  linesText,
  memorizedText,
  readHifz,
  removeHifz,
  splitHifz,
  startHifz,
  suggestFar,
  validPlan,
  wirdsText,
} from '../lib/hifz.js';
import { countText, KHATMAS } from '../lib/count.js';
import './Khatma.css';

/*
  ختمة الحفظ في تبويب «الختمة» (٢٠٢٦-١١-١٦) — المنطق في src/lib/hifz.js.
  • HifzForm: الإنشاء (الاتجاه، والبداية والنهاية، و«لا أراجع ما قبل البداية»، والحفظ اليومي بالأسطر،
    والمراجعتان) وتعديل الخطة (الحفظ اليومي والمراجعتان وحدها).
  • HifzCard: التقدّم والمحفوظ، وخطوات اليوم الثلاث أسطرًا: المراجعة البعيدة، والمراجعة القريبة، وحفظ الورد. لكل
    خطوة زرّ يفتح صفحتها (HifzPage) ودائرة تسجّلها لمن سمّع على شيخ أو من مصحف ورقي (ومعها «تراجع»)، و✓ إذا
    أُتمّت اليوم؛ ثم «التفاصيل» المطوية (KhatmaTasks.jsx).
  • HifzFinished: بعد الختم.
  الخطة بترقيم حفص (hafs)، وتُعرض بترقيم المصحف المعروض (quran) — في ورش بما يقابلها.
*/
const n = toArabicDigits;
const toNumber = (text) =>
  parseInt(
    text.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
    10,
  );

// اسم مقدار بترقيم حفص [a, b] في المصحف المعروض: «الملك ١–١٥» أو «النصر ١ – الناس ٦»
export function hifzLabel(quran, [a, b]) {
  const first = shownOf(quran, a)[0] ?? a;
  const last = shownOf(quran, b).at(-1) ?? b;
  return verseLabel(quran, [first, last]);
}

// ---------- الإنشاء وتعديل الخطة ----------
export function HifzForm({ quran, hafs, k, onDone, onCancel }) {
  const editing = !!k;
  const last = hafs.verses.length - 1;
  const nasStart = hafs.verses.findIndex((v) => v.s === 114);
  const fatihaEnd = hafs.verses.findIndex((v) => v.s === 2) - 1;
  const [dir, setDir] = useState(k?.dir ?? 'forward');
  const [start, setStart] = useState(k?.start ?? 0);
  const [end, setEnd] = useState(k?.end ?? last);
  const [known, setKnown] = useState(k?.known ?? true);
  const [lines, setLines] = useState(k?.lines ?? DEFAULT_LINES);
  const [customLines, setCustomLines] = useState(!!k && !LINE_PRESETS.includes(k.lines));
  const [linesDraft, setLinesDraft] = useState(k && !LINE_PRESETS.includes(k.lines) ? String(k.lines) : '');
  const [near, setNear] = useState(k?.near ?? DEFAULT_NEAR);
  const [customNear, setCustomNear] = useState(!!k && !NEAR_PRESETS.includes(k.near));
  const [nearDraft, setNearDraft] = useState(k && !NEAR_PRESETS.includes(k.near) ? String(k.near) : '');
  const [far, setFar] = useState(k?.far ?? null); // null: المقترح
  const [picking, setPicking] = useState(null); // 'start' | 'end'
  const [reminder, setReminderTime] = useState(k?.reminder ?? null);

  const switchDir = (d) => {
    if (d === dir) return;
    setDir(d);
    setStart(d === 'forward' ? 0 : nasStart);
    setEnd(d === 'forward' ? last : fatihaEnd);
  };

  const valid = validPlan(hafs, dir, start, end);
  const before = valid ? beforeRanges(hafs, dir, start) : [];
  const suggested = suggestFar(hafs, editing ? [] : known ? before : []);
  const farChosen = far ?? suggested;
  const chosenLines = customLines ? (toNumber(linesDraft) >= 1 ? Math.min(toNumber(linesDraft), MAX_LINES) : null) : lines;
  const typedNear = toNumber(nearDraft);
  const chosenNear = customNear ? (typedNear >= 0 ? Math.min(typedNear, MAX_NEAR) : null) : near;
  const today = dayKey();
  const from = editing ? k.next : start;
  const wirds = useMemo(
    () => (valid && chosenLines ? splitHifz(hafs, dir, from, end, chosenLines) : []),
    [hafs, valid, dir, from, end, chosenLines],
  );
  const startDay = editing && k.lastDone === today ? addDays(today, 1) : today;
  const ready = valid && chosenLines && chosenNear != null && wirds.length > 0;
  const dates = ready && formatDates(addDays(startDay, wirds.length - 1));

  const pick = (v) => {
    const keys = hafsOf(quran, v);
    if (picking === 'start') setStart(keys[0]);
    else setEnd(keys.at(-1));
    setPicking(null);
  };
  const submit = () => {
    const plan = { lines: chosenLines, near: chosenNear, far: farChosen };
    // تغيير التذكير وحده لا يعيد تقسيم الخطة
    const onlyReminder =
      editing && plan.lines === k.lines && plan.near === k.near && plan.far === k.far && reminder !== (k.reminder ?? null);
    if (editing) {
      if (!onlyReminder) editHifz(plan, today);
      setReminder('hifz', reminder);
    } else startHifz({ ...plan, dir, start, end, known: before.length ? known : true, reminder }, today);
    onDone(onlyReminder ? 'تم حفظ التذكير' : editing ? 'تم تعديل الخطة' : null);
  };
  const shownVerse = (h) => shownOf(quran, h)[0] ?? h;

  return (
    <div className="khatma">
      <section className="khatma__card hifz-form">
        <h3 className="khatma__title">{editing ? 'تعديل خطة الحفظ' : 'ختمة حفظ جديدة'}</h3>

        {!editing && (
          <>
            <div className="hifz__field">
              <span className="hifz__label">الاتجاه</span>
              <div className="khatma__segment" role="radiogroup" aria-label="الاتجاه">
                <button type="button" role="radio" aria-checked={dir === 'forward'} onClick={() => switchDir('forward')}>
                  من الفاتحة إلى الناس
                </button>
                <button type="button" role="radio" aria-checked={dir === 'reverse'} onClick={() => switchDir('reverse')}>
                  من الناس إلى الفاتحة
                </button>
              </div>
            </div>

            <div className="hifz__range">
              <button
                type="button"
                className="hifz__pick"
                onClick={() => setPicking('start')}
                aria-label={`البداية: ${hifzLabel(quran, [start, start])}`}
              >
                <span>البداية</span>
                <strong>{hifzLabel(quran, [start, start])}</strong>
              </button>
              <button
                type="button"
                className="hifz__pick"
                onClick={() => setPicking('end')}
                aria-label={`النهاية: ${hifzLabel(quran, [end, end])}`}
              >
                <span>النهاية</span>
                <strong>{hifzLabel(quran, [end, end])}</strong>
              </button>
            </div>

            {!valid && (
              <p className="hifz__error" role="alert">
                {dir === 'forward' ? 'النهاية قبل البداية. اختر نهاية بعدها.' : 'في هذا الاتجاه تكون سورة النهاية قبل سورة البداية.'}
              </p>
            )}
            {valid && before.length > 0 && (
              <label className="hifz__check">
                <input type="checkbox" checked={!known} onChange={(e) => setKnown(!e.target.checked)} />
                <span>لا أراجع ما قبل البداية</span>
              </label>
            )}
          </>
        )}

        <div className="hifz__field">
          <span className="hifz__label">الحفظ اليومي</span>
          <div className="khatma__chips" role="radiogroup" aria-label="الحفظ اليومي">
            {LINE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={!customLines && lines === p}
                onClick={() => {
                  setCustomLines(false);
                  setLines(p);
                }}
              >
                {linesText(p)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={customLines} onClick={() => setCustomLines(true)}>
              عدد آخر
            </button>
          </div>
          {customLines && (
            <label className="khatma__custom">
              <span>عدد الأسطر يوميا</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={linesDraft}
                onChange={(e) => setLinesDraft(e.target.value.replace(/[^0-9٠-٩]/g, '').slice(0, 3))}
                placeholder={`١–${n(MAX_LINES)}`}
              />
            </label>
          )}
        </div>

        <div className="hifz__field">
          <span className="hifz__label">المراجعة القريبة قبل الحفظ</span>
          <div className="khatma__chips" role="radiogroup" aria-label="المراجعة القريبة">
            {NEAR_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={!customNear && near === p}
                onClick={() => {
                  setCustomNear(false);
                  setNear(p);
                }}
              >
                {p === 0 ? 'بلا' : p === 1 ? 'ورد واحد' : `آخر ${wirdsText(p, false)}`}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={customNear} onClick={() => setCustomNear(true)}>
              عدد آخر
            </button>
          </div>
          {customNear && (
            <label className="khatma__custom">
              <span>عدد الأوراد</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={nearDraft}
                onChange={(e) => setNearDraft(e.target.value.replace(/[^0-9٠-٩]/g, '').slice(0, 2))}
                placeholder={`٠–${n(MAX_NEAR)}`}
              />
            </label>
          )}
        </div>

        <div className="hifz__field">
          <span className="hifz__label">المراجعة البعيدة كل يوم</span>
          <div className="khatma__chips" role="radiogroup" aria-label="المراجعة البعيدة">
            {FAR_UNITS.map((u) => (
              <button key={u} type="button" role="radio" aria-checked={farChosen === u} onClick={() => setFar(u)}>
                {FAR_NAMES[u]}
                {!editing && u === suggested ? ' (مقترح)' : ''}
              </button>
            ))}
          </div>
          {!editing && (
            <p className="khatma__hint">
              {suggested === 'juz'
                ? 'تحفظ الآن أكثر من نصف القرآن، فيقترح أن تراجع جزءا كل يوم.'
                : 'تحفظ الآن أقل من نصف القرآن، فيقترح أن تراجع حزبا كل يوم.'}
            </p>
          )}
        </div>

        {ready ? (
          <div className="khatma__summary" aria-live="polite">
            <p className="khatma__summaryMain">
              {wirdsText(wirds.length)}، {linesText(chosenLines)} يوميا
            </p>
            <p className="khatma__date">
              <span>تختم الحفظ يوم</span>
              <strong>{dates.gregorian}</strong>
              <strong>{dates.hijri}</strong>
            </p>
          </div>
        ) : (
          valid && <p className="khatma__summary khatma__summary--empty">اكتب عددا صحيحا</p>
        )}

        <ReminderField value={reminder} onChange={setReminderTime} label="خطوات اليوم" />

        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" disabled={!ready} onClick={submit}>
            {editing ? 'حفظ الخطة' : 'ابدأ ختمة الحفظ'}
          </button>
          {onCancel && (
            <button type="button" className="khatma__btn" onClick={onCancel}>
              إلغاء
            </button>
          )}
        </div>
      </section>
      {picking &&
        createPortal(
          <div className="hifz-picklayer">
            <RangePicker
              quran={quran}
              mode="start"
              title={picking === 'start' ? 'اختر آية البداية' : 'اختر آية النهاية'}
              near={shownVerse(picking === 'start' ? start : end)}
              onPick={pick}
              onClose={() => setPicking(null)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

// إتمام حفظ الورد (من البطاقة أو من صفحته)، ومعه التنبيه إن بقيت مراجعة اليوم (بطلب صاحب المشروع:
// من يهمل المراجعة ويكتفي بتسجيل الحفظ يُنبَّه إلى أهميتها)
export function finishHifz(hafs, onToast) {
  const k = readState(hafs);
  const result = completeHifz(hafs);
  if (result === 'finished') onToast('أتممت ختمة الحفظ، تقبل الله منك');
  else if (result === 'next') {
    const missed = k && ((k.far && !k.farDone) || (k.near.length > 0 && !k.nearDone));
    onToast(missed ? 'سجل حفظ الورد. لا تترك المراجعة، فبها يثبت الحفظ' : 'أحسنت، سجل حفظ الورد');
  }
  return result;
}
const readState = (hafs) => {
  const k = readHifz();
  return k && !k.finished ? hifzState(hafs, k) : null;
};

export function finishReview(hafs, kind, onToast) {
  completeReview(hafs, kind);
  onToast(kind === 'far' ? 'أحسنت، تمت المراجعة البعيدة' : 'أحسنت، تمت المراجعة القريبة');
}

// ---------- أثناء الختمة ----------
// البطاقة (تنسيق ٢٠٢٦-١١-٢٠): الرأس (التقدّم والحالة والمحفوظ)، ثم التنبيهات، ثم خطوات اليوم الثلاث أسطرًا — لكلٍّ
// دائرة تسجّلها (ومعها «تراجع») وزرّ يفتح صفحتها — ثم «التفاصيل» المطوية
export function HifzCard({ quran, hafs, k, onOpen, onEdit, onToast, doneCount }) {
  const today = dayKey();
  const s = hifzState(hafs, k, today);
  const [confirm, setConfirm] = useState(false);
  const dates = formatDates(s.end);
  const status = s.behind
    ? { text: `متأخر عن الخطة ${daysText(s.behind, n)}`, kind: 'behind' }
    : s.ahead
      ? { text: `متقدم على الخطة ${daysText(s.ahead, n)}`, kind: 'ahead' }
      : s.doneToday
        ? { text: 'أتممت حفظ اليوم ✓', kind: 'done' }
        : { text: 'على الخطة', kind: 'on' };
  const nearLabel = s.near.length ? hifzLabel(quran, [Math.min(...s.near.map((r) => r[0])), Math.max(...s.near.map((r) => r[1]))]) : null;
  const lastLearned = s.doneToday ? (k.recent ?? []).at(-1) : null;
  const record = (fn) => () => withUndo(onToast, fn);

  return (
    <div className="khatma">
      <section className="khatma__card hifz-card">
        <CardHead
          title="ختمة الحفظ"
          index={s.index}
          total={s.total}
          percent={s.percent}
          label="تقدم ختمة الحفظ"
          status={status}
          extra={`تحفظ الآن ${memorizedText(hafs, s.memorized)}`}
        />

        {s.suggest && (
          <div className="hifz__note" role="note">
            <p>تجاوز حفظك نصف القرآن، فيقترح أن تزيد المراجعة البعيدة إلى جزء كل يوم.</p>
            <div className="hifz__noteActions">
              <button
                type="button"
                className="khatma__link"
                onClick={() => {
                  editHifz({ lines: k.lines, near: k.near, far: 'juz' }, today);
                  onToast('صارت المراجعة البعيدة جزءا كل يوم');
                }}
              >
                اجعلها جزءا
              </button>
              <button type="button" className="khatma__link" onClick={() => dismissHint('juz')}>
                ليس الآن
              </button>
            </div>
          </div>
        )}
        {s.neglected && !s.farDone && (
          <p className="hifz__note hifz__note--warn" role="note">
            لم تراجع منذ {daysText(s.idleDays, n)}. المراجعة تثبت الحفظ، فلا تتركها.
          </p>
        )}

        <ul className="tasks">
          <Task
            title="المراجعة البعيدة"
            done={s.farDone}
            detail={s.farDone ? null : s.far ? s.far.name : 'لا محفوظ للمراجعة بعد'}
            sub={!s.farDone && s.far && s.far.ranges.length ? hifzLabel(quran, [s.far.ranges[0][0], s.far.ranges.at(-1)[1]]) : null}
            action={s.far ? { label: 'راجع', onClick: () => onOpen('far') } : null}
            onCheck={s.far ? record((toast) => finishReview(hafs, 'far', toast)) : null}
          />
          {k.near > 0 && (
            <Task
              title="المراجعة القريبة"
              done={s.nearDone}
              detail={
                s.nearDone
                  ? null
                  : s.near.length
                    ? k.near === 1
                      ? 'الورد السابق'
                      : `آخر ${wirdsText(Math.min(k.near, s.near.length), false)}`
                    : 'تبدأ بعد أول ورد تحفظه'
              }
              sub={s.nearDone ? null : nearLabel}
              action={s.near.length ? { label: 'سمع', onClick: () => onOpen('near') } : null}
              onCheck={s.near.length ? record((toast) => finishReview(hafs, 'near', toast)) : null}
            />
          )}
          {s.doneToday && <Task title="حفظ اليوم" done detail={lastLearned ? hifzLabel(quran, lastLearned) : null} />}
          <Task
            title={s.doneToday ? 'الورد التالي' : 'حفظ اليوم'}
            detail={hifzLabel(quran, s.current)}
            sub={countText(Math.max(1, Math.round(linesOf(hafs, s.current[0], s.current[1]))), LINES, n, true)}
            action={{ label: 'احفظ', onClick: () => onOpen('learn') }}
            onCheck={record((toast) => finishHifz(hafs, toast))}
          />
        </ul>

        <Details>
          <p className="khatma__date">
            <span>ختم الحفظ المتوقع</span>
            <strong>{dates.gregorian}</strong>
            <strong>{dates.hijri}</strong>
          </p>
          <ReminderLine time={k.reminder} />
          {doneCount > 0 && <p className="khatma__count">أتممت قبلها {countText(doneCount, KHATMAS, n)} حفظ</p>}
          <DetailsFooter confirm={confirm} setConfirm={setConfirm} onEdit={onEdit} onRemove={removeHifz} question="حذف ختمة الحفظ وكل تقدمها؟" />
        </Details>
      </section>
    </div>
  );
}

// ---------- بعد الختم ----------
export function HifzFinished({ date, doneCount }) {
  const dates = formatDates(date);
  return (
    <div className="khatma">
      <section className="khatma__card khatma__card--done hifz-card">
        <h3 className="khatma__title">أتممت ختمة الحفظ</h3>
        <p className="khatma__hint">تقبل الله منك، وجعلك من أهل القرآن الذين هم أهل الله وخاصته.</p>
        <p className="khatma__date">
          <span>ختمت الحفظ يوم</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>
        <p className="khatma__progress">أتممت {countText(doneCount, KHATMAS, n)} حفظ في هذا التطبيق</p>
        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" onClick={removeHifz}>
            ابدأ ختمة حفظ جديدة
          </button>
        </div>
      </section>
    </div>
  );
}
