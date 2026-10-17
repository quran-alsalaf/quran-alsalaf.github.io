// حجم خط المصحف — تلقائي بحت، لا يتحكم به المستخدم (الفصل ٩)، وواحد لكل الصفحات.
//
// الصفحات مرسومة بخطوط صفحات المجمع (src/lib/qcfFonts.js): كل كلمة رمز مرسوم بيد الخطّاط
// بمدّاته، فيمتلئ السطر الكامل كما في المطبوع. وعرض أعرض سطر في كل صفحة متقارب
// (15.75–17.00em)، فحجمٌ يسع أعرض سطر في المصحف كله (qcf.widest) يسع كل صفحة،
// ولا يتغير الحجم من صفحة إلى صفحة. وعروض الأسطر محسوبة وقت البناء
// (scripts/data/05-qcf4.mjs)، فلا قياس هنا وقت العرض.

// ارتفاع السطر اللازم بوحدة em: يسع أعلى الحركات وأسفلها في خطوط الصفحات.
// قيس حبر كل سطرين متجاورين في المصحف (٨١٢٧ زوجًا) موضعًا موضعًا: عند ٢٫٠٥ تتقارب علامات
// ستة أزواج فقط، وعند ١٫٩ واحد وسبعون، وعند ١٫٨ ثلاثمئة وأربعة وثلاثون. فلا يُضيَّق دونه،
// وإن قصرت الشاشة صغر الخط وبقي هامش جانبي (عمود الصفحة ثابت النسبة).
export const LINE_EM = 2.05;

// هامش أمان ١٪ لاختلاف محرّكات النصوص في القياس (يصغّر الخط نحو خُمس بكسل، ولا يُرى)
const SAFETY = 0.99;

// السطر الذي لا يملأ العمود — كآخر سطر في السورة — يوسَّط وتتقارب كلماته ولا يُمطّ.
// أسطر الخطّاط الكاملة تملأ ٩٦٪ فأكثر من أعرض سطر في صفحتها، فما دون ٩٣٪ ناقص.
const SHORT_FILL = 0.93;

const sizes = new Map(); // "عرض|ارتفاع|تمرير" → { fontSize, width, pageHeight }
const shorts = new Map(); // صفحة → أرقام الأسطر الموسّطة

function shortLinesOf(quran, page) {
  let set = shorts.get(page);
  if (set) return set;
  const lines = quran.qcf.pages[page - 1];
  const max = Math.max(...lines.map((l) => (l ? l.w : 0)));
  set = new Set();
  lines.forEach((l, i) => {
    // الفاتحة وأول البقرة: أسطرها كلها موسّطة
    if (l && (page <= 2 || l.w < SHORT_FILL * max)) set.add(i);
  });
  shorts.set(page, set);
  return set;
}

// وضع التمرير (الجوال الأفقي، بقرار صاحب المشروع ٢٠٢٦-١٠-١٧): يملأ عرضُ الصفحة عرضَ الشاشة،
// ويُحسب الخط من العرض وحده — فتكون الصفحة أطول من الشاشة وتُمرَّر رأسيًّا — بدل أن يقيّده الارتفاع.
// وعدد الأسطر ١٥ وكسرها كما هما في المطبوع، فالتخطيط هو هو، لا يتغير إلا الحجم.
export function isScrollMode(box) {
  return !!box && box.w > box.h && box.h <= SCROLL_MAX_HEIGHT;
}

// أطول ارتفاع شاشة أفقيّ يُعدّ جوّالًا فيُمرَّر. وما فوقه (لوح) تتسع فيه الصفحة كاملة فيبقى سلوكه كما هو
const SCROLL_MAX_HEIGHT = 540;

// area: عرض منطقة الأسطر وارتفاعها بالبكسل. scroll: وضع التمرير أعلاه
export function pageLayout(quran, page, area, scroll = false) {
  const key = `${area.w}|${area.h}|${scroll ? 1 : 0}`;
  let size = sizes.get(key);
  if (!size) {
    const widest = quran.qcf.widest;
    const fitWidth = (area.w * SAFETY) / widest;
    const fitHeight = area.h / 15 / LINE_EM;
    const fontSize = Math.floor((scroll ? fitWidth : Math.min(fitWidth, fitHeight)) * 100) / 100;
    // حين يحكم الارتفاعُ لا العرضُ (كشاشة الجهاز اللوحي)، يضيق عمود الأسطر إلى عرضه الطبيعي
    // ويتوسط الشاشة كصفحة كتاب لها حواشٍ. وعلى الجوال يحكم العرض، فيبقى العمود بعرض الشاشة.
    const width = Math.min(area.w, Math.ceil((fontSize * widest) / SAFETY));
    size = { fontSize, width, pageHeight: Math.ceil(15 * LINE_EM * fontSize) };
    sizes.set(key, size);
  }
  return { ...size, shortLines: shortLinesOf(quran, page) };
}
