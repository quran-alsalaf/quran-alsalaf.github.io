// بيانات صفحات المحتوى (تفسير · معاني الكلمات · العمل بالآيات) لنطاق من الآيات.
//
// التفاسير المبنية مع التطبيق تُحمَّل عند أول فتح لها لا عند فتح التطبيق (نحو ١٠ ميغابايت معًا)،
// وعامل الخدمة يحفظها مسبقًا، فتعمل بلا إنترنت.
import { useEffect, useState } from 'react';

// (import.meta.env غائب خارج Vite، كاختبارات المتصفح التي تستورد paragraphs)
const BASE = import.meta.env?.BASE_URL ?? '/';
const TAFSIR_KEY = 'hq.tafsir';
// بترتيب قائمة الاختيار. name: في زرّ الاختيار، title: اسم الكتاب أسفل التفسير وفي النسخ
export const TAFSIR_SOURCES = [
  { id: 'muyassar', name: 'الميسّر', title: 'التفسير الميسّر' },
  { id: 'mukhtasar', name: 'المختصر', title: 'المختصر في تفسير القرآن الكريم' },
  { id: 'saadi', name: 'السعدي', title: 'تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)' },
];
const DEFAULT_TAFSIR = 'muyassar';
export const tafsirInfo = (id) => TAFSIR_SOURCES.find((s) => s.id === id);

// الاختيار في الجلسة إن تعذّر التخزين، ومن يتابعه (صفحات المحتوى وبطاقة الآية معًا)
let sessionChoice = null;
const listeners = new Set();

// مصدر التفسير المختار: يُحفظ ويبقى في كل فتح لاحق، والافتراضي الميسّر (٢٠٢٦-١١-١٤، كان المختصر)
export function readTafsirSource() {
  let id = sessionChoice;
  try {
    id = localStorage.getItem(TAFSIR_KEY) ?? id;
  } catch {
    // التخزين غير متاح
  }
  return tafsirInfo(id) ? id : DEFAULT_TAFSIR;
}

export function saveTafsirSource(id) {
  sessionChoice = id;
  try {
    localStorage.setItem(TAFSIR_KEY, id);
  } catch {
    // التخزين غير متاح: يسري في هذه الجلسة وحدها
  }
  for (const f of listeners) f(id);
}

// [المصدر المختار، تغييره]: اختيار واحد في صفحات المحتوى وبطاقة الآية، يتبعه كلاهما فورًا
export function useTafsirSource() {
  const [source, setSource] = useState(readTafsirSource);
  useEffect(() => {
    listeners.add(setSource);
    return () => listeners.delete(setSource);
  }, []);
  return [source, saveTafsirSource];
}

// آيات لم يُفرد لها السعدي كلامًا (يفسّر الآيات مجموعاتٍ، فتأتي آية منها أحيانًا بلا كلام خاص بها)
export const SAADI_SHARED = 'لم يُفرد السعدي لهذه الآية كلامًا، وتفسيرها داخل في كلامه على الآيات التي حولها.';

// تقسيم نص التفسير فقرات للقراءة (٢٠٢٦-١١-١٤): التفسير الطويل (السعدي خاصة) كتلة واحدة يصعب تتبّعها،
// فيبدأ سطر جديد عند نهاية جملة («.» أو «؟» أو «!» ثم مسافة، لا داخل اقتباس ﴿…﴾ ولا في «...») متى بلغت
// الفقرة نحو target حرفًا (وإن طالت بلا نهاية جملة فعند «؛» بعد ضعفيه، ثم «،» بعد ثلاثة أمثاله)، وعند كل بند مرقّم («1 - …» في المختصر)، وتبقى فقرات الأصل (السطر الجديد) كما هي.
// والفقرة الأخيرة القصيرة جدًّا تُضمّ إلى ما قبلها. النص نفسه لا يتغير، فقط مواضع الأسطر.
export function paragraphs(text, target = 260) {
  const out = [];
  for (const block of text.split('\n')) {
    const start = out.length;
    for (const part of block.split(/ (?=[\d٠-٩]{1,2} - )/)) {
      let cur = '';
      let depth = 0;
      for (let i = 0; i < part.length; i++) {
        const c = part[i];
        cur += c;
        if (c === '﴿') depth++;
        else if (c === '﴾') depth = Math.max(0, depth - 1);
        else if (
          depth === 0 &&
          part[i + 1] === ' ' &&
          // نهاية جملة؛ فإن طالت الفقرة جدًّا بلا نهاية جملة (السعدي يصل جمله بالفواصل) فعند «؛» ثم «،»
          ((('.؟!'.includes(c) && part[i - 1] !== '.') && cur.trim().length >= target) ||
            (c === '؛' && cur.trim().length >= target * 2) ||
            (c === '،' && cur.trim().length >= target * 3))
        ) {
          out.push(cur.trim());
          cur = '';
        }
      }
      if (cur.trim()) out.push(cur.trim());
    }
    // ذيل قصير جدًّا من الكتلة نفسها يُضمّ إلى ما قبله
    if (out.length - start > 1 && out.at(-1).length < 60 && !/^[\d٠-٩]{1,2} - /.test(out.at(-1))) {
      const tail = out.pop();
      out[out.length - 1] += ` ${tail}`;
    }
  }
  return out.filter(Boolean);
}

// نص تفسير الآية v من المصدر id (البيانات t)، نصًّا عاديًّا؛ '' إن لم يكن لها كلام خاص بها
export function tafsirText(id, t, v) {
  const raw = t.verses[v] ?? '';
  return id === 'muyassar' ? muyassarPlain(raw, t.quote) : raw;
}

