// محتوى صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): يحوّل محتوى بطاقة الآية (تفسير · معاني · عمل · فوائد)
// إلى مواصفة الصور (src/lib/shareLayout.js) بالشكل الذي يُعرض به في التطبيق: الآيات المقتبسة ﴿…﴾ والكلمات الملوّنة
// في الفوائد بلون التطبيق، والبنود بنقطة، والتوجيه الدعوي بخطّ في أوله، والمصدر بخط أصغر.
import { emphasisParts } from './fawaid.js';
import { AYAT, countText } from './count.js';
import { SIZES } from './shareLayout.js';
import { paragraphs, verseLabel, verseText } from './study.js';

// نصّ فيه اقتباسات ﴿…﴾ ⇐ أجزاء: المقتبس بنمط quote (بعلامتيه)، والباقي بنمط base
export function quotedRuns(text, base = 'text') {
  const runs = [];
  let rest = text;
  while (rest) {
    const a = rest.indexOf('﴿');
    const b = a >= 0 ? rest.indexOf('﴾', a + 1) : -1;
    if (a < 0 || b < 0) {
      runs.push({ t: rest, s: base });
      break;
    }
    if (a > 0) runs.push({ t: rest.slice(0, a), s: base });
    runs.push({ t: rest.slice(a, b + 1), s: 'quote' });
    rest = rest.slice(b + 1);
  }
  return runs;
}

// سطر فائدة: الكلمات الملوّنة ⸨…⸩ بلون التطبيق، وفي كلٍّ الآيات المقتبسة
const faidaRuns = (line) => emphasisParts(line).flatMap(([em, part]) => (em ? quotedRuns(part, 'em').map((r) => ({ ...r, s: 'em' })) : quotedRuns(part)));

const para = (runs, extra = {}) => ({ type: 'para', runs, ...extra });
const RULE = { type: 'rule' };

// التفسير: فقراته كما تُعرض، وبينها خط فاصل
export function tafsirUnits(text) {
  const out = [];
  paragraphs(text).forEach((p, i) => {
    if (i) out.push(RULE);
    out.push(para(quotedRuns(p)));
  });
  return out;
}

// معاني الكلمات: الكلمة بلفظها من المصحف، ومعناها
export const meaningUnits = (words) => words.map((w) => ({ type: 'pair', word: w.mushaf ?? w.word, meaning: w.meaning }));

// العمل بالآيات: كل توجيه بندًا، وتحته آياته بخط أصغر
export function actionUnits(quran, actions) {
  const out = [];
  actions.forEach((a, i) => {
    if (i) out.push(RULE);
    out.push(para(quotedRuns(a.t), { bullet: true }));
    out.push(para([{ t: verseLabel(quran, a.v), s: 'muted' }], { size: 'small' }));
  });
  return out;
}

// الفوائد: العنوان، وجزء الآية، والقائل، والنص أسطرًا وبنودًا، والمصدر، والتوجيه الدعوي؛ وبين الفوائد خط فاصل
export function fawaidUnits(list) {
  const out = [];
  list.forEach((f, i) => {
    if (i) out.push(RULE);
    if (f.title) out.push(para([{ t: f.title, s: 'bold' }], { keepNext: true }));
    if (f.q) out.push(para([{ t: `﴿${f.q}﴾`, s: 'quote' }], { keepNext: true }));
    if (f.by) out.push(para([{ t: f.by, s: 'bold' }], { keepNext: true }));
    for (const line of f.t.split('\n')) {
      if (!line.trim()) continue;
      out.push(line.startsWith('• ') ? para(faidaRuns(line.slice(2)), { bullet: true }) : para(faidaRuns(line)));
    }
    out.push(para([{ t: f.src, s: 'muted' }], { size: 'small' }));
    if (f.tip) out.push(para(faidaRuns(f.tip), { bar: true }));
  });
  return out;
}

export const CARD_TITLES = { tafsir: 'التفسير', meanings: 'معاني الكلمات', actions: 'العمل بالآيات', fawaid: 'الفوائد' };

// مواصفة صور بطاقة من بطاقات مربع الآية: العنوان واسم الآية في رأس كل صورة، والآية في أول الأولى، ثم المحتوى،
// ثم مصدره (التفسير وحده: اسم كتابه، كما في البطاقة)
// content: { units, credit? }
export function cardSpec(quran, v, kind, { units, credit }) {
  const x = quran.verses[v];
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  return {
    title: CARD_TITLES[kind],
    ref: `${quran.suras[x.s - 1].name}: ${ar(x.a)}`,
    verse: verseText(quran, v),
    units,
    credit,
  };
}

