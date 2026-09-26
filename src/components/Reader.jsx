import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import MushafPage from './MushafPage.jsx';
import { pageInfo, toArabicDigits } from '../data/quran.js';
import { SURA_NAMES_VOWELED } from '../data/suraNamesVoweled.js';
import { pageLayout } from '../lib/layout.js';
import { prefetchPageFonts, usePageFont } from '../lib/qcfFonts.js';
import { FIRST_PAGE, LAST_PAGE, readLastPage, saveLastPage } from '../lib/position.js';
import './Reader.css';

/*
  قارئ المصحف: صفحة واحدة تملأ الشاشة، والتنقل بالسحب وحده (الفصل ٢).

  الاتجاه كالمصحف الورقي (بقرار صاحب المشروع): الصفحة التالية تقع على يسار
  الحالية، فللتقدّم يُحرَّك الإصبع من اليسار نحو اليمين فتدخل التالية من اليسار.
  وبالعكس للسابقة.

  تُرسم ثلاث صفحات متجاورة (السابقة والحالية والتالية) على شريط واحد يتحرك مع
  الإصبع، فتظهر الصفحة المجاورة أثناء السحب لا بعده. والشريط يُحرَّك مباشرة
  في DOM لا عبر حالة React، لتبقى الحركة سلسة ٦٠ إطارًا في الثانية.
*/

const TURN_RATIO = 0.22; // نسبة عرض الشاشة التي يكفي السحب إليها لقلب الصفحة
const FLICK_SPEED = 0.45; // بكسل/مللي ثانية: سحبة سريعة قصيرة تكفي لقلب الصفحة
const FLICK_MIN_PX = 48; // ولا تُعدّ نفضةً ما قصرت عن هذا، مهما كانت سرعتها
const VELOCITY_WINDOW_MS = 100; // تُحسب السرعة على آخر هذه المدّة من السحب
const TURN_MS = 280;
const EDGE_RESISTANCE = 0.25; // عند أول المصحف وآخره تتحرك الصفحة ربع حركة الإصبع

// أجزاء ورقة الصفحة: الترويسة (وفيها رقم الصفحة)، ثم الأسطر. والهامش الجانبي يسير جدًّا
// ليملأ المصحف الشاشة (بطلب صاحب المشروع)
const META_H = 30;
// اسم الجزء في الترويسة برقمه لا بلفظه (بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٤)
const juzLabel = (j) => `الجزء ${toArabicDigits(j)}`;
// الترويسة بلا تشكيل (بطلب صاحب المشروع)
const stripTashkeel = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
const PAD_X = 3;

// لمسة خفيفة (بلا سحب) تُظهر الخانتين السفليتين أو تخفيهما: أقصر من هذه المدّة
const TAP_MS = 350;

// الضغط المطوّل على آية (الفصل ٤): إبقاء الإصبع عليها بلا حركة هذه المدة
const LONG_PRESS_MS = 450;

