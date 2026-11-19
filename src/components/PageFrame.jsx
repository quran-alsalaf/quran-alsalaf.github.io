// إطار الصفحة المزخرف (٢٠٢٦-١١-١٩، «شكل الصفحة: مزخرفة» — src/lib/pageStyle.js): على طراز إطارات المصاحف المطبوعة
// (بطلب صاحب المشروع)، رسمًا أصليًّا بـ SVG لا منقولًا من مطبوع بعينه:
//   • حدّ خارجي وداخلي، كلٌّ خطّان (غليظ ورفيع)
//   • بينهما شريط بتعبئة خفيفة، فيه غصن متموّج تتدلّى منه أوراق ثلاثية وزهور خماسية متناوبة
//   • في كل زاوية مربّع بوردة ثمانية، وفي وسط كل جانب شمسة (لوزة) بزهرة
// وكل ألوانه من لون التطبيق (--frame و--frame-fill و--frame-tile في PageFrame.css)، فيتبدّل معه.
//
// تتوزع وحدات الغصن على كل حافة بعدد صحيح يملؤها تمامًا (تتمدد قليلًا أو تنكمش)، فلا تُقطع وحدة عند الزاوية ولا
// عند الشمسة. والمقاسات بالبكسل من w وh لا بالنسبة، فلا تتشوّه الزخرفة في الشاشات المختلفة.
import { useId } from 'react';
import { readFrameDesign } from '../lib/pageStyle.js';
import './PageFrame.css';

// المرسوم بمقاس شريط عرضه ١٢ (REF)، ويُصغَّر كله بنسبة T/REF
const REF = 12;
// النموذجان (مؤقت حتى يختار صاحب المشروع): T عرض الشريط
export const FRAME_DESIGNS = {
  a: { T: 12 },
  b: { T: 9 },
};
// المسافة بين الإطار والنص
export const FRAME_GAP = 3;
// هامش الورقة الجانبي مع الإطار: يبدأ الإطار عند حافة الشاشة تقريبًا (بدل هامش الصفحة البسيطة PAD_X في Reader.jsx)
export const FRAME_EDGE = 1;

export const frameDesign = readFrameDesign;

// ما يأخذه الإطار من كل جانب (الشريط والمسافة بعده)
export const frameInset = (design = frameDesign()) => FRAME_DESIGNS[design].T + FRAME_GAP;

// ---------- المرسوم بمقاس REF: حول (٠،٠)، على طول x، والشريط من -٦ إلى ٦ على y ----------
const L = 24; // طول وحدة الغصن: موجة كاملة
const MED = 52; // طول الشمسة في وسط الجانب
const C = 13; // ضلع مربع الزاوية

// ورقة: قطع ناقص مدبّب الطرفين، طولها len باتجاه الزاوية a (درجات) من نقطة الأصل
function Leaf({ x, y, len, wid, a }) {
  return (
    <path
      className="pf-solid"
      transform={`translate(${x} ${y}) rotate(${a})`}
      d={`M0 0Q${wid} ${len * 0.45} 0 ${len}Q${-wid} ${len * 0.45} 0 0Z`}
    />
  );
}

// زهرة خماسية صغيرة
function Flower({ x, y, r }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} className="pf-tile" cx={0} cy={-r * 0.62} rx={r * 0.42} ry={r * 0.55} transform={`rotate(${a})`} />
      ))}
      <circle className="pf-solid" r={r * 0.32} />
    </g>
  );
}

// وحدة الغصن: موجة، تحت قمّتها ورقة ثلاثية متدلّية، وفوق قاعها زهرة
function Motif() {
  return (
    <>
      <path className="pf-vine" d="M-12 0C-8 -3.9 -4 -3.9 0 0C4 3.9 8 3.9 12 0" />
      <Leaf x={-6} y={-2.9} len={4.6} wid={1.5} a={0} />
      <Leaf x={-6} y={-2.9} len={3.4} wid={1.1} a={52} />
      <Leaf x={-6} y={-2.9} len={3.4} wid={1.1} a={-52} />
      <Flower x={6} y={-0.2} r={2.5} />
    </>
  );
}

// مربع الزاوية بوردة ثمانية
function Corner() {
  const r = C / 2;
  return (
    <>
      <rect className="pf-back" x={-r} y={-r} width={C} height={C} />
      <rect className="pf-tile pf-edge" x={-r + 0.7} y={-r + 0.7} width={C - 1.4} height={C - 1.4} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse key={a} className="pf-solid" cx={0} cy={-r * 0.5} rx={0.95} ry={r * 0.36} transform={`rotate(${a})`} />
      ))}
      <circle className="pf-back pf-edge" r={r * 0.24} />
    </>
  );
}

