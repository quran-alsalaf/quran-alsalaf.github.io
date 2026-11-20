import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { nextLabel, nextStep, prevStep } from '../lib/planSteps.js';

/*
  نموذج إنشاء الختمة خطوات (تنسيق تبويب الختمة، الجزء ٢، ٢٠٢٦-١١-٢٠) — المنطق في src/lib/planSteps.js.
  • useSteps: الخطوة الحالية، و«التالي» و«رجوع»، وفتح خطوة من الملخص (فيعود إليه زرّها).
  • StepCard: بطاقة الخطوة — العنوان ومؤشر الخطوات، والسؤال وجملة شرحه، ثم المحتوى، ثم الزرّان.
  • SummaryRows: أسطر الملخص، كلٌّ يفتح خطوته.
  • TypeSwitch: نوع الختمة (أول خطوة بلا ختمة).
  تستعملها ختمة الورد (KhatmaTab.jsx) وختمة الحفظ (HifzTab.jsx).
*/
const n = toArabicDigits;

export function useSteps(steps, onCancel) {
  const [state, setState] = useState({ id: steps[0], fromSummary: false });
  const id = steps.includes(state.id) ? state.id : steps[0];
  const fromSummary = state.fromSummary;
  const go = ({ step, fromSummary: f }) => setState({ id: step, fromSummary: f });
  return {
    id,
    index: steps.indexOf(id),
    total: steps.length,
    fromSummary,
    // reset: الخطوة غيّرت ما بعدها، فمن الملخص تمرّ به قبل الرجوع إليه
    next: (reset = false) => go(nextStep(steps, id, { fromSummary, reset })),
    nextLabel: (reset = false) => nextLabel(steps, id, { fromSummary, reset }),
    // «رجوع» في الأولى يلغي الإنشاء (إن كان له إلغاء)، ولا رجوع لمن جاء من الملخص (زرّه يعود إليه)
    canBack: !fromSummary && (prevStep(steps, id) !== null || !!onCancel),
    back: () => {
      const p = prevStep(steps, id);
      if (p) go({ step: p, fromSummary: false });
      else onCancel?.();
    },
    open: (step) => go({ step, fromSummary: true }),
  };
}

export function StepCard({ title, steps, question, hint, children, primary, after, className = '' }) {
  const questionRef = useRef(null);
  const first = useRef(true);
  // عند تغيّر الخطوة يُنقل التركيز إلى سؤالها (لا عند أول فتح، فلا يُسرق التركيز)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    questionRef.current?.focus({ preventScroll: true });
    questionRef.current?.closest('.khatma__card')?.scrollIntoView?.({ block: 'nearest' });
  }, [steps.id]);

  return (
    <div className="khatma">
      <section className={`khatma__card steps ${className}`} data-step={steps.id}>
        <div className="steps__top">
          <h3 className="khatma__title">{title}</h3>
          <span className="steps__count">
            الخطوة {n(steps.index + 1)} من {n(steps.total)}
          </span>
        </div>
        <div className="steps__dots" aria-hidden="true">
          {Array.from({ length: steps.total }, (_, i) => (
            <span key={i} className={i <= steps.index ? 'steps__dot steps__dot--on' : 'steps__dot'} />
          ))}
        </div>
        <h4 className="steps__question" tabIndex={-1} ref={questionRef}>
          {question}
        </h4>
        {hint && <p className="steps__hint">{hint}</p>}
        {children}
        <div className="khatma__actions">
          <button type="button" className="khatma__btn khatma__btn--primary" disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </button>
          {steps.canBack && (
            <button type="button" className="khatma__btn" onClick={steps.back}>
              رجوع
            </button>
          )}
        </div>
      </section>
      {after}
    </div>
  );
}

// أسطر الملخص: الاسم والقيمة (وملاحظة إن كانت)، والضغط يفتح خطوتها
export function SummaryRows({ rows, onOpen }) {
  return (
    <ul className="steps__rows">
      {rows.map((r) => (
        <li key={r.step}>
          <button type="button" className="steps__row" onClick={() => onOpen(r.step)}>
            <span className="steps__rowLabel">{r.label}</span>
            <strong className="steps__rowValue">{r.value}</strong>
            {r.note && <span className="steps__rowNote">{r.note}</span>}
            <span className="steps__rowEdit" aria-hidden="true">
              تغيير
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// نوع الختمة الجديدة (٢٠٢٦-١١-١٦): الورد أو الحفظ. وتجتمع الختمتان، ومن كل نوع واحدة. وهو أول خطوات الإنشاء
// بلا ختمة (الجزء ٢)، فاختيار الحفظ يفتح خطواته
export function TypeSwitch({ type, onType }) {
  return (
    <div className="khatma__segment" role="radiogroup" aria-label="نوع الختمة">
      <button type="button" role="radio" aria-checked={type === 'wird'} onClick={() => onType('wird')}>
        ختمة الورد
      </button>
      <button type="button" role="radio" aria-checked={type === 'hifz'} onClick={() => onType('hifz')}>
        ختمة الحفظ
      </button>
    </div>
  );
}
