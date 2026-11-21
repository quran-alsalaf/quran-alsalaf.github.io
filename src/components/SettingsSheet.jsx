import { useEffect, useRef, useState } from 'react';
import { ACCENTS, BACKGROUNDS, readAppearance, setAccent, setBackground } from '../lib/appearance.js';
import { readRubAlert, readWeeksTint, setRubAlert, setWeeksTint } from '../lib/settings.js';
import AboutContent from './AboutPage.jsx';
import BackupRows from './BackupRows.jsx';
import ContactPage from './ContactPage.jsx';
import { openStore, ratingAvailable, shareMessage } from '../lib/feedback.js';
import { shareText } from '../lib/userdata.js';
import ReadingInfo from './ReadingInfo.jsx';
import { ReciteInfo } from './Recite.jsx';
import './SettingsSheet.css';
import { useLayer } from '../lib/layers.js';
import { RIWAYAT, setRiwayah, useRiwayah } from '../lib/riwayah.js';

/*
  الإعدادات (٢٠٢٦-١١-١١): لوحة جانبية تنزلق من الحافة اليسرى فوق المصحف، مقابل القائمة الجانبية
  في اليمين وعلى نسقها (الحركة والألوان والخلفية المعتمة). اليمين لإدارة الأشياء (السور والملاحظات
  والعلامات)، واليسار للإعدادات والميزات.
  تُغلق بزرّ ✕، وبالنقر خارجها، وبسحبها نحو اليسار (إصبعًا أو فأرة)، وبـEsc، وبزرّ الرجوع في أندرويد
  (فتحها يضيف خطوة إلى سجل المتصفح — App.jsx).
  «عن التطبيق» و«وضع القراءة» و«النسخة الاحتياطية» صفحات فرعية داخل اللوحة نفسها بسهم رجوع (SubPage أدناه)؛ وفي صفحة
  «وضع القراءة» شرحه وزرّ يبدأه (٢٠٢٦-١١-١٤، كان السطر يبدأ الوضع مباشرة).
  و«النسخة الاحتياطية» (٢٠٢٦-١١-١٦) سطر واحد يفتح صفحة فرعية فيها خياراها: حفظ نسخة، واستعادة من نسخة.

  ترتيب الإعدادات (٢٠٢٦-١١-٢٠، الجلسة ٣ ب، بقرار صاحب المشروع): المظهر والقراءة ثابتان في أولها، ثم سطر
  «الإعدادات التخصيصية» يفتح صفحة فيها الرواية ومفتاحا القراءة والنسخة الاحتياطية (وهذه صفحة داخلها، سهمها
  يرجع إليها)، ثم فراغ، وفي أسفل اللوحة أربعة أسطر بلا عنوان: عن التطبيق، وللشكاوى والاقتراحات، وقيّم التطبيق
  (في التطبيق الأصلي وحده)، وشارك التطبيق (src/lib/feedback.js). (الاسم والترتيب ٢٠٢٦-١١-٢١ بقرار صاحب المشروع؛
  كان «تواصل معنا» آخرها)
  الصفحات الفرعية وآباؤها في PARENT: سهم الرجوع وEsc وزرّ الرجوع في أندرويد ترجع من كل صفحة إلى أبيها.

  إضافة إعداد أو ميزة جديدة: سطر في قسمه بأحد الأسطر الجاهزة أدناه
  (SegmentRow للاختيار من خيارات، SwatchRow للاختيار من ألوان، SwitchRow للتشغيل والإيقاف،
  LinkRow لما يفتح شيئًا)،
  أو قسم جديد بـ<Section title="…">. (حجم خط التطبيق أُلغي ٢٠٢٦-٠٩-٢٥ بطلب صاحب المشروع)
*/

// السحب نحو اليسار: يبدأ بعد هذه المسافة أفقيًا، ويُغلق إن تجاوز هذا الجزء من عرض اللوحة أو كان سريعًا
const DRAG_START = 8;
const CLOSE_RATIO = 0.3;
const FLING_SPEED = 0.5; // px/ms

// أبو كل صفحة فرعية (وما لم يُذكر أبوه الإعدادات نفسها)
export const PARENT = { backup: 'custom' };
export const settingsParent = (page) => (page === 'main' ? null : PARENT[page] ?? 'main');

