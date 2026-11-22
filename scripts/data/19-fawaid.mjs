// الخطوة ١٩: فوائد الآيات من قناة «ختمة التفسير والتدبر» (https://t.me/tadabbor111) لصاحب المشروع
// (٢٠٢٦-١١-٢٢، «الفوائد» الجلسة ١).
//
// القناة ختمات متتالية، والمعتمد منها بقرار صاحب المشروع: الأولى (عامة) والثانية (الدعوة إلى الله) والثالثة
// (الإيمان بالله). والفوائد فيها رسائل انتقاها صاحب القناة من مشاركات المشتركين، كلٌّ منها بهذا الشكل:
//
//   ﴿الآية﴾ [السورة: رقمها]          (أو {…}، أو بلا معقوفين، أو آيتان «[البقرة: ١٥٣-١٥٤]»)
//   قال السعدي رحمه الله:            (القائل)
//   نص الفائدة أسطرًا، وبعضها بنود (• - ◈ 》 ○ ¤ ← ⏎ * = ◉)
//   تفسير السعدي                     (المصدر، آخر سطر)
//
// ورسائل القناة الأخرى (إعلانات، ومقررات الأسابيع، وروابط يوتيوب، والملفات) ليست فوائد فتُترك.
//
// المصدر: نسخة من رسائل كل ختمة في scripts/data/fawaid/khatmaN.json (نُزّلت من صفحة القناة العامة
// https://t.me/s/tadabbor111)، فلا يحتاج البناء إلى تيليجرام. والجلسة ١ للختمة الثالثة (رسائلها نصوص)،
// والأولى والثانية صور تُستخرج نصوصها في جلستين لاحقتين.
//
// المخرج: public/data/fawaid.json
//   { items: [{ id, k, v: [أول آية، آخرها], title?, all?, q?, by?, t, src }] }
//   (بلا موضوعات الختمات: أُلغي وسم الموضوع في الجلسة ٢، ٢٠٢٦-١١-٢٢، بقرار صاحب المشروع)
//   q جزء الآية المقتبس إن لم تُقتبس آياتها كاملة، وby سطر القائل إن كان، وall: 1 للفائدة العامة عن السورة
//   أو مقطع منها (بلا آية في أولها)
//   v بفهرس آيات حفص (quran.json)، وt النص أسطرًا (\n) والبنود موحّدة «• »، واقتباسات الآيات ﴿…﴾.
//
// التحقق (وإلا توقف البناء): كل فائدة لها آية، والآية المقتبسة في أولها من آياتها المذكورة (أو تُعرف آياتها
// من نصها إن لم يُذكر رقمها)، وما يُستثنى من ذلك مذكور باسمه في FIXES.
//
//   node scripts/data/19-fawaid.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const OUT = 'public/data/fawaid.json';
export const KHATMAS = [1, 3];

// فوائد لا آية في أولها: تُربط بآياتها (السورة، أول آية، آخرها)
export const FIXES = {
  // العزو «يس: ٢٧» والآية «والشمس تجري لمستقر لها» يس ٣٨
  3634: { ref: [36, 38, 38] },
  // فوائد عامة لا آية في أولها (whole): عن السورة كلها أو مقطع منها، فتُعرض تحت اسمها بلا سرد آياتها، ولا تظهر
  // في مربع آية منها (بقرار صاحب المشروع ٢٠٢٦-١١-٢٢: مربع الآية لما يخصّها وحدها)
  // عن الفاتحة كلها
  3093: { ref: [1, 1, 7], whole: true },
  3094: { ref: [1, 1, 7], whole: true },
  // «قصة أصحاب الكهف»
  3443: { ref: [18, 9, 26], whole: true },
  // الختمة الأولى: «الحال التي ينبغي أن يكون عليها صاحب القرآن» (ابن رجب) عن القرآن كله لا عن سورة أو آية،
  // والفوائد تُعرض بآياتها، فتُترك
  38: { skip: true },
};

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const num = (s) => Number(s.replace(/[٠-٩]/g, (d) => DIGITS.indexOf(d)));

