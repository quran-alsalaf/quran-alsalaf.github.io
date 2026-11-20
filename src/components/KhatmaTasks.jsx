import { useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { restoreKhatmas, snapshotKhatmas } from '../lib/khatma.js';

const n = toArabicDigits;

/*
  أجزاء بطاقة الختمة (تنسيق تبويب الختمة، الجزء ١، ٢٠٢٦-١١-٢٠ بقرار صاحب المشروع): كل ختمة بطاقة مختصرة ومهامها تحتها.
  • Task: سطر مهمة — دائرة ○ تُضغط فتسجّل المهمة وتصير ✓ (لمن قرأ من مصحف ورقي أو سمّع على شيخ)، واسمها وما
    فيها، وزرّ واحد يفتح صفحتها. ولا يُلغى الإتمام بالضغط على ✓ (لئلا يُلغى بلمسة خاطئة)، بل بـ«تراجع».
  • withUndo: يسجّل المهمة ثم رسالة فيها «تراجع» (خمس ثوانٍ) يعيد الختمات كما كانت قبل الضغط.
  • Details: «التفاصيل» مطوية في كل فتح (الختم المتوقع، والتذكير، وعدد الختمات، وتعديل الخطة وحذفها).
*/
export function Task({ title, detail, sub, done, action, onCheck, note }) {
  return (
    <li className={`task${done ? ' task--done' : ''}`}>
      {onCheck && !done ? (
        <button type="button" className="task__check" onClick={onCheck} aria-label={`سجّل أنك أتممت: ${title}`} />
      ) : (
        <span className={`task__check${onCheck || done ? '' : ' task__check--off'}`} aria-hidden="true">
          {done ? '✓' : ''}
        </span>
      )}
      <div className="task__body">
        <span className="task__title">
          {title}
          {done && <span className="task__sr">، أتممتها اليوم</span>}
        </span>
        {detail && <strong className="task__detail">{detail}</strong>}
        {sub && <span className="task__sub">{sub}</span>}
        {note && <span className="task__note">{note}</span>}
      </div>
      {action && !done && (
        <button type="button" className="khatma__btn khatma__btn--primary task__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </li>
  );
}

// يسجّل المهمة (record يستقبل دالة الرسالة) ومعها «تراجع»
export function withUndo(onToast, record) {
  const snap = snapshotKhatmas();
  const undo = {
    label: 'تراجع',
    run: () => {
      restoreKhatmas(snap);
      onToast('تم التراجع');
    },
  };
  record((text) => onToast(text, undo));
}

export function Details({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="kdetails">
      <button type="button" className="kdetails__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{open ? 'إخفاء التفاصيل' : 'التفاصيل'}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="kdetails__body">{children}</div>}
    </div>
  );
}

// رأس بطاقة الختمة: الاسم ورقم الورد، ثم شريط التقدّم وتحته النسبة والحالة
export function CardHead({ title, index, total, percent, label, status, extra }) {
  return (
    <>
      <header className="khatma__head">
        <h3 className="khatma__title">{title}</h3>
        <span className="khatma__index">
          الورد {n(index)} من {n(total)}
        </span>
      </header>
      <div className="khatma__meter">
        <div className="khatma__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className="khatma__meta">
          <strong>{n(percent)}٪</strong>
          {extra && <span>{extra}</span>}
          <span className={`khatma__status khatma__status--${status.kind}`}>{status.text}</span>
        </p>
      </div>
    </>
  );
}

// آخر «التفاصيل»: تعديل الخطة وحذف الختمة (بتأكيد)
export function DetailsFooter({ confirm, setConfirm, onEdit, onRemove, question }) {
  return (
    <div className="khatma__footer">
      {confirm ? (
        <>
          <span>{question}</span>
          <button type="button" className="khatma__link khatma__link--danger" onClick={onRemove}>
            نعم، احذفها
          </button>
          <button type="button" className="khatma__link" onClick={() => setConfirm(false)}>
            لا
          </button>
        </>
      ) : (
        <>
          <button type="button" className="khatma__link" onClick={onEdit}>
            تعديل الخطة
          </button>
          <button type="button" className="khatma__link khatma__link--danger" onClick={() => setConfirm(true)}>
            حذف الختمة
          </button>
        </>
      )}
    </div>
  );
}
