import { useState } from 'react';
import './OnboardingGuide.css';

// الدليل التعريفي (الفصل ١١): يشرح كل ميزات التطبيق بصور توضيحية متحركة (بطلب صاحب المشروع
// ٢٠٢٦-٠٩-٢٤)، وآخر شريحة تنبيه أن المحتوى الإضافي لا يشمل كل المصحف (نصّ UNAVAILABLE نفسه
// من src/components/StudySheet.jsx، تنبيهًا بلا تكرار حرفي للثابتة هناك).
//
// الصور مُصغَّرة من واجهة التطبيق نفسها بنسبة جوّال حقيقي طولًا وعرضًا (بطلب صاحب المشروع
// ٢٠٢٦-٠٩-٢٦) — لا رموز عامة: إطار هاتف، وأسطر تمثّل نص المصحف، ونقطة لمس (إصبع) تؤدّي
// الحركة الموصوفة فعليًّا، فيظهر تأثيرها في نفس الإطار (بطاقة، أو صفحة تصعد، أو درج ينزلق).
const SLIDES = [
  { title: 'الضغط المطوّل على الآية', text: 'اضغط مطوّلًا على أي آية لتظهر خيارات عدّة، منها: التفسير، ومعاني الكلمات، والعمل بالآيات.', art: 'longpress' },
  {
    title: 'صفحات التفسير ومعاني الكلمات والعمل بالآيات',
    text: 'اسحب صفحة المصحف إلى الأعلى، فتظهر صفحة فيها ثلاث تبويبات: التفسير، ومعاني الكلمات، والعمل بالآيات. ويكون محتواها خاصًا بصفحة المصحف الحالية، أو بالمقدار الذي حدّدته إن كنت قد حدّدت مقدارًا.',
    art: 'sheet',
  },
  {
    title: 'تحديد مقدار الآيات',
    text: 'من المربع الأيسر في الأسفل تستطيع تحديد مقدار من الآيات، فتستمع له، وتصبح صفحات التفسير ومعاني الكلمات والعمل بالآيات خاصة به.',
    art: 'range',
  },
  {
    title: 'الاستماع للآيات',
    text: 'من المربع الأيمن في الأسفل تستطيع ضبط إعدادات الاستماع، فيبدأ التشغيل فورًا، وتستطيع تنزيل الصوت لسماعه لاحقًا بلا إنترنت.',
    art: 'listen',
  },
  {
    title: 'تنبيه مهم',
    text: 'التفسير متوفر لجميع آيات المصحف. أمّا معاني الكلمات والعمل بالآيات، فمتوفّران حاليًا من سورة الفاتحة إلى سورة الأنعام، ومن سورة الملك إلى سورة الناس فقط، وقد يُضافان لبقية المصحف لاحقًا. وتستطيع العودة إلى هذا الدليل في أي وقت من الإعدادات.',
    art: 'notice',
  },
];

export default function OnboardingGuide({ open, onClose }) {
  const [i, setI] = useState(0);
  if (!open) return null;
  const last = i === SLIDES.length - 1;

  const close = () => {
    setI(0);
    onClose();
  };

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="الدليل التعريفي">
      <button type="button" className="onboard__skip" onClick={close}>
        تخطي
      </button>
      <div className="onboard__card">
        <Illustration key={SLIDES[i].art} kind={SLIDES[i].art} />
        <h2>{SLIDES[i].title}</h2>
        <p>{SLIDES[i].text}</p>
      </div>
      <div className="onboard__dots">
        {SLIDES.map((_, k) => (
          <span key={k} className={k === i ? 'onboard__dot onboard__dot--active' : 'onboard__dot'} />
        ))}
      </div>
      <div className="onboard__nav">
        <button type="button" className="onboard__prev" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
          السابق
        </button>
        <button type="button" className="onboard__next" onClick={() => (last ? close() : setI((n) => n + 1))}>
          {last ? 'ابدأ' : 'التالي'}
        </button>
      </div>
    </div>
  );
}

// ---------- إطار هاتف مُصغَّر بنسبة جوّال حقيقي، مشترك بين الشرائح: شريط علوي، ومحتوى،
// وخانتان سفليتان — يُميَّز منها ما تخصّه الشريحة الحالية ----------
function Frame({ activeDock, children }) {
  return (
    <>
      <defs>
        <clipPath id="onbPhoneClip">
          <rect x="20" y="8" width="60" height="134" rx="16" />
        </clipPath>
      </defs>
      <rect x="20" y="8" width="60" height="134" rx="16" className="onboard__stroke" />
      {/* ما قد ينزلق من خارج حدود الإطار (صفحة) يُقصّ على حدوده فلا يظهر خارجه */}
      <g clipPath="url(#onbPhoneClip)">
        <path d="M20 32h60M20 116h60" className="onboard__stroke onboard__thin" />
        <rect x="68" y="17" width="7" height="6" rx="1.5" className="onboard__chrome" />
        <circle cx="30" cy="20" r="3.3" className="onboard__chrome" fill="none" strokeWidth="1.4" stroke="currentColor" />
        <rect x="25" y="120" width="24" height="13" rx="6.5" className={activeDock === 'range' ? 'onboard__dockActive' : 'onboard__chromeBox'} />
        <rect x="51" y="120" width="24" height="13" rx="6.5" className={activeDock === 'listen' ? 'onboard__dockActive' : 'onboard__chromeBox'} />
        {children}
      </g>
    </>
  );
}