// ---------- مطابقة نص الآية ----------
// هيكل النص للمقارنة: الحروف وحدها بلا تشكيل ولا ألف ولا واو ولا ياء ولا همزة، لأن رسم المصحف يخالف
// الإملاء فيها («الصلوة» و«الصلاة»، «ءايت» و«آيات»، «يأيها» و«يا أيها»)، والفوائد تقتبس بالرسمين
// والتاء المفتوحة في رسم المصحف («رحمت الله») كالمربوطة، واللام المدغمة («الَّيل» و«الليل») كالمكررة
export const skeleton = (s) =>
  s
    .normalize('NFC')
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[اأإآٱءؤئويىٮ]/g, '')
    .replace(/[ةت]/g, 'ه')
    .replace(/[^ء-ي]/g, '')
    .replace(/(.)\1+/g, '$1');

// هيكل كل آية وما بعدها، للبحث عن الاقتباس
function verseIndex(quran) {
  return quran.verses.map((v) => skeleton(v.e));
}

// أجزاء الاقتباس: يُختصر أحيانًا بثلاث نقاط («… . . . وهو العلي العظيم»)، وتُفصل الآيات بـ«*»
const quoteParts = (quote) => quote.split(/(?:\s*\.\s*){2,}|…|\*/).map(skeleton).filter(Boolean);

// هل الاقتباس من الآيات [a..b] (جزء منها أو كلها، وأجزاؤه بترتيبها)؟
export function quoteIn(idx, quote, a, b) {
  const parts = quoteParts(quote);
  if (!parts.length) return false;
  // (والحرف المكرر بين آيتين يُضمّ كما في الاقتباس المتصل)
  const text = idx.slice(a, b + 1).join('').replace(/(.)\1+/g, '$1');
  let from = 0;
  for (const q of parts) {
    const i = text.indexOf(q, from);
    if (i < 0) return false;
    // (آخر حرف الجزء قد يكون أول حرف ما بعده إذا ضُمّ المكرر)
    from = i + q.length - 1;
  }
  return true;
}

// العزو لا يطابق الاقتباس: أقرب آيات من السورة نفسها (إلى ثلاث آيات قبله أو بعده) بالعدد نفسه تطابقه
// (رقم العزو بلا البسملة في الفاتحة، أو خطأ يسير فيه)
function nearQuote(quran, idx, quote, a, b) {
  const s = quran.verses[a].s;
  for (const d of [1, -1, 2, -2, 3, -3]) {
    const x = a + d;
    const y = b + d;
    if (x < 0 || y >= idx.length || quran.verses[x].s !== s || quran.verses[y].s !== s) continue;
    if (quoteIn(idx, quote, x, y)) return [x, y];
  }
  return null;
}

// آيات الاقتباس إن لم يُذكر رقمها: [أول، آخر] إن وقع في موضع واحد من المصحف
function findQuote(idx, quote) {
  const q = quoteParts(quote)[0] ?? '';
  if (q.length < 12) return null;
  const hits = [];
  for (let a = 0; a < idx.length; a++) {
    // أقصر آيات من a تحوي الاقتباس، ولا يحويه ما بعد a منها وحده (فلا يُعدّ الموضع مرتين)
    let s = '';
    for (let b = a; b < Math.min(a + 4, idx.length); b++) {
      s += idx[b];
      if (!s.includes(q)) continue;
      if (!idx.slice(a + 1, b + 1).join('').includes(q)) hits.push([a, b]);
      break;
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

// ---------- قراءة الرسالة ----------
// سطر القائل وحده («قال السعدي رحمه الله:»، «قال ابن عباس رضي الله عنهما:»، «… في قوله: ﴿…﴾:»)؛
// فإن تبعه كلامه في السطر نفسه فهو من نص الفائدة لا سطر قائل
const SAYER =
  /^(?:قال|يقول|وقال)\s[^:：]{2,60}?(?:رحمه|رحمهما|رحمهم|حفظه|رضي)\s*الله(?:\s*(?:عنهما|عنهم|عنها|عنه|تعالى))?(?:\s+في قوله\s*:?\s*[﴿{][^﴾}]*[﴾}])?\s*[:：]?[\s.]*$/;
const BULLET = /^(?:[•◈》○¤←⏎*=◉▪■◆]|-(?!\d))\s*/;
// الآية في أول الرسالة: ﴿…﴾ أو {…} ثم عزوها (أو بلا اقتباس: عزو وحده)
const QUOTE = /^[﴿{]([^﴾}]+)[﴾}]/;
const REF = /\[?\s*((?:سورة\s+)?[ء-يً-ٰ ]+?)\s*[:.؛،]?\s*([٠-٩\d]+)\s*(?:[-–]\s*([٠-٩\d]+))?\s*\]?\s*\.?$/;

// حروف «العرض» العربية (FE70–FEFF، تأتي من نسخ بعض الكتب) ⇐ حروفها العادية
const plainForms = (s) => s.replace(/[ﹰ-﻿]+/g, (x) => x.normalize('NFKC'));

// اقتباسات الآيات {…} ⇐ ﴿…﴾ كالتفاسير، والفراغات الزائدة، وعلامات الاتجاه الخفية
const tidy = (s) =>
  plainForms(s)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\{([^{}]+)\}/g, '﴿$1﴾')
    .replace(/[ \t ]+/g, ' ')
    .trim();