export default function SettingsSheet({ open, panel, page = 'main', onPage, onClose, onStartReading, onStartRecite, onToast }) {
  const [look, setLook] = useState(readAppearance);
  const [weeks, setWeeks] = useState(readWeeksTint);
  const [rubAlert, setRubAlertOn] = useState(readRubAlert);
  const sub = page !== 'main';
  // الرواية (٢٠٢٦-١١-١٥): يتبدّل المصحف كله فورًا على الصفحة نفسها (App.jsx)
  const riwayah = useRiwayah() ?? 'hafs';

  // Esc في الصفحة الفرعية يرجع إلى الإعدادات، وفي الإعدادات يغلق اللوحة
  useLayer(() => (sub ? onPage(settingsParent(page)) : onClose()), open);
  const back = () => onPage(settingsParent(page));

  // المظهر يُطبَّق فورًا ويُحفظ محليًّا (src/lib/appearance.js)
  const chooseBackground = (id) => setLook(setBackground(id));
  const chooseAccent = (id) => setLook(setAccent(id));
  // دوائر «لون التطبيق» بالدرجة التي ستظهر فعلًا على الخلفية المختارة
  const darkBg = BACKGROUNDS.find((b) => b.id === look.bg)?.dark;

  const toggleWeeks = () => {
    setWeeksTint(!weeks);
    setWeeks(!weeks);
  };

  const toggleRubAlert = () => {
    setRubAlert(!rubAlert);
    setRubAlertOn(!rubAlert);
  };

  // شارك التطبيق: قائمة المشاركة، وحيث لا قائمة يُنسخ النص
  const share = async () => {
    const result = await shareText(shareMessage());
    if (result === 'copied') onToast?.('نُسخ رابط التطبيق');
    else if (result === 'failed') onToast?.('تعذّرت المشاركة');
  };

  const card = useDragToClose(onClose, open);

  return (
    <div
      className={`settings${open ? ' settings--open' : ''}${panel ? ' settings--panel' : ''}`}
      aria-hidden={!open}
      inert={open ? undefined : ''}
    >
      <div className="settings__backdrop" onClick={onClose} />
      <section ref={card} className="settings__card" role="dialog" aria-modal="true" aria-label="الإعدادات">
        <div className={`settings__page${sub ? ' settings__page--behind' : ''}`} inert={sub ? '' : undefined}>
          <header className="settings__head">
            <h2>الإعدادات</h2>
            <CloseButton onClick={onClose} />
          </header>

          <div className="settings__body settings__body--main">
            <Section title="المظهر">
              <SwatchRow
                label="خلفية القراءة"
                value={look.bg}
                options={BACKGROUNDS.map((b) => ({ value: b.id, label: b.name, color: b.bg, mark: b.ink }))}
                onChange={chooseBackground}
              />
              <SwatchRow
                label="لون التطبيق"
                value={look.accent}
                options={ACCENTS.map((a) =>
                  // «بلا لون»: دائرة نصفها فاتح ونصفها غامق تميّزه عن الألوان، والصح فوقها بلون يعاكس ما تحته
                  a.ink
                    ? { value: a.id, label: a.name, color: 'linear-gradient(135deg, #fff 50%, #2b2b2e 50%)', split: true }
                    : { value: a.id, label: a.name, color: darkBg ? a.dark : a.light }
                )}
                onChange={chooseAccent}
              />
            </Section>

            <Section title="القراءة">
              <LinkRow label="وضع القراءة" onClick={() => onPage('reading')} />
              <LinkRow label="وضع التسميع" onClick={() => onPage('recite')} />
            </Section>

            <Section>
              <LinkRow label="الإعدادات التخصيصية" onClick={() => onPage('custom')} />
            </Section>

            <Section foot>
              <LinkRow label="عن التطبيق" onClick={() => onPage('about')} />
              <LinkRow label="للشكاوى والاقتراحات" onClick={() => onPage('contact')} />
              {ratingAvailable() && <ActionRow label="قيّم التطبيق" icon={<StarIcon />} onClick={openStore} />}
              <ActionRow label="شارك التطبيق" icon={<ShareIcon />} onClick={share} />
            </Section>
          </div>
        </div>

        <SubPage title="الإعدادات التخصيصية" shown={page === 'custom' || page === 'backup'} behind={page === 'backup'} onBack={back} onClose={onClose}>
          <Section title="المصحف">
            <SegmentRow label="الرواية" value={riwayah} options={RIWAYAT.map((r) => ({ value: r.id, label: r.name }))} onChange={setRiwayah} />
          </Section>
          <Section title="القراءة">
            <SwitchRow label="تمييز مقررات الأسابيع" checked={weeks} onChange={toggleWeeks} />
            <SwitchRow label="التنبيه ببداية الربع" checked={rubAlert} onChange={toggleRubAlert} />
          </Section>
          <Section>
            <LinkRow label="النسخة الاحتياطية" onClick={() => onPage('backup')} />
          </Section>
        </SubPage>
        <SubPage title="وضع القراءة" shown={page === 'reading'} onBack={back} onClose={onClose}>
          <ReadingInfo onStart={onStartReading} />
        </SubPage>
        <SubPage title="وضع التسميع" shown={page === 'recite'} onBack={back} onClose={onClose}>
          <ReciteInfo onStart={onStartRecite} />
        </SubPage>
        <SubPage title="النسخة الاحتياطية" shown={page === 'backup'} onBack={back} onClose={onClose}>
          <BackupRows />
        </SubPage>
        <SubPage title="عن التطبيق" shown={page === 'about'} onBack={back} onClose={onClose}>
          <AboutContent />
        </SubPage>
        <SubPage title="للشكاوى والاقتراحات" shown={page === 'contact'} onBack={back} onClose={onClose}>
          <ContactPage riwayah={riwayah} />
        </SubPage>
      </section>
    </div>
  );
}