// onColumn: يُبلَّغ به عرض عمود الأسطر، ليُحاذى به الشريط العلوي فوقه
// onPage: يُبلَّغ بالصفحة الحالية (نطاق الصفحات السفلية)
// onVDrag / onVDragEnd: السحب الرأسي أثناءه وعند رفع الإصبع (المسافة، والمدة) — به تصعد
// الصفحات السفلية مع الإصبع (الفصل ٥)
// onLongPress(آية، مستطيل كلمتها): ضغط مطوّل على آية
// goto { page, n }: انتقال إلى صفحة بطلب من خارج القارئ (كاختيار آية من قائمة النطاق)
// marks: إشارات بيانات المستخدم على الآيات (MushafPage)
export default function Reader({ quran, onTap, onColumn, onPage, onVDrag, onVDragEnd, onLongPress, goto, marks }) {
  const [page, setPage] = useState(readLastPage);
  const [box, setBox] = useState(null);

  useEffect(() => {
    if (goto?.page) setPage(goto.page);
  }, [goto]);

  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const drag = useRef(null);
  const offset = useRef(0);
  const pendingDir = useRef(0);
  const animating = useRef(false);
  // إن لم يصل حدث انتهاء الحركة (كأن تُخفى النافذة أثناءها) أُتمّت بعد مدّتها،
  // لئلا تبقى الصفحة معلّقة في منتصف القلب
  const fallback = useRef(0);

  useLayoutEffect(() => {
    const el = viewRef.current;
    // القياس الأول فوري من التخطيط نفسه، فتُرسم الصفحة في أول إطار بعد شاشة الافتتاح.
    // ولا يُكتفى بمراقب الحجم، لأنه لا يُبلّغ إلا مع رسم الإطارات. ثم يتابع المراقب أي تغيّر
    // (كتدوير الجهاز أو ظهور شريط المتصفح)، ولا يعيد الرسم إن لم يتغيّر الحجم فعلًا.
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setBox({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    saveLastPage(page);
    onPage?.(page);
  }, [page, onPage]);
  // الصفحتان المجاورتان تُرسمان على الشريط فيُنزَّل خطّاهما معهما، ويُنزَّل ما بعدهما مسبقًا
  useEffect(() => prefetchPageFonts([page + 2, page - 2]), [page]);
  useEffect(() => () => clearTimeout(fallback.current), []);

  const moveTrack = useCallback((x, animate) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${TURN_MS}ms cubic-bezier(0.2, 0.8, 0.25, 1)` : 'none';
    el.style.transform = `translate3d(${x}px, 0, 0)`;
    offset.current = x;
  }, []);

  // بعد تبدّل الصفحة يعود الشريط إلى موضعه قبل أن يُرسم الإطار التالي،
  // فتحلّ الصفحة الجديدة محلّ المجاورة بلا وميض
  useLayoutEffect(() => moveTrack(0, false), [page, box, moveTrack]);

  const canTurn = (dir) => (dir > 0 ? page < LAST_PAGE : page > FIRST_PAGE);

  // dir: ‎+1 التالية (الشريط يتحرك يمينًا)، ‎-1 السابقة، ‎0 العودة إلى الموضع
  const settle = useCallback(
    (dir) => {
      if (!box) return;
      const d = dir && canTurn(dir) ? dir : 0;
      pendingDir.current = d;
      const target = d * box.w;
      if (Math.abs(target - offset.current) < 0.5) {
        finish();
        return;
      }
      animating.current = true;
      moveTrack(target, true);
      clearTimeout(fallback.current);
      fallback.current = setTimeout(finish, TURN_MS + 120);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [box, page, moveTrack]
  );

  // تُستدعى مرة عند انتهاء الحركة، وقد تُستدعى ثانية من المؤقت الاحتياطي فلا تفعل شيئًا
  function finish() {
    clearTimeout(fallback.current);
    animating.current = false;
    const d = pendingDir.current;
    pendingDir.current = 0;
    if (d) setPage((p) => p + d);
  }

  const onTransitionEnd = (e) => {
    if (e.target === trackRef.current && e.propertyName === 'transform') finish();
  };

  // لمسة أثناء حركة القلب: تُتمّ القلبة الجارية فورًا بدل أن تُتجاهل اللمسة.
  // فحركة القلب سريعة أولها بطيء آخرها، فتبدو الصفحة قد وصلت وهي تُكمل ذيلها، فكان
  // السحب الثاني يضيع فيه. والآن تُرسم الصفحة الجديدة في مكانها قبل أن يتحرك الإصبع
  // (flushSync)، فيبدأ السحب الجديد منها مباشرة، ويُقلَّب المصحف متتابعًا بلا انتظار.
  function completeNow() {
    clearTimeout(fallback.current);
    animating.current = false;
    const d = pendingDir.current;
    pendingDir.current = 0;
    if (d) flushSync(() => setPage((p) => p + d));
    else moveTrack(0, false); // كانت عودةً إلى الموضع (سحبة لم تكتمل): تتوقف
  }

  // ---------- السحب ----------
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (animating.current) completeNow();
    const d = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: e.timeStamp, axis: null, samples: [{ x: e.clientX, t: e.timeStamp }] };
    drag.current = d;
    // ضغط مطوّل على كلمة من آية: يُبدأ عدّه، ويُلغى إن تحرك الإصبع أو رُفع قبله
    const word = e.target.closest?.('.w[data-v]');
    if (word && onLongPress) {
      d.press = setTimeout(() => {
        if (drag.current !== d || d.axis) return;
        d.longPressed = true;
        onLongPress(+word.dataset.v, word.getBoundingClientRect());
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (d.longPressed) return;
      clearTimeout(d.press);
      d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (d.axis) {
        try {
          viewRef.current.setPointerCapture(e.pointerId);
        } catch {
          // بعض المتصفحات ترفض الالتقاط لمؤشر انتهى — لا يلزم للسحب
        }
      }
    }
    if (d.axis === 'y') {
      onVDrag?.(my);
      return;
    }
    if (d.axis !== 'x') return;

    // السرعة تُحسب على آخر ١٠٠ مللي ثانية لا بين حدثين متتاليين: فالأحداث المتلاصقة
    // (١٢٠ حدثًا في الثانية على بعض الشاشات) تجعل السرعة اللحظية تقفز، فتبدو حركة
    // بطيئة قصيرة نفضةً وتُقلب بها الصفحة خطأً
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > VELOCITY_WINDOW_MS) d.samples.shift();

    const blocked = !canTurn(mx > 0 ? 1 : -1);
    moveTrack(blocked ? mx * EDGE_RESISTANCE : mx, false);
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    clearTimeout(d.press);
    if (d.longPressed) return;
    // لم يتحرك الإصبع (أقل من ٨ بكسل) ورُفع سريعًا: لمسة لا سحبة
    if (!d.axis && e.type === 'pointerup' && e.timeStamp - d.t0 < TAP_MS) {
      onTap?.();
      return;
    }
    if (d.axis === 'y') {
      onVDragEnd?.(e.type === 'pointerup' ? e.clientY - d.y : 0, e.timeStamp - d.t0);
      return;
    }
    if (d.axis !== 'x') return;
    const mx = e.clientX - d.x;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const span = last.t - first.t;
    const v = span >= 16 ? (last.x - first.x) / span : 0;
    const flick = Math.abs(mx) >= FLICK_MIN_PX && Math.abs(v) > FLICK_SPEED && Math.sign(v) === Math.sign(mx);
    let dir = 0;
    if (mx > box.w * TURN_RATIO || (flick && mx > 0)) dir = 1;
    else if (mx < -box.w * TURN_RATIO || (flick && mx < 0)) dir = -1;
    settle(dir);
  };

  // ---------- لوحة المفاتيح (للحاسوب): السهم الأيسر للتالية كموضعها ----------
  useEffect(() => {
    const onKey = (e) => {
      if (animating.current || drag.current) return;
      if (e.key === 'ArrowLeft') settle(1);
      else if (e.key === 'ArrowRight') settle(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settle]);

  const area = box && { w: box.w - PAD_X * 2, h: box.h - META_H };
  // عرض العمود واحد لكل الصفحات (حجم الخط واحد)، فيكفي أخذه من الصفحة الحالية
  const column = area ? pageLayout(quran, page, area).width : 0;
  useEffect(() => {
    if (column) onColumn?.(column);
  }, [column, onColumn]);
  const slots = [page + 1, page, page - 1].filter((p) => p >= FIRST_PAGE && p <= LAST_PAGE);

  return (
    <div
      ref={viewRef}
      className="reader"
      style={{ '--meta-h': `${META_H}px`, '--pad-x': `${PAD_X}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {area && (
        <div ref={trackRef} className="reader__track" onTransitionEnd={onTransitionEnd}>
          {slots.map((p) => (
            <Sheet
              key={p}
              quran={quran}
              page={p}
              layout={pageLayout(quran, p, area)}
              shift={page - p}
              current={p === page}
              marks={marks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ورقة الصفحة: الترويسة فوق الأسطر — الجزء يمينًا، ورقم الصفحة في الوسط، والسورة يسارًا.
// والترويسة جزء من الورقة، فتتحرك معها عند السحب.
function Sheet({ quran, page, layout, shift, current, marks }) {
  const { sura, juz } = pageInfo(quran, page);
  const font = usePageFont(page);
  return (
    <section
      className="sheet"
      style={{ transform: `translate3d(${shift * 100}%, 0, 0)` }}
      aria-hidden={!current}
      aria-label={`الصفحة ${toArabicDigits(page)}`}
    >
      {/* بعرض عمود الأسطر نفسه: الجزء عند حافة الآيات اليمنى، والسورة عند حافتها اليسرى */}
      <header className="sheet__meta" style={{ width: `${layout.width}px` }}>
        <span className="sheet__juz">{juzLabel(juz)}</span>
        <span className="sheet__num">
          <span>{toArabicDigits(page)}</span>
          <PageSideIcon right={page % 2 === 1} />
        </span>
        <span className="sheet__sura">{stripTashkeel(SURA_NAMES_VOWELED[sura.n - 1])}</span>
      </header>
      {/* لا تُرسم الصفحة قبل وصول خطها، وإلا ظهرت رموز كلماتها حروفًا مبعثرة بخط آخر */}
      {font === 'ready' ? (
        <MushafPage
          quran={quran}
          page={page}
          fontSize={layout.fontSize}
          width={layout.width}
          shortLines={layout.shortLines}
          marks={marks}
        />
      ) : (
        <div className="mushaf-page mushaf-page--pending" style={{ width: `${layout.width}px` }}>
          {font === 'failed' && 'تُنزَّل هذه الصفحة عند أول فتح لها، وتحتاج لذلك اتصالًا بالإنترنت. وتعمل بعدها بلا اتصال.'}
        </div>
      )}
    </section>
  );
}

// مصحف مفتوح صغير يُظهر موضع الصفحة منه: في مصحف المدينة الفردية يمنى
// (الفاتحة يمنى) والزوجية يسرى. فالجهة الحالية مشرّبة بلون التمييز وأسطرها بلونه،
// والأخرى خافتة — تمييز هادئ لا لون صارخ.
const PAGE_LEFT = 'M16 5.2C12.6 2.9 7.6 2.4 3 3.4v11.8c4.6-1 9.6-.5 13 1.8Z';
const PAGE_RIGHT = 'M16 5.2c3.4-2.3 8.4-2.8 13-1.8v11.8c-4.6-1-9.6-.5-13 1.8Z';
const LINES_LEFT = 'M5.6 6.7c2.6-.5 5.3-.3 7.9.8M5.6 9.3c2.6-.5 5.3-.3 7.9.8M5.6 11.9c2.6-.5 5.3-.3 7.9.8';
const LINES_RIGHT = 'M26.4 6.7c-2.6-.5-5.3-.3-7.9.8M26.4 9.3c-2.6-.5-5.3-.3-7.9.8M26.4 11.9c-2.6-.5-5.3-.3-7.9.8';

function PageSideIcon({ right }) {
  const side = (isCurrent) => (isCurrent ? 'page-side__page page-side__page--on' : 'page-side__page');
  return (
    <svg
      className="page-side"
      viewBox="0 1.6 32 16.2"
      role="img"
      aria-label={right ? 'الصفحة اليمنى' : 'الصفحة اليسرى'}
    >
      <g className={side(!right)}>
        <path className="page-side__sheet" d={PAGE_LEFT} />
        <path className="page-side__lines" d={LINES_LEFT} />
      </g>
      <g className={side(right)}>
        <path className="page-side__sheet" d={PAGE_RIGHT} />
        <path className="page-side__lines" d={LINES_RIGHT} />
      </g>
      {/* كعب المصحف */}
      <path className="page-side__spine" d="M16 5.2v11.8" />
    </svg>
  );
}