// أسطر نص المصحف التمثيلية: كلمات (مستطيلات قصيرة) من اليمين لليسار
function TextLines({ rows = 4, from = 40 }) {
  const words = [
    [14, 9, 8],
    [10, 15, 7],
    [8, 12, 10],
    [12, 8, 13],
    [9, 13, 8],
  ];
  return (
    <g className="onboard__lines">
      {Array.from({ length: rows }, (_, r) => {
        const y = from + r * 11;
        let x = 72;
        return words[r % words.length].map((w, i) => {
          x -= w + 2.5;
          return <rect key={i} x={x} y={y} width={w} height={3.6} rx={1.8} className="onboard__wordFaint" />;
        });
      })}
    </g>
  );
}

// نقطة اللمس (الإصبع): حلقة وسط نقطة بلون التمييز، تمثّل موضع أنملة المستخدم على الشاشة
function Touch({ className }) {
  return (
    <g className={className}>
      <circle r="7" className="onboard__touchRing" />
      <circle r="2.8" className="onboard__fillAccent" />
    </g>
  );
}

function Illustration({ kind }) {
  return (
    <div className={`onboard__art onboard__art--${kind}`} aria-hidden="true">
      <svg viewBox="0 0 100 150">
        {kind === 'longpress' && (
          <Frame>
            <TextLines rows={4} />
            {/* الكلمة المضغوط عليها */}
            <rect x="40" y="49" width="14" height="3.6" rx="1.8" className="onboard__wordTarget" />
            <g transform="translate(47 50.8)">
              <circle r="4.2" className="onboard__pulse onboard__pulse1" />
              <circle r="4.2" className="onboard__pulse onboard__pulse2" />
            </g>
            {/* البطاقة العائمة: خمس أيقونات (تفسير · معاني · عمل · ملاحظة · علامة) */}
            <g className="onboard__popCard">
              <rect x="26" y="33" width="48" height="13" rx="6.5" className="onboard__cardBox" />
              {[0, 1, 2, 3, 4].map((i) => (
                <circle key={i} cx={33 + i * 8.5} cy="39.5" r="2.6" className="onboard__fillAccent" />
              ))}
            </g>
            <Touch className="onboard__holdTouch" />
          </Frame>
        )}

        {kind === 'sheet' && (
          <Frame>
            <TextLines rows={3} from={40} />
            {/* الصفحة السفلية تصعد من الأسفل */}
            <g className="onboard__sheetPanel">
              <rect x="24" y="66" width="52" height="68" rx="12" className="onboard__cardBox" />
              <rect x="30" y="72" width="12" height="4" rx="2" className="onboard__fillAccent" />
              <rect x="44" y="72" width="12" height="4" rx="2" className="onboard__wordFaint" />
              <rect x="58" y="72" width="12" height="4" rx="2" className="onboard__wordFaint" />
              <rect x="30" y="84" width="40" height="4" rx="2" className="onboard__wordFaint" />
              <rect x="30" y="94" width="34" height="4" rx="2" className="onboard__wordFaint" />
              <rect x="30" y="104" width="24" height="4" rx="2" className="onboard__wordFaint" />
            </g>
            <Touch className="onboard__dragTouch" />
          </Frame>
        )}

        {kind === 'range' && (
          <Frame activeDock="range">
            <TextLines rows={2} from={42} />
            <g className="onboard__rangeSheet">
              <rect x="24" y="68" width="52" height="58" rx="12" className="onboard__cardBox" />
              <rect x="32" y="76" width="36" height="14" rx="7" className="onboard__rowA" />
              <rect x="32" y="96" width="36" height="14" rx="7" className="onboard__rowB" />
            </g>
            <Touch className="onboard__tapDock onboard__tapDockLeft" />
          </Frame>
        )}

        {kind === 'listen' && (
          <Frame activeDock="listen">
            <TextLines rows={2} from={42} />
            <g className="onboard__listenSheet">
              <rect x="30" y="64" width="40" height="56" rx="14" className="onboard__cardBox" />
              <circle cx="50" cy="92" r="15" className="onboard__fillAccent" />
              <path d="M45 85v14l12-7Z" fill="var(--bg)" />
            </g>
            <Touch className="onboard__tapDock onboard__tapDockRight" />
          </Frame>
        )}

        {kind === 'notice' && (
          <g transform="translate(50 75)">
            <circle r="30" className="onboard__stroke" />
            <circle cy="-13" r="2.2" className="onboard__fillInk" />
            <path d="M0-5v21" className="onboard__stroke" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
}