const tafsirs = new Map();
export function loadTafsir(id) {
  let p = tafsirs.get(id);
  if (!p) {
    p = fetch(`${BASE}data/tafsir-${id}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        tafsirs.delete(id); // تُتاح إعادة المحاولة
        throw err;
      });
    tafsirs.set(id, p);
  }
  return p;
}

// آيات الصفحة بترتيبها
export function pageVerses(quran, page) {
  const out = [];
  for (const line of quran.pages[page - 1]) {
    if (!line.g) continue;
    for (const [v] of line.g) if (out.at(-1) !== v) out.push(v);
  }
  return out;
}

// فهارس المذكرات لكل آية، تُبنى مرة واحدة
const indexes = new WeakMap();
export function memoIndex(quran) {
  let idx = indexes.get(quran);
  if (idx) return idx;
  const { sections = [], meanings = [], actions = [] } = quran.memos ?? {};
  const n = quran.verses.length;
  const sectionOf = { t: new Int32Array(n).fill(-1), m: new Int32Array(n).fill(-1), a: new Int32Array(n).fill(-1) };
  sections.forEach((s, i) => {
    for (const [a, b] of s.r) for (let v = a; v <= b; v++) sectionOf[s.k][v] = i;
  });
  const meaningsOf = new Map();
  for (const [v, word, meaning, , from, to] of meanings) {
    if (!meaningsOf.has(v)) meaningsOf.set(v, []);
    // الكلمة بلفظها من المصحف إن عُرف موضعها في الآية، وإلا كما كُتبت في المذكرة
    const mushaf = from === undefined ? null : quran.verses[v].t.slice(from, to + 1).join(' ');
    meaningsOf.get(v).push({ word, meaning, mushaf });
  }
  const actionsOf = new Map();
  actions.forEach((a, i) => {
    for (const v of a.v) {
      if (!actionsOf.has(v)) actionsOf.set(v, []);
      actionsOf.get(v).push(i);
    }
  });
  idx = { sections, actions, sectionOf, meaningsOf, actionsOf };
  indexes.set(quran, idx);
  return idx;
}

// أقسام نوعٍ ما (t/m/a) التي تمسّ النطاق، بترتيب أول ظهورها، لعرض روابطها
export function sectionsInRange(quran, kind, verses) {
  const { sectionOf } = memoIndex(quran);
  const seen = [];
  for (const v of verses) {
    const s = sectionOf[kind][v];
    if (s >= 0 && !seen.includes(s)) seen.push(s);
  }
  return seen;
}

// التوجيهات العملية التي تمسّ النطاق: كل توجيه مرة واحدة، كاملًا ولو تجاوزت آياته النطاق
export function actionsInRange(quran, verses) {
  const { actionsOf } = memoIndex(quran);
  const seen = new Set();
  const out = [];
  for (const v of verses) for (const i of actionsOf.get(v) ?? []) if (!seen.has(i)) {
    seen.add(i);
    out.push(i);
  }
  return out;
}

// «البقرة ٣» أو «البقرة ٣–٥»
const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
export function verseLabel(quran, list) {
  const first = quran.verses[list[0]];
  const last = quran.verses[list.at(-1)];
  const name = quran.suras[first.s - 1].name;
  // آية واحدة (ولو حُددت بدايةً ونهاية معًا) تُكتب بلا «–»
  if (list.length === 1 || list[0] === list.at(-1)) return `${name} ${ar(first.a)}`;
  if (first.s === last.s) return `${name} ${ar(first.a)}–${ar(last.a)}`;
  return `${name} ${ar(first.a)} – ${quran.suras[last.s - 1].name} ${ar(last.a)}`;
}

export function sectionLabel(quran, section) {
  const list = section.r.flatMap(([a, b]) => [a, b]);
  return verseLabel(quran, [Math.min(...list), Math.max(...list)]);
}

// نص الآية بالرسم العثماني، وآخره علامتها برقمها (تُرسم بخط المصحف في التطبيق)
export const verseText = (quran, v) => quran.verses[v].t.join(' ');

// ---------- النسخ للمشاركة ----------
// علامة الآية في النص رمزٌ خاص بخط المصحف، يظهر في الخطوط العادية حروفًا غريبة («ئج»)؛
// فيُنسخ النص بلا علامته، ويُكتب رقم الآية بين قوسين أو في المرجع.
export const versePlain = (quran, v) => quran.verses[v].t.slice(0, -1).join(' ');

// ﴿نص الآية﴾ [السورة: رقمها]
export function copyVerse(quran, v) {
  const x = quran.verses[v];
  return `﴿${versePlain(quran, v)}﴾ [${quran.suras[x.s - 1].name}: ${ar(x.a)}]`;
}

// آيات النطاق، مجموعةً بالسور: ﴿آية (١) آية (٢)﴾ [السورة: ١–٢]
export function copyVerses(quran, list) {
  const groups = [];
  for (const v of list) {
    const s = quran.verses[v].s;
    if (groups.at(-1)?.s === s) groups.at(-1).vs.push(v);
    else groups.push({ s, vs: [v] });
  }
  return groups
    .map(({ s, vs }) => {
      const text = vs.map((v) => `${versePlain(quran, v)} (${ar(quran.verses[v].a)})`).join(' ');
      const a = quran.verses[vs[0]].a;
      const b = quran.verses[vs.at(-1)].a;
      return `﴿${text}﴾ [${quran.suras[s - 1].name}: ${ar(a)}${b !== a ? `–${ar(b)}` : ''}]`;
    })
    .join('\n\n');
}

// نص الميسّر: علامتا الاقتباس فيه رمزان خاصان بخط المصحف، فيُكتبان قوسين عاديين
export const muyassarPlain = (text, quote) => text.split(quote[0]).join('﴿').split(quote[1]).join('﴾');
