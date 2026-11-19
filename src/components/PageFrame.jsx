// إطار الصفحة المزخرف (٢٠٢٦-١١-١٩، «شكل الصفحة: مزخرفة» — src/lib/pageStyle.js): رسم أصلي بخطوط SVG، لا منقول
// من مطبوع المجمع. حدّ من الجهات الأربع: خطّان (خارجي وداخلي) بينهما شريط بتعبئة خفيفة وزخرفة متكررة، وفي
// الزوايا زخرفة. وكل ألوانه من لون التطبيق (--frame و--frame-fill و--frame-deep في MushafPage.css)، فيتبدّل معه.
//
// تتوزع الزخرفة المتكررة على طول كل حافة بعدد صحيح يملؤها تمامًا (تتمدد قليلًا أو تنكمش)، فلا تُقطع وحدة عند
// الزاوية. والمقاسات بالبكسل من w وh (الإطار كله) لا بالنسبة، فلا تتشوّه الزخرفة في الشاشات المختلفة.
import { useId } from 'react';
import './PageFrame.css';

// النماذج المعروضة على صاحب المشروع ليختار منها (يبقى واحد بعد الاختيار).
// T عرض الشريط، C ضلع زخرفة الزاوية، L طول وحدة الزخرفة المتكررة
export const FRAME_DESIGNS = {
  a: { T: 7, C: 9, L: 9 },
  b: { T: 10, C: 13, L: 11 },
  c: { T: 11, C: 14, L: 18 },
  d: { T: 11, C: 14, L: 14 },
};
// المسافة بين الإطار والنص
export const FRAME_GAP = 3;
// هامش الورقة الجانبي مع الإطار: يبدأ الإطار عند حافة الشاشة تقريبًا (بدل هامش الصفحة البسيطة PAD_X في Reader.jsx)
export const FRAME_EDGE = 1;

export function frameDesign() {
  try {
    const d = localStorage.getItem('hq.frameDesign');
    return FRAME_DESIGNS[d] ? d : 'b';
  } catch {
    return 'b';
  }
}

// ما يأخذه الإطار من كل جانب (الشريط والمسافة بعده)
export const frameInset = (design = frameDesign()) => FRAME_DESIGNS[design].T + FRAME_GAP;

// ---------- وحدات الزخرفة: مرسومة حول (٠،٠)، على طول x، والشريط من -T/2 إلى T/2 على y ----------
function Motif({ d }) {
  const { T, L } = FRAME_DESIGNS[d];
  const h = T / 2;
  if (d === 'a') return <circle className="pf-deep" r={0.85} />;
  if (d === 'b')
    return (
      <>
        <path className="pf-tile" d={`M${-L / 2 + 0.6} 0L0 ${-h + 1.6}L${L / 2 - 0.6} 0L0 ${h - 1.6}Z`} />
        <circle className="pf-deep" r={0.9} />
      </>
    );
  if (d === 'c') {
    const a = h - 2.2;
    return (
      <>
        <path className="pf-vine" d={`M${-L / 2} 0C${-L / 3} ${-a} ${-L / 6} ${-a} 0 0C${L / 6} ${a} ${L / 3} ${a} ${L / 2} 0`} />
        <ellipse className="pf-leaf" cx={-L / 4} cy={-a + 0.4} rx={1.9} ry={0.9} transform={`rotate(-18 ${-L / 4} ${-a + 0.4})`} />
        <ellipse className="pf-leaf" cx={L / 4} cy={a - 0.4} rx={1.9} ry={0.9} transform={`rotate(-18 ${L / 4} ${a - 0.4})`} />
      </>
    );
  }
  // d: نجمة ثمانية صغيرة، وبين النجمتين نقطة
  return (
    <>
      <Star r={h - 1.4} className="pf-tile" />
      <circle className="pf-deep" cx={L / 2} r={0.75} />
    </>
  );
}

// نجمة ثمانية: مربعان متراكبان
function Star({ r, className }) {
  const s = r * 0.74;
  return (
    <>
      <rect className={className} x={-s} y={-s} width={s * 2} height={s * 2} />
      <rect className={className} x={-s} y={-s} width={s * 2} height={s * 2} transform="rotate(45)" />
    </>
  );
}

