// فوائد الآيات (٢٠٢٦-١١-٢٢، «الفوائد» الجلسة ١): من قناة «ختمة التفسير والتدبر» لصاحب المشروع، تبنيها
// الخطوة ١٩ (scripts/data/19-fawaid.mjs) في public/data/fawaid.json:
//   { items: [{ id, k, v: [أول آية، آخرها], title?, all?, q?, by?, t, src, tip? }] }
// وفي t الكلمات الملوّنة في صورة الفائدة بين ⸨ و⸩ (الختمة الأولى، الجلسة ٢)، وtip التوجيه الدعوي تحت الخط في
// صور الختمة الثانية «الدعوة إلى الله» (الجلسة ٣)
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

// الفوائد التي تمسّ آيات المصحف المعروض verses (كلٌّ مرة واحدة، بترتيب الملف).
// own: فوائد الآيات نفسها وحدها، بلا الفوائد العامة عن السورة أو مقطع منها (f.all) — لمربع الآية
// (بقرار صاحب المشروع ٢٠٢٦-١١-٢٢: لا يظهر فيه إلا ما يخصّ الآية)
export function fawaidIn(quran, data, verses, { own = false } = {}) {
  const idx = indexOf(data);
  const seen = new Set();
  for (const h of hafsList(quran, verses)) for (const i of idx.get(h) ?? []) if (!(own && data.items[i].all)) seen.add(i);
  return [...seen].sort((a, b) => a - b).map((i) => data.items[i]);
}

// آيات الفائدة بترقيم المصحف المعروض
export const faidaVerses = (quran, f) =>
  shownList(quran, Array.from({ length: f.v[1] - f.v[0] + 1 }, (_, i) => f.v[0] + i));

// كتل صفحات المحتوى: آيات كل فائدة ثم الفائدة، والفوائد المتتالية على الآيات نفسها تُجمع تحت آياتها.
// [{ verses, items, all? }]، والفائدة التي على آيتين تأتي بعدهما معًا ولو جاوزتا المقدار.
// والفوائد العامة عن السورة أو مقطع منها (all) كتلة بلا آياتها: تحت اسم السورة أو المقطع وحده (٢٠٢٦-١١-٢٢،
// بطلب صاحب المشروع)، قبل فوائد آياتها
export function fawaidBlocks(quran, data, verses) {
  const list = fawaidIn(quran, data, verses);
  // العامة أولًا بين ما يبدأ من الآية نفسها
  list.sort((a, b) => a.v[0] - b.v[0] || (b.all ?? 0) - (a.all ?? 0));
  const out = [];
  for (const f of list) {
    const vs = faidaVerses(quran, f);
    const last = out.at(-1);
    if (last && Boolean(last.all) === Boolean(f.all) && last.verses.join() === vs.join()) last.items.push(f);
    else out.push({ verses: vs, items: [f], ...(f.all ? { all: true } : {}) });
  }
  return out;
}

// عنوان كتلة الفوائد العامة: «سورة الفاتحة» إن كانت عن السورة كلها، وإلا المقطع «الكهف ٩–٢٦»
export function wholeHeading(quran, verses) {
  const first = quran.verses[verses[0]];
  const last = quran.verses[verses.at(-1)];
  const sura = quran.suras[first.s - 1];
  if (first.a === 1 && last.a === sura.count) return `سورة ${sura.name}`;
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  return `${sura.name} ${ar(first.a)}–${ar(last.a)}`;
}

// علامتا الكلمات الملوّنة في نص الفائدة
export const EM_OPEN = '⸨';
export const EM_CLOSE = '⸩';

// السطر ⇐ [[ملوَّن؟، نص], …]
export function emphasisParts(text) {
  const out = [];
  let rest = text;
  while (rest) {
    const a = rest.indexOf(EM_OPEN);
    const b = a >= 0 ? rest.indexOf(EM_CLOSE, a + 1) : -1;
    if (a < 0 || b < 0) {
      out.push([false, rest]);
      break;
    }
    if (a > 0) out.push([false, rest.slice(0, a)]);
    out.push([true, rest.slice(a + 1, b)]);
    rest = rest.slice(b + 1);
  }
  return out;
}

// الفائدة نصًّا للنسخ: جزء الآية إن كان، والعنوان، والقائل، والنص (بلا علامتي التلوين)، والمصدر، والتوجيه
export function faidaPlain(f) {
  return [f.q && `﴿${f.q}﴾`, f.title, f.by, f.t.replace(/[⸨⸩]/g, ''), f.src, f.tip].filter(Boolean).join('\n');
}