// اسم السورة كما يُكتب في العزو ⇐ رقمها (بلا «ال» وبصور الهمزة والتاء)
// وأخطاء الكتابة في القناة
const SURA_TYPOS = { الأنياء: 'الأنبياء' };
function suraNames(quran) {
  const key = (s) =>
    s
      .replace(/[ً-ٰ]/g, '')
      .replace(/^سورة\s+/, '')
      .replace(/^ال/, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة$/, 'ه')
      .replace(/ى$/, 'ي')
      .replace(/\s+/g, '');
  const map = new Map(quran.suras.map((x) => [key(x.name), x.n]));
  return (name) => map.get(key(SURA_TYPOS[name.trim()] ?? name.trim()));
}

// فهرس الآية (السورة، رقمها) في quran.json
function verseAt(quran) {
  const first = [];
  quran.verses.forEach((v, i) => {
    if (v.a === 1) first[v.s] = i;
  });
  return (s, a) => (first[s] !== undefined && a >= 1 && a <= quran.suras[s - 1].count ? first[s] + a - 1 : -1);
}

// الرسالة ⇐ فائدة، أو null إن لم تكن فائدة: في أولها سطر القائل، أو تبدأ بآية معزوّة ثم نصها ثم مصدرها
// (بعض الفوائد بلا سطر قائل، فقائلها في نصها أو مصدرها وحده)
export function parseMessage(m) {
  const lines = m.text.split('\n').map((l) => l.trim());
  const nonEmpty = lines.map((l, i) => [l, i]).filter(([l]) => l);
  if (nonEmpty.length < 3) return null;
  // سطر القائل أول الرسالة، أو بعد الآية أو العنوان
  const sayerAt = nonEmpty.slice(0, 2).find(([l]) => SAYER.test(l));
  const first = nonEmpty[0][0];
  const verseFirst = QUOTE.test(first) && REF.test(first.replace(QUOTE, '').trim());
  if (!sayerAt && !verseFirst) return null;
  const by = sayerAt ? sayerAt[0] : '';
  const byLine = sayerAt ? sayerAt[1] : nonEmpty[0][1];
  const head = nonEmpty.filter(([, i]) => (sayerAt ? i < byLine : i === byLine)).map(([l]) => l).join(' ');
  const rest = nonEmpty.filter(([, i]) => i > byLine);
  const src = rest.at(-1)[0];
  const body = rest.slice(0, -1).map(([l]) => l);

  let quote = null;
  let ref = null;
  let title = null;
  let h = head;
  const q = h.match(QUOTE);
  if (q) {
    quote = q[1];
    h = h.slice(q[0].length).trim();
  }
  const r = h.match(REF);
  if (r && r[1].trim()) {
    ref = { sura: r[1].trim(), from: num(r[2]), to: r[3] ? num(r[3]) : num(r[2]) };
    h = h.slice(0, r.index).trim();
  }
  if (!quote && h) {
    // آية بلا قوسين قبل عزوها، أو عنوان («قصة أصحاب الكهف:»)
    if (ref) quote = h;
    else title = h.replace(/[:：]\s*$/, '');
  }
  return {
    id: m.id,
    quote: quote && tidy(quote),
    ref,
    title,
    by: by && tidy(by).replace(/[\s.:：]*$/, ':'),
    t: body.map((l) => (BULLET.test(l) ? `• ${tidy(l.replace(BULLET, ''))}` : tidy(l))).filter((l) => l !== '•').join('\n'),
    src: tidy(src).replace(/\.$/, '').replace(/^تفسيرال/, 'تفسير ال'),
  };
}