function Corner({ d }) {
  const { C } = FRAME_DESIGNS[d];
  const r = C / 2;
  const back = <rect className="pf-back" x={-r} y={-r} width={C} height={C} />;
  if (d === 'a')
    return (
      <>
        {back}
        <rect className="pf-tile" x={-r + 1} y={-r + 1} width={C - 2} height={C - 2} />
        <path className="pf-solid" d={`M0 ${-r + 2.6}L${r - 2.6} 0L0 ${r - 2.6}L${-r + 2.6} 0Z`} />
      </>
    );
  if (d === 'b')
    return (
      <>
        {back}
        <Star r={r - 0.6} className="pf-tile" />
        <circle className="pf-solid" r={r * 0.32} />
      </>
    );
  if (d === 'c')
    return (
      <>
        {back}
        <circle className="pf-tile" r={r - 0.8} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} className="pf-leaf" cx={0} cy={-(r * 0.48)} rx={1.25} ry={r * 0.36} transform={`rotate(${a})`} />
        ))}
        <circle className="pf-back pf-ring" r={r * 0.2} />
      </>
    );
  return (
    <>
      {back}
      <path
        className="pf-tile"
        d={Array.from({ length: 8 }, (_, i) => {
          const a = ((i * 45 + 22.5) * Math.PI) / 180;
          return `${i ? 'L' : 'M'}${(Math.cos(a) * (r - 0.7)).toFixed(2)} ${(Math.sin(a) * (r - 0.7)).toFixed(2)}`;
        }).join('') + 'Z'}
      />
      <Star r={r * 0.62} className="pf-solid" />
      <circle className="pf-back" r={r * 0.2} />
    </>
  );
}

// مواضع الوحدات على حافة طولها len بين زاويتين: عدد صحيح يملؤها
function spots(len, L) {
  const n = Math.max(1, Math.round(len / L));
  const step = len / n;
  return { n, step };
}

export default function PageFrame({ w, h, design = frameDesign() }) {
  const id = useId().replace(/:/g, '');
  const { T, C, L } = FRAME_DESIGNS[design];
  if (!w || !h) return null;
  const half = T / 2;
  const top = spots(w - 2 * C, L);
  const side = spots(h - 2 * C, L);
  const uses = [];
  for (let i = 0; i < top.n; i++) {
    const x = C + top.step * (i + 0.5);
    const k = (top.step / L).toFixed(4);
    uses.push(<use key={`t${i}`} href={`#m${id}`} transform={`translate(${x} ${half}) scale(${k} 1)`} />);
    uses.push(<use key={`b${i}`} href={`#m${id}`} transform={`translate(${x} ${h - half}) scale(${k} -1)`} />);
  }
  for (let i = 0; i < side.n; i++) {
    const y = C + side.step * (i + 0.5);
    const k = (side.step / L).toFixed(4);
    uses.push(<use key={`r${i}`} href={`#m${id}`} transform={`translate(${w - half} ${y}) rotate(90) scale(${k} 1)`} />);
    uses.push(<use key={`l${i}`} href={`#m${id}`} transform={`translate(${half} ${y}) rotate(90) scale(${k} -1)`} />);
  }
  return (
    <svg className={`page-frame page-frame--${design}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <g id={`m${id}`}>
          <Motif d={design} />
        </g>
        <g id={`c${id}`}>
          <Corner d={design} />
        </g>
      </defs>
      {/* الشريط بتعبئته، ثم خطّاه */}
      <path className="pf-band" fillRule="evenodd" d={`M0 0H${w}V${h}H0Z M${T} ${T}V${h - T}H${w - T}V${T}Z`} />
      <rect className="pf-line pf-line--out" x={0.6} y={0.6} width={w - 1.2} height={h - 1.2} />
      <rect className="pf-line pf-line--in" x={T} y={T} width={w - 2 * T} height={h - 2 * T} />
      {uses}
      {[
        [C / 2, C / 2],
        [w - C / 2, C / 2],
        [C / 2, h - C / 2],
        [w - C / 2, h - C / 2],
      ].map(([x, y]) => (
        <use key={`${x}-${y}`} href={`#c${id}`} transform={`translate(${x} ${y})`} />
      ))}
    </svg>
  );
}
