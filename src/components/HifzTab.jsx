import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import RangePicker from "./RangePicker.jsx";
import { toArabicDigits } from "../data/quran.js";
import { verseLabel } from "../lib/study.js";
import { hafsOf, shownOf } from "../lib/verseMap.js";
import { dayKey, addDays, daysText, formatDates } from "../lib/khatma.js";
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
} from "../lib/hifz.js";
import { countText, KHATMAS } from "../lib/count.js";
import "./Khatma.css";

/*
  ختمة الحفظ في تبويب «الختمة» (٢٠٢٦-١١-١٦) — المنطق في src/lib/hifz.js.
  • HifzForm: الإنشاء (الاتجاه، والبداية والنهاية، و«لا أحفظ ما قبل البداية»، والحفظ اليومي بالأسطر،
    والمراجعتان) وتعديل الخطة (الحفظ اليومي والمراجعتان وحدها).
  • HifzCard: التقدّم والمحفوظ، وخطوات اليوم الثلاث: المراجعة البعيدة، والمراجعة القريبة، وحفظ الورد. لكل
    خطوة زرّ يفتح صفحتها (HifzPage) وزرّ «تم» لمن سمّع على شيخ أو من مصحف ورقي، و✓ إذا أُتمّت اليوم.
  • HifzFinished: بعد الختم.
  الخطة بترقيم حفص (hafs)، وتُعرض بترقيم المصحف المعروض (quran) — في ورش بما يقابلها.
*/
const n = toArabicDigits;
const toNumber = (text) =>
  parseInt(
    text.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)),
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
  const [dir, setDir] = useState(k?.dir ?? "forward");
  const [start, setStart] = useState(k?.start ?? 0);
  const [end, setEnd] = useState(k?.end ?? last);
  const [known, setKnown] = useState(k?.known ?? true);
  const [lines, setLines] = useState(k?.lines ?? DEFAULT_LINES);
  const [customLines, setCustomLines] = useState(
    !!k && !LINE_PRESETS.includes(k.lines),
  );
  const [linesDraft, setLinesDraft] = useState(
    k && !LINE_PRESETS.includes(k.lines) ? String(k.lines) : "",
  );
  const [near, setNear] = useState(k?.near ?? DEFAULT_NEAR);
  const [customNear, setCustomNear] = useState(
    !!k && !NEAR_PRESETS.includes(k.near),
  );
  const [nearDraft, setNearDraft] = useState(
    k && !NEAR_PRESETS.includes(k.near) ? String(k.near) : "",
  );
  const [far, setFar] = useState(k?.far ?? null); // null: المقترح
  const [picking, setPicking] = useState(null); // 'start' | 'end'

  const switchDir = (d) => {
    if (d === dir) return;
    setDir(d);
    setStart(d === "forward" ? 0 : nasStart);
    setEnd(d === "forward" ? last : fatihaEnd);
  };

  const valid = validPlan(hafs, dir, start, end);
  const before = valid ? beforeRanges(hafs, dir, start) : [];
  const suggested = suggestFar(hafs, editing ? [] : known ? before : []);
  const farChosen = far ?? suggested;
  const chosenLines = customLines
    ? toNumber(linesDraft) >= 1
      ? Math.min(toNumber(linesDraft), MAX_LINES)
      : null
    : lines;
  const typedNear = toNumber(nearDraft);
  const chosenNear = customNear
    ? typedNear >= 0
      ? Math.min(typedNear, MAX_NEAR)
      : null
    : near;
  const today = dayKey();
  const from = editing ? k.next : start;
  const wirds = useMemo(
    () =>
      valid && chosenLines ? splitHifz(hafs, dir, from, end, chosenLines) : [],
    [hafs, valid, dir, from, end, chosenLines],
  );
  const startDay = editing && k.lastDone === today ? addDays(today, 1) : today;
  const ready = valid && chosenLines && chosenNear != null && wirds.length > 0;
  const dates = ready && formatDates(addDays(startDay, wirds.length - 1));

  const pick = (v) => {
    const keys = hafsOf(quran, v);
    if (picking === "start") setStart(keys[0]);
    else setEnd(keys.at(-1));
    setPicking(null);
  };
  const submit = () => {
    const plan = { lines: chosenLines, near: chosenNear, far: farChosen };
    if (editing) editHifz(plan, today);
    else
      startHifz(
        { ...plan, dir, start, end, known: before.length ? known : true },
        today,
      );
    onDone(editing ? "تم تعديل الخطة" : null);
  };
  const shownVerse = (h) => shownOf(quran, h)[0] ?? h;

  return (
    <div className="khatma">
      <section className="khatma__card hifz-form">
        <h3 className="khatma__title">
          {editing ? "تعديل خطة الحفظ" : "ختمة حفظ جديدة"}
        </h3>

        {!editing && (
          <>
            <div className="hifz__field">
              <span className="hifz__label">الاتجاه</span>
              <div
                className="khatma__segment"
                role="radiogroup"
                aria-label="الاتجاه"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={dir === "forward"}
                  onClick={() => switchDir("forward")}
                >
                  من الفاتحة إلى الناس
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={dir === "reverse"}
                  onClick={() => switchDir("reverse")}
                >
                  من الناس إلى الفاتحة
                </button>
              </div>
            </div>

            <div className="hifz__range">
              <button
                type="button"
                className="hifz__pick"
                onClick={() => setPicking("start")}
                aria-label={`البداية: ${hifzLabel(quran, [start, start])}`}
              >
                <span>البداية</span>
                <strong>{hifzLabel(quran, [start, start])}</strong>
              </button>
              <button
                type="button"
                className="hifz__pick"
                onClick={() => setPicking("end")}
                aria-label={`النهاية: ${hifzLabel(quran, [end, end])}`}
              >
                <span>النهاية</span>
                <strong>{hifzLabel(quran, [end, end])}</strong>
              </button>
            </div>
            {dir === "reverse" && valid && (
              <p className="khatma__hint">
                تُحفظ السور من الآخر، وكل سورة من أولها إلى آخرها.
              </p>
            )}
            {!valid && (
              <p className="hifz__error" role="alert">
                {dir === "forward"
                  ? "النهاية قبل البداية. اختر نهاية بعدها."
                  : "في هذا الاتجاه تكون سورة النهاية قبل سورة البداية."}
              </p>
            )}
            {valid && before.length > 0 && (
              <label className="hifz__check">
                <input
                  type="checkbox"
                  checked={!known}
                  onChange={(e) => setKnown(!e.target.checked)}
                />
                <span>لا أحفظ ما قبل البداية</span>
              </label>
            )}
          </>
        )}

        <div className="hifz__field">
          <span className="hifz__label">الحفظ اليومي</span>
          <div
            className="khatma__chips"
            role="radiogroup"
            aria-label="الحفظ اليومي"
          >
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
            <button
              type="button"
              role="radio"
              aria-checked={customLines}
              onClick={() => setCustomLines(true)}
            >
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
                onChange={(e) =>
                  setLinesDraft(
                    e.target.value.replace(/[^0-9٠-٩]/g, "").slice(0, 3),
                  )
                }
                placeholder={`١–${n(MAX_LINES)}`}
              />
            </label>
          )}
        </div>

        <div className="hifz__field">
          <span className="hifz__label">المراجعة القريبة قبل الحفظ</span>
          <div
            className="khatma__chips"
            role="radiogroup"
            aria-label="المراجعة القريبة"
          >
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
                {p === 0
                  ? "بلا"
                  : p === 1
                    ? "ورد واحد"
                    : `آخر ${wirdsText(p, false)}`}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={customNear}
              onClick={() => setCustomNear(true)}
            >
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
                onChange={(e) =>
                  setNearDraft(
                    e.target.value.replace(/[^0-9٠-٩]/g, "").slice(0, 2),
                  )
                }
                placeholder={`٠–${n(MAX_NEAR)}`}
              />
            </label>
          )}
        </div>

        <div className="hifz__field">
          <span className="hifz__label">المراجعة البعيدة كل يوم</span>
          <div
            className="khatma__chips"
            role="radiogroup"
            aria-label="المراجعة البعيدة"
          >
            {FAR_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={farChosen === u}
                onClick={() => setFar(u)}
              >
                {FAR_NAMES[u]}
                {!editing && u === suggested ? " (مقترح)" : ""}
              </button>
            ))}
          </div>
          {!editing && (
            <p className="khatma__hint">
              {suggested === "juz"
                ? "تحفظ أكثر من نصف القرآن، فيقترح جزء كل يوم."
                : "تحفظ أقل من نصف القرآن، فيقترح حزب كل يوم."}{" "}
              تبدأ المراجعة من أول المحفوظ، وتعود إليه إذا وصلت إلى الدرس.
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
          valid && (
            <p className="khatma__summary khatma__summary--empty">
              اكتب عددا صحيحا
            </p>
          )
        )}

        <div className="khatma__actions">
          <button
            type="button"
            className="khatma__btn khatma__btn--primary"
            disabled={!ready}
            onClick={submit}
          >
            {editing ? "حفظ الخطة" : "ابدأ ختمة الحفظ"}
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
              title={
                picking === "start" ? "اختر آية البداية" : "اختر آية النهاية"
              }
              near={shownVerse(picking === "start" ? start : end)}
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
  if (result === "finished") onToast("أتممت ختمة الحفظ، تقبل الله منك");
  else if (result === "next") {
    const missed =
      k && ((k.far && !k.farDone) || (k.near.length > 0 && !k.nearDone));
    onToast(
      missed
        ? "سجل حفظ الورد. لا تترك المراجعة، فبها يثبت الحفظ"
        : "أحسنت، سجل حفظ الورد",
    );
  }
  return result;
}
const readState = (hafs) => {
  const k = readHifz();
  return k && !k.finished ? hifzState(hafs, k) : null;
};

