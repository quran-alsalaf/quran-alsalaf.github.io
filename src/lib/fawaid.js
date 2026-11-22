// فوائد الآيات (٢٠٢٦-١١-٢٢، «الفوائد» الجلسة ١): من قناة «ختمة التفسير والتدبر» لصاحب المشروع، تبنيها
// الخطوة ١٩ (scripts/data/19-fawaid.mjs) في public/data/fawaid.json:
//   { themes: { رقم الختمة: موضوعها }, items: [{ id, k, v: [أول آية، آخرها], title?, q?, by?, t, src }] }
// والآيات بترقيم حفص كسائر المحتوى، فتُعرض في ورش على ما يقابلها (src/lib/verseMap.js).
// تُحمَّل عند أول فتح لها، ويحفظها عامل الخدمة مسبقًا فتعمل بلا إنترنت.
import { hafsList, shownList } from './verseMap.js';

const BASE = import.meta.env?.BASE_URL ?? '/';

// رسالتا الغياب: في صفحات المحتوى (آيات المقدار كلها)، وفي بطاقة الآية
export const NO_FAWAID = 'لا فوائد في هذه الآيات';
export const NO_FAWAID_VERSE = 'لا فوائد لهذه الآية';

let loading = null;
export function loadFawaid() {
  loading ??= fetch(`${BASE}data/fawaid.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      loading = null; // تُتاح إعادة المحاولة
      throw err;
    });
  return loading;
}

// لكل آية حفص: أرقام الفوائد التي تشملها (بترتيبها في الملف: بترتيب المصحف ثم النشر)
const indexes = new WeakMap();
function indexOf(data) {
  let idx = indexes.get(data);
  if (!idx) {
    idx = new Map();
    data.items.forEach((f, i) => {
      for (let h = f.v[0]; h <= f.v[1]; h++) {
        if (!idx.has(h)) idx.set(h, []);
        idx.get(h).push(i);
      }
    });
    indexes.set(data, idx);
  }
  return idx;
}

// الفوائد التي تمسّ آيات المصحف المعروض verses (كلٌّ مرة واحدة، بترتيب الملف)
export function fawaidIn(quran, data, verses) {
  const idx = indexOf(data);
  const seen = new Set();
  for (const h of hafsList(quran, verses)) for (const i of idx.get(h) ?? []) seen.add(i);
  return [...seen].sort((a, b) => a - b).map((i) => data.items[i]);
}

// آيات الفائدة بترقيم المصحف المعروض
export const faidaVerses = (quran, f) =>
  shownList(quran, Array.from({ length: f.v[1] - f.v[0] + 1 }, (_, i) => f.v[0] + i));

// كتل صفحات المحتوى: آيات كل فائدة ثم الفائدة، والفوائد المتتالية على الآيات نفسها تُجمع تحت آياتها.
// [{ verses, items }]، والفائدة التي على آيتين تأتي بعدهما معًا ولو جاوزتا المقدار
export function fawaidBlocks(quran, data, verses) {
  const out = [];
  for (const f of fawaidIn(quran, data, verses)) {
    const vs = faidaVerses(quran, f);
    const last = out.at(-1);
    if (last && last.verses.join() === vs.join()) last.items.push(f);
    else out.push({ verses: vs, items: [f] });
  }
  return out;
}

// الفائدة نصًّا للنسخ: جزء الآية إن كان، والعنوان، والقائل، والنص، والمصدر
export function faidaPlain(f) {
  return [f.q && `﴿${f.q}﴾`, f.title, f.by, f.t, f.src].filter(Boolean).join('\n');
}