// صفحة فرعية تدخل من اليسار فوق الإعدادات، وسهم الرجوع في أولها (يمينًا)
// behind: صفحة فرعية فُتحت فوقها صفحة من داخلها (النسخة الاحتياطية فوق الإعدادات التخصيصية)
function SubPage({ title, shown, behind = false, onBack, onClose, children }) {
  return (
    <div
      className={`settings__page settings__page--sub${shown ? ' settings__page--in' : ''}${behind ? ' settings__page--behind' : ''}`}
      inert={shown && !behind ? undefined : ''}
    >
      <header className="settings__head">
        <button className="settings__back" type="button" onClick={onBack} aria-label="رجوع">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2>{title}</h2>
        <CloseButton onClick={onClose} />
      </header>
      <div className="settings__body">{children}</div>
    </div>
  );
}

// ---------- لبنات الأقسام والأسطر ----------

// foot: الأسطر الأخيرة بلا عنوان، ملتصقة بأسفل اللوحة (وفي الشاشة القصيرة تحت ما قبلها مباشرة)
function Section({ title, foot = false, children }) {
  return (
    <section className={`settings__section${foot ? ' settings__section--foot' : ''}`}>
      {title && <h3 className="settings__sectionTitle">{title}</h3>}
      <div className="settings__group">{children}</div>
    </section>
  );
}

function SegmentRow({ label, value, options, onChange }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <div className="settings__segment" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// صفّ دوائر ملوّنة بلا أسماء مكتوبة (بطلب صاحب المشروع)؛ واسم كل لون لقارئ الشاشة وتلميح الفأرة. والمختارة بحلقة بلون التطبيق وعلامة صح؛ و`mark` لون علامة الصح
// إن لم تكن بلون نص الزر الملوّن (في دوائر الخلفيات: بلون نص المصحف عليها)
function SwatchRow({ label, value, options, onChange }) {
  return (
    <div className="settings__row settings__row--stack">
      <span className="settings__label">{label}</span>
      <div
        className="swatches"
        role="radiogroup"
        aria-label={label}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`swatch${o.split ? ' swatch--split' : ''}`}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
          >
            <span className="swatch__dot" style={{ background: o.color, color: o.mark }}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <button className="settings__switch" type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
        <span />
      </button>
    </div>
  );
}

function LinkRow({ label, onClick }) {
  return (
    <button type="button" className="settings__row settings__link" onClick={onClick}>
      <span className="settings__label">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__chevron">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// سطر يفعل شيئًا مباشرة (قيّم التطبيق، شارك التطبيق): أيقونته مكان سهم الفتح
function ActionRow({ label, icon, onClick }) {
  return (
    <button type="button" className="settings__row settings__link" onClick={onClick}>
      <span className="settings__label">{label}</span>
      {icon}
    </button>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__icon">
      <path
        d="m12 3.6 2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7L12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__icon">
      <circle cx="17.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6.5" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CloseButton({ onClick }) {
  return (
    <button className="settings__close" type="button" onClick={onClick} aria-label="إغلاق">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// سحب اللوحة نحو اليسار بالإصبع أو الفأرة: تتبع اليد، فإن جاوزت حدًّا أو نُفضت أُغلقت، وإلا عادت.
// السحب الرأسي يبقى تمريرًا عاديًا (touch-action: pan-y)، والنقرة بعد سحب لا تُحسب ضغطًا على زر
function useDragToClose(onClose, open) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return undefined;
    let start = null; // { x, y, t, id }
    let dragging = false;
    let dx = 0;
    let suppressClick = false;

    const reset = () => {
      el.style.transform = '';
      el.classList.remove('settings__card--drag');
      start = null;
      dragging = false;
      dx = 0;
    };
    const onDown = (e) => {
      if (e.button !== 0 || start) return;
      if (e.target.closest?.('input, textarea, select')) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      suppressClick = false;
    };
    const onMove = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const mx = e.clientX - start.x;
      const my = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(mx) < DRAG_START && Math.abs(my) < DRAG_START) return;
        // رأسي أو نحو اليمين: ليس سحب إغلاق
        if (Math.abs(my) > Math.abs(mx) || mx > 0) {
          start = null;
          return;
        }
        dragging = true;
        el.classList.add('settings__card--drag');
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // بلا التقاط: يكفي تتبع الحركة فوق اللوحة
        }
      }
      dx = Math.min(0, mx);
      el.style.transform = `translateX(${dx}px)`;
      e.preventDefault();
    };
    const onUp = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!dragging) {
        start = null;
        return;
      }
      const speed = -dx / Math.max(1, performance.now() - start.t);
      const close = -dx > el.offsetWidth * CLOSE_RATIO || speed > FLING_SPEED;
      suppressClick = true;
      el.classList.remove('settings__card--drag');
      if (close) {
        // تكمل الانزلاق من موضعها إلى الخارج بانتقال اللوحة المعتاد
        el.style.transform = '';
        closeRef.current();
      } else {
        el.style.transform = '';
      }
      start = null;
      dragging = false;
      dx = 0;
    };
    const onClick = (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('click', onClick, true);
    return () => {
      reset();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', reset);
      el.removeEventListener('click', onClick, true);
    };
  }, [open]);

  return ref;
}