// فوائد ختمة: [{ id, k, v, title?, by, t, src }]، ومعها المشكلات (لتوقف البناء)
export function buildKhatma(quran, data) {
  const idx = verseIndex(quran);
  const sura = suraNames(quran);
  const at = verseAt(quran);
  const items = [];
  const problems = [];
  const fixed = [];
  const seen = new Set();
  // رسائل الختمة، ونصوص صورها (الختمة الأولى: كل فائدة صورة، نُسخ نصها بشكل الرسالة النصية نفسه)
  for (const m of [...data.messages, ...(data.images ?? []).filter((x) => x.text)]) {
    const f = parseMessage(m);
    if (!f) continue;
    let v = null;
    const fix = FIXES[f.id];
    if (fix?.skip) continue;
    if (fix?.ref) {
      const [s, a, b] = fix.ref;
      v = [at(s, a), at(s, b)];
    } else if (f.ref) {
      const s = sura(f.ref.sura);
      if (!s) problems.push(`${f.id}: سورة غير معروفة «${f.ref.sura}»`);
      else {
        v = [at(s, f.ref.from), at(s, f.ref.to)];
        if (v[0] < 0 || v[1] < v[0]) {
          problems.push(`${f.id}: آية غير موجودة ${f.ref.sura} ${f.ref.from}-${f.ref.to}`);
          v = null;
        } else if (f.quote && !quoteIn(idx, f.quote, v[0], v[1])) {
          // العزو لا يطابق الاقتباس: يُقبل إن كان الاقتباس في الآية التي بعده أو قبله مباشرة (خطأ في رقم العزو
          // يُصحَّح بالنص)، وإلا مشكلة
          const near = nearQuote(quran, idx, f.quote, v[0], v[1]);
          if (near) {
            fixed.push(`${f.id}: ${f.ref.sura} ${f.ref.from} ⇐ ${quran.verses[near[0]].a}`);
            v = near;
          } else problems.push(`${f.id}: الاقتباس لا يطابق ${f.ref.sura} ${f.ref.from}-${f.ref.to}: ${f.quote.slice(0, 50)}`);
        }
      }
    } else if (f.quote) {
      v = findQuote(idx, f.quote);
      if (!v) problems.push(`${f.id}: لم تُعرف آية الاقتباس: ${f.quote.slice(0, 50)}`);
    } else problems.push(`${f.id}: فائدة بلا آية${f.title ? ` («${f.title}»)` : ''}`);
    if (!v) continue;
    // صورة نُشرت مرتين (الختمة الأولى: 1116 و1117): تُترك الثانية
    const key = `${v}|${skeleton(f.t)}`;
    if (seen.has(key)) {
      fixed.push(`${f.id}: مكررة فتُركت`);
      continue;
    }
    seen.add(key);
    const item = { id: f.id, k: data.khatma, v };
    if (f.title) item.title = f.title;
    if (fix?.whole) item.all = 1;
    // جزء الآية الذي تتكلم عنه الفائدة («﴿من ذا الذي يشفع عنده إلا بإذنه﴾»)، إن لم تقتبس آياتها كاملة
    if (f.quote && skeleton(f.quote).length < 0.9 * skeleton(idx.slice(v[0], v[1] + 1).join(' ')).length) item.q = f.quote;
    if (f.by) item.by = f.by;
    Object.assign(item, { t: f.t, src: f.src });
    items.push(item);
  }
  return { items, problems, fixed };
}

async function main() {
  const quran = JSON.parse(await readFile('public/data/quran.json', 'utf8'));
  const items = [];
  const problems = [];
  const fixed = [];
  for (const k of KHATMAS) {
    const data = JSON.parse(await readFile(`scripts/data/fawaid/khatma${k}.json`, 'utf8'));
    const out = buildKhatma(quran, data);
    items.push(...out.items);
    problems.push(...out.problems);
    fixed.push(...out.fixed);
  }
  for (const x of fixed) console.log(`  عزو صُحّح بنص الآية: ${x}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    throw new Error(`${problems.length} مشكلة في الفوائد`);
  }
  // بترتيب المصحف، ثم بترتيب الختمات (الأولى ثم الثالثة)، ثم بترتيب نشرها
  items.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.k - b.k || a.id - b.id);
  await writeFile(OUT, `${JSON.stringify({ items })}\n`);
  console.log(`✓ ${OUT}: ${items.length} فائدة`);
}

if (import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