export function finishReview(hafs, kind, onToast) {
  completeReview(hafs, kind);
  onToast(
    kind === "far"
      ? "أحسنت، تمت المراجعة البعيدة"
      : "أحسنت، تمت المراجعة القريبة",
  );
}

// ---------- أثناء الختمة ----------
export function HifzCard({
  quran,
  hafs,
  k,
  onOpen,
  onEdit,
  onToast,
  doneCount,
}) {
  const today = dayKey();
  const s = hifzState(hafs, k, today);
  const [confirm, setConfirm] = useState(false);
  const dates = formatDates(s.end);
  const status = s.behind
    ? { text: `متأخر عن الخطة ${daysText(s.behind, n)}`, kind: "behind" }
    : s.ahead
      ? { text: `متقدم على الخطة ${daysText(s.ahead, n)}`, kind: "ahead" }
      : s.doneToday
        ? { text: "أتممت حفظ اليوم ✓", kind: "done" }
        : { text: "على الخطة", kind: "on" };
  const nearLabel = s.near.length
    ? hifzLabel(quran, [
        Math.min(...s.near.map((r) => r[0])),
        Math.max(...s.near.map((r) => r[1])),
      ])
    : null;

  return (
    <div className="khatma">
      <section className="khatma__card hifz-card">
        <header className="khatma__head">
          <h3 className="khatma__title">ختمة الحفظ</h3>
          <span className="khatma__index">
            الورد {n(s.index)} من {n(s.total)}
          </span>
        </header>
        <div
          className="khatma__bar"
          role="progressbar"
          aria-label="تقدم ختمة الحفظ"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={s.percent}
        >
          <span style={{ width: `${s.percent}%` }} />
        </div>
        <p className="khatma__progress">
          <strong>{n(s.percent)}٪</strong> من الخطة، وتحفظ الآن{" "}
          {memorizedText(hafs, s.memorized)}
        </p>
        <p className={`khatma__status khatma__status--${status.kind}`}>
          {status.text}
        </p>

        {s.suggest && (
          <div className="hifz__note" role="note">
            <p>
              تجاوز حفظك نصف القرآن، فيقترح أن تزيد المراجعة البعيدة إلى جزء كل
              يوم.
            </p>
            <div className="hifz__noteActions">
              <button
                type="button"
                className="khatma__link"
                onClick={() => {
                  editHifz({ lines: k.lines, near: k.near, far: "juz" }, today);
                  onToast("صارت المراجعة البعيدة جزءا كل يوم");
                }}
              >
                اجعلها جزءا
              </button>
              <button
                type="button"
                className="khatma__link"
                onClick={() => dismissHint("juz")}
              >
                ليس الآن
              </button>
            </div>
          </div>
        )}
        {s.neglected && !s.farDone && (
          <p className="hifz__note hifz__note--warn" role="note">
            لم تراجع منذ {daysText(s.idleDays, n)}. المراجعة تثبت الحفظ، فلا
            تتركها.
          </p>
        )}

        <ol className="hifz__steps">
          <Step
            n={1}
            title="المراجعة البعيدة"
            done={s.farDone}
            detail={s.far ? s.far.name : "لا محفوظ للمراجعة بعد"}
            sub={
              s.far && s.far.ranges.length
                ? hifzLabel(quran, [s.far.ranges[0][0], s.far.ranges.at(-1)[1]])
                : null
            }
            action={
              s.far ? { label: "راجع", onClick: () => onOpen("far") } : null
            }
            onDone={s.far ? () => finishReview(hafs, "far", onToast) : null}
          />
          {k.near > 0 && (
            <Step
              n={2}
              title="المراجعة القريبة"
              done={s.nearDone}
              detail={
                s.near.length
                  ? k.near === 1
                    ? "الورد السابق"
                    : `آخر ${wirdsText(Math.min(k.near, s.near.length), false)}`
                  : "تبدأ بعد أول ورد تحفظه"
              }
              sub={nearLabel}
              action={
                s.near.length
                  ? { label: "سمع", onClick: () => onOpen("near") }
                  : null
              }
              onDone={
                s.near.length ? () => finishReview(hafs, "near", onToast) : null
              }
            />
          )}
          <Step
            n={k.near > 0 ? 3 : 2}
            title={s.doneToday ? "الورد التالي" : "حفظ اليوم"}
            done={s.doneToday}
            detail={hifzLabel(quran, s.current)}
            sub={countText(
              Math.max(
                1,
                Math.round(linesOf(hafs, s.current[0], s.current[1])),
              ),
              LINES,
              n,
              true,
            )}
            action={{
              label: "احفظ",
              onClick: () => onOpen("learn"),
              primary: true,
            }}
            onDone={() => finishHifz(hafs, onToast)}
            doneLabel="أتممت الحفظ"
          />
        </ol>

        <p className="khatma__date">
          <span>ختم الحفظ المتوقع</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>

        <div className="khatma__footer">
          {confirm ? (
            <>
              <span>حذف ختمة الحفظ وكل تقدمها؟</span>
              <button
                type="button"
                className="khatma__link khatma__link--danger"
                onClick={removeHifz}
              >
                نعم، احذفها
              </button>
              <button
                type="button"
                className="khatma__link"
                onClick={() => setConfirm(false)}
              >
                لا
              </button>
            </>
          ) : (
            <>
              <button type="button" className="khatma__link" onClick={onEdit}>
                تعديل الخطة
              </button>
              <button
                type="button"
                className="khatma__link khatma__link--danger"
                onClick={() => setConfirm(true)}
              >
                حذف الختمة
              </button>
            </>
          )}
        </div>
      </section>
      {doneCount > 0 && (
        <p className="khatma__count">
          أتممت قبلها {countText(doneCount, KHATMAS, n)} حفظ
        </p>
      )}
    </div>
  );
}

