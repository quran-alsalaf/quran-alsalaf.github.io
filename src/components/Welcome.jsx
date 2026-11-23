import { useEffect, useRef, useState } from 'react';
import { SLIDES, clampSlide, shotUrl } from '../lib/welcome.js';
import { useLayer } from '../lib/layers.js';
import { toArabicDigits } from '../data/quran.js';
import './Welcome.css';

/*
  الشاشة الترحيبية «دليل التطبيق» (٢٠٢٦-١١-٢٣، بقرار صاحب المشروع) — المنطق والنصوص في src/lib/welcome.js.
  • نسخة الجوال: تملأ الشاشة، وفي أعلاها «تخطٍّ»، ثم لقطة الشريحة في إطار جوال، ثم العنوان والشرح، ثم نقاط
    الترقيم، ثم «رجوع» و«التالي» (و«ابدأ» في الأخيرة).
  • نسخة اللابتوب (عرض الصفحتين): نافذة في وسط الشاشة والتطبيق معتم خلفها، ولقطاتها بعرض الصفحتين.
  • التقليب: بالأزرار، والنقاط، والسحب (التالية من اليسار كتقليب المصحف: السحب نحو اليمين يأتي بها)، وأسهم
    لوحة المفاتيح (السهم الأيسر للتالية).
  • زرّ الرجوع في أندرويد وEsc: إلى الشريحة السابقة، ومن الأولى يُغلق الدليل.
  • اللقطة بحسب نوع خلفية القراءة (فاتحة أو داكنة).
*/

const SWIPE_MIN = 50; // px
const FLING_SPEED = 0.4; // px/ms

export default function Welcome({ laptop, onDone }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const last = index === SLIDES.length - 1;
  const base = import.meta.env.BASE_URL;

  const go = (i) => setIndex(clampSlide(i));
  const next = () => (last ? onDone() : go(index + 1));
  const prev = () => go(index - 1);

  // زرّ الرجوع وEsc: السابقة، ومن الأولى يُغلق
  useLayer(() => (index > 0 ? go(index - 1) : onDone()));

  // أسهم لوحة المفاتيح (من اليمين إلى اليسار: الأيسر للتالية)
  const keys = useRef();
  keys.current = { next, prev };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') keys.current.next();
      else if (e.key === 'ArrowRight') keys.current.prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // التركيز داخل الدليل عند الفتح (لقارئ الشاشة ولوحة المفاتيح؛ Tab يبدأ من أزراره)، بلا إطار تركيز ظاهر
  const card = useRef(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, []);

  // السحب بالإصبع أو الفأرة: تتبع الشرائح اليد، ثم تنتقل إن جاوز حدًّا أو كان سريعًا
  const start = useRef(null);
  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest?.('button')) return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, active: false };
  };
  const onPointerMove = (e) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    if (!s.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(e.clientY - s.y) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      s.active = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // بلا التقاط: يكفي تتبع الحركة فوق الشرائح
      }
    }
    // مقاومة عند الطرفين
    const edge = (dx > 0 && last) || (dx < 0 && index === 0);
    setDrag(edge ? dx / 3 : dx);
  };
  const onPointerUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s || e.pointerId !== s.id || !s.active) return;
    const dx = e.clientX - s.x;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    setDrag(0);
    if (Math.abs(dx) < SWIPE_MIN && speed < FLING_SPEED) return;
    if (dx > 0) go(index + 1);
    else go(index - 1);
  };
  const onPointerCancel = () => {
    start.current = null;
    setDrag(0);
  };

  const n = SLIDES.length;
  return (
    <div className={`welcome${laptop ? ' welcome--laptop' : ''}`} role="dialog" aria-modal="true" aria-label="دليل التطبيق">
      <div className="welcome__backdrop" />
      <div ref={card} className="welcome__card" tabIndex={-1}>
        <header className="welcome__head">
          <span className="welcome__count" aria-hidden="true">
            {toArabicDigits(index + 1)} / {toArabicDigits(n)}
          </span>
          {!last && (
            <button type="button" className="welcome__skip" onClick={onDone}>
              تخطٍّ
            </button>
          )}
        </header>

        <div
          className="welcome__viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div
            className={`welcome__track${drag ? ' welcome__track--drag' : ''}`}
            style={{ transform: `translateX(calc(${index * 100}% + ${drag}px))` }}
          >
            {SLIDES.map((s, i) => (
              <section
                key={s.id}
                className="welcome__slide"
                data-slide={s.id}
                aria-hidden={i !== index}
                inert={i !== index ? '' : undefined}
                aria-roledescription="شريحة"
                aria-label={`${toArabicDigits(i + 1)} من ${toArabicDigits(n)}`}
              >
                <div className="welcome__media">
                  {s.shot ? (
                    <img
                      className={`welcome__shot${laptop ? ' welcome__shot--laptop' : ''}`}
                      src={shotUrl(s.id, laptop, theme, base)}
                      alt=""
                      draggable="false"
                      decoding="async"
                    />
                  ) : (
                    <img className="welcome__logo" src={`${base}icons/icon-192.png`} alt="" draggable="false" />
                  )}
                </div>
                <div className="welcome__text">
                  <h2 className="welcome__title">{s.title}</h2>
                  <p className="welcome__desc">{s.text}</p>
                  {s.note && <p className="welcome__note">{s.note}</p>}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="welcome__dots" role="group" aria-label="الشرائح">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="welcome__dot"
              aria-label={`الشريحة ${toArabicDigits(i + 1)}: ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <footer className="welcome__nav">
          <button type="button" className="welcome__btn welcome__btn--ghost" onClick={prev} disabled={index === 0}>
            رجوع
          </button>
          <button type="button" className="welcome__btn welcome__btn--primary" onClick={next}>
            {last ? 'ابدأ' : 'التالي'}
          </button>
        </footer>
      </div>
    </div>
  );
}