// الشمسة في وسط الجانب: لوزة بتعبئة، فيها زهرة وورقتان
function Medallion() {
  const m = MED / 2;
  return (
    <>
      <path className="pf-back" d={`M${-m} 0C${-m * 0.55} -6.6 ${m * 0.55} -6.6 ${m} 0C${m * 0.55} 6.6 ${-m * 0.55} 6.6 ${-m} 0Z`} />
      <path className="pf-tile pf-edge" d={`M${-m + 1.5} 0C${-m * 0.5} -5.4 ${m * 0.5} -5.4 ${m - 1.5} 0C${m * 0.5} 5.4 ${-m * 0.5} 5.4 ${-m + 1.5} 0Z`} />
      <Leaf x={-3.6} y={0} len={7} wid={1.6} a={90} />
      <Leaf x={3.6} y={0} len={7} wid={1.6} a={-90} />
      <Flower x={0} y={0} r={3} />
    </>
  );
}

// مواضع وحدات الغصن على قطعة طولها len: عدد صحيح يملؤها
function spots(len) {
  const n = Math.max(1, Math.round(len / L));
  return { n, step: len / n };
}

export default function PageFrame({ w, h, design = frameDesign() }) {
  const id = useId().replace(/:/g, '');
  const { T } = FRAME_DESIGNS[design];
  if (!w || !h) return null;
  const s = T / REF;
  // الطول بمقاس REF (تُرسم كلها هناك ثم تُصغَّر)
  const W = w / s;
  const H = h / s;
  const uses = [];
  // حافة من a إلى b على محور الحافة، تقطعها الشمسة في وسطها
  const run = (key, a, b, place) => {
    const mid = (a + b) / 2;
    for (const [x0, x1, part] of [
      [a, mid - MED / 2, 'a'],
      [mid + MED / 2, b, 'b'],
    ]) {
      const { n, step } = spots(x1 - x0);
      for (let i = 0; i < n; i++) uses.push(place(`${key}${part}${i}`, x0 + step * (i + 0.5), step / L, 'm'));
    }
    uses.push(place(`${key}med`, mid, 1, 'd'));
  };
  const at = (key, ref, transform) => <use key={key} href={`#${ref}${id}`} transform={transform} />;
  run('t', C, W - C, (k, x, kx, r) => at(k, r, `translate(${x} 6) scale(${kx} 1)`));
  run('b', C, W - C, (k, x, kx, r) => at(k, r, `translate(${x} ${H - 6}) scale(${kx} -1)`));
  run('r', C, H - C, (k, y, kx, r) => at(k, r, `translate(${W - 6} ${y}) rotate(90) scale(${kx} 1)`));
  run('l', C, H - C, (k, y, kx, r) => at(k, r, `translate(6 ${y}) rotate(90) scale(${kx} -1)`));
  const rules = [
    // [موضع من الحافة، سُمك]: الخارجي غليظ ثم رفيع، والداخلي رفيع ثم غليظ
    [0.75, 1.5, 'out'],
    [2.5, 0.55, 'thin'],
    [REF - 2.5, 0.55, 'thin'],
    [REF - 0.75, 1.2, 'in'],
  ];
  return (
    <svg className={`page-frame page-frame--${design}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <g id={`m${id}`}>
          <Motif />
        </g>
        <g id={`c${id}`}>
          <Corner />
        </g>
        <g id={`d${id}`}>
          <Medallion />
        </g>
      </defs>
      <g transform={`scale(${s})`}>
        {/* الشريط بتعبئته، ثم خطوطه الأربعة */}
        <path className="pf-band" fillRule="evenodd" d={`M0 0H${W}V${H}H0Z M${REF} ${REF}V${H - REF}H${W - REF}V${REF}Z`} />
        {rules.map(([p, sw, k]) => (
          <rect key={p} className={`pf-line pf-line--${k}`} x={p} y={p} width={W - 2 * p} height={H - 2 * p} strokeWidth={sw} />
        ))}
        {uses}
        {[
          [C / 2, C / 2],
          [W - C / 2, C / 2],
          [C / 2, H - C / 2],
          [W - C / 2, H - C / 2],
        ].map(([x, y]) => (
          <use key={`${x}-${y}`} href={`#c${id}`} transform={`translate(${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}