// ---------- صفحات المحتوى (الجلسة ٢، ٢٠٢٦-١١-٢٣) ----------
// مقدار التبويب مجموعاتٍ: آية (أو آيات متتالية لها محتوى واحد) ثم محتواها — كما يُنسخ (copyContent):
//   [{ verses: [فهارس الآيات], head?: عنوان بدل الآيات (فوائد السورة العامة), units }]
// والمجموعات المتتالية على الآيات نفسها تُجمع، وبين محتوياتها خط فاصل.

// التفسير: كتل التفسير (tafsirBlocks)، كلٌّ بفقراتها
export const tafsirGroups = (blocks) => blocks.map((b) => ({ verses: b.verses, units: tafsirUnits(b.text) }));

// معاني الكلمات: كل آية لها معانٍ، ثم معانيها
export const meaningGroups = (list) => list.map(({ v, words }) => ({ verses: [v], units: meaningUnits(words) }));

// العمل بالآيات: آيات كل توجيه (من أولها إلى آخرها) ثم التوجيه بندًا
export function actionGroups(actions) {
  return actions.map((a) => {
    const verses = [];
    for (let v = a.v[0]; v <= a.v.at(-1); v++) verses.push(v);
    return { verses, units: [para(quotedRuns(a.t), { bullet: true })] };
  });
}

// الفوائد: كتل التبويب (fawaidBlocks)، والعامة تحت عنوانها بلا آياتها
export const fawaidGroups = (blocks, headOf) =>
  blocks.map((b) => ({ verses: b.verses, ...(b.all ? { head: headOf(b.verses) } : {}), units: fawaidUnits(b.items) }));

// مواصفة صور تبويب: العنوان والمقدار في رأس كل صورة، ثم لكل مجموعة مربع آياتها (أو عنوانها) ومحتواها،
// ثم مصدره (التفسير: اسم كتابه مرة في آخرها). والمقدار عدة مجموعات بحجم خط ثابت (أصغر الأحجام)، والمجموعة
// الواحدة بأكبر خط يسعها كالبطاقات.
// verses: آيات المقدار كله (للرأس)
export function rangeSpec(quran, kind, verses, groups, { credit } = {}) {
  const merged = [];
  const key = (g) => g.head ?? g.verses.join();
  for (const g of groups) {
    const last = merged.at(-1);
    if (last && key(last) === key(g)) last.units.push(RULE, ...g.units);
    else merged.push({ ...g, units: [...g.units] });
  }
  const units = [];
  merged.forEach((g, i) => {
    if (g.head) units.push(para([{ t: g.head, s: 'bold' }], { keepNext: true, group: i }));
    else units.push({ type: 'verse', text: g.verses.map((v) => verseText(quran, v)).join(' '), group: i });
    for (const u of g.units) units.push({ ...u, group: i });
  });
  return {
    title: CARD_TITLES[kind],
    ref: verseLabel(quran, [verses[0], verses.at(-1)]),
    units,
    credit,
    // آيات كل مجموعة لتنبيه ما شُورك (والعامة عن السورة لا تُحسب: آياتها السورة كلها)
    groups: merged.map((g) => (g.head ? [] : g.verses)),
    ...(merged.length > 1 ? { sizes: [SIZES.at(-1)] } : {}),
  };
}

// تنبيه المعاينة إن قُطع المقدار: «شُورك من البقرة ١ إلى ٣ من أصل ١٠ آيات»
export function rangeNote(quran, spec, shown, total) {
  const vs = spec.groups.slice(0, shown).flat();
  if (!vs.length) return null;
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const a = quran.verses[lo];
  const b = quran.verses[hi];
  const name = (x) => quran.suras[x.s - 1].name;
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const end = a.s === b.s ? ar(b.a) : `${name(b)} ${ar(b.a)}`;
  const what = lo === hi ? `فشُورك ${name(a)} ${ar(a.a)}` : `فشُورك من ${name(a)} ${ar(a.a)} إلى ${end}`;
  return `المقدار أطول من ٤ صور، ${what} من أصل ${countText(total, AYAT, ar)}، وفي آخر الأخيرة «التتمة في تطبيق قرآن السلف».`;
}

// اسم ملفات صور المقدار: quran-alsalaf-tafsir-2-1-5، وعبر سورتين quran-alsalaf-tafsir-2-280-3-4
export function rangeFileName(quran, kind, verses) {
  const a = quran.verses[verses[0]];
  const b = quran.verses[verses.at(-1)];
  const end = a.s === b.s ? (a.a === b.a ? '' : `-${b.a}`) : `-${b.s}-${b.a}`;
  return `quran-alsalaf-${kind}-${a.s}-${a.a}${end}`;
}