// خطوة من خطوات اليوم: رقمها أو ✓، واسمها وما فيها، وزرّها، و«تم» لإتمامها دون فتح صفحتها
function Step({
  n: num,
  title,
  done,
  detail,
  sub,
  action,
  onDone,
  doneLabel = "تم",
}) {
  return (
    <li
      className={`hifz__step${done ? " hifz__step--done" : ""}`}
      aria-label={`${title}${done ? "، أتممتها اليوم" : ""}`}
    >
      <span className="hifz__num" aria-hidden="true">
        {done ? "✓" : n(num)}
      </span>
      <div className="hifz__body">
        <span className="khatma__label">{title}</span>
        <strong className="hifz__detail">{detail}</strong>
        {sub && <span className="khatma__suras">{sub}</span>}
        {(action || onDone) && (
          <div className="khatma__actions">
            {action && (
              <button
                type="button"
                className={`khatma__btn${action.primary ? " khatma__btn--primary" : ""}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            )}
            {onDone && (
              <button type="button" className="khatma__btn" onClick={onDone}>
                {doneLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ---------- بعد الختم ----------
export function HifzFinished({ date, doneCount }) {
  const dates = formatDates(date);
  return (
    <div className="khatma">
      <section className="khatma__card khatma__card--done hifz-card">
        <h3 className="khatma__title">أتممت ختمة الحفظ</h3>
        <p className="khatma__hint">
          تقبل الله منك، وجعلك من أهل القرآن الذين هم أهل الله وخاصته.
        </p>
        <p className="khatma__date">
          <span>ختمت الحفظ يوم</span>
          <strong>{dates.gregorian}</strong>
          <strong>{dates.hijri}</strong>
        </p>
        <p className="khatma__progress">
          أتممت {countText(doneCount, KHATMAS, n)} حفظ في هذا التطبيق
        </p>
        <div className="khatma__actions">
          <button
            type="button"
            className="khatma__btn khatma__btn--primary"
            onClick={removeHifz}
          >
            ابدأ ختمة حفظ جديدة
          </button>
        </div>
      </section>
    </div>
  );
}
