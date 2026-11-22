// محتوى صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): يحوّل محتوى بطاقة الآية (تفسير · معاني · عمل · فوائد)
// إلى مواصفة الصور (src/lib/shareLayout.js) بالشكل الذي يُعرض به في التطبيق: الآيات المقتبسة ﴿…﴾ والكلمات الملوّنة
// في الفوائد بلون التطبيق، والبنود بنقطة، والتوجيه الدعوي بخطّ في أوله، والمصدر بخط أصغر.
import { emphasisParts } from './fawaid.js';
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
