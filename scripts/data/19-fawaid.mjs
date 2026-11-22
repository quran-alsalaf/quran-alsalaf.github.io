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
// https://t.me/s/tadabbor111)، فلا يحتاج البناء إلى تيليجرام. والجلسة ١ للختمة الثالثة (رسائلها نصوص).
// والجلسة ٢ للختمة الأولى: فوائدها صور (١٥٥٢)، نُسخت نصوصها في khatma1.json ← images بشكل الرسالة النصية نفسه
// (الآية وعزوها، ثم النص، ثم المصدر)، و⸨…⸩ الكلمة الملوّنة عنوانًا في أول الفقرة، وtitle عنوان الصورة بلا آية؛
// وطوبقت بالتفاسير الستة في التطبيق، وعيّنة منها بالشاملة.
// والجلسة ٣ للختمة الثانية «الدعوة إلى الله»: صورها (٦٨٥) بشكل صور الأولى، وtip التوجيه الدعوي تحت الخط في
// الصورة («فاحرص على…»)؛ ورسائلها النصية من برنامج «تدبر آية كل يوم» في رمضان بعدها: رسالة «💎 آية اليوم»
// بالآية، ثم فوائدها، وما لا آية في أوله منها (day) يُربط بآية اليوم قبله.
//
// المخرج: public/data/fawaid.json
//   { items: [{ id, k, v: [أول آية، آخرها], title?, all?, q?, by?, t, src, tip? }] }
//   (بلا موضوعات الختمات: أُلغي وسم الموضوع في الجلسة ٢، ٢٠٢٦-١١-٢٢، بقرار صاحب المشروع)
//   tip التوجيه الدعوي في صور الختمة الثانية، وsrc فارغ إن لم يكن للفائدة سطر مصدر
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
export const KHATMAS = [1, 2, 3];

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
  // الختمة الأولى (صور): عزو لا يطابق الآية في أعلى الصورة، أو بلا آية في أعلاها (والربط على آية واحدة أو آيات
  // متتالية من سورة واحدة؛ فالفائدة عن آيات متفرقة أو سور على أولاها، بقرار صاحب المشروع ٢٠٢٦-١١-٢٢)
  16: { ref: [1, 2, 4] }, // «الحمد لله… * الرحمن الرحيم * مالك يوم الدين» والعزو «٢-٣»
  45: { ref: [2, 106, 107] }, // الآيتان في نصها
  148: { ref: [3, 120, 120] }, // ثلاث آيات متفرقة (آل عمران ١٢٠ و١٢٥ و١٨٦): على أولاها
  220: { ref: [4, 142, 142] }, // الآية في نصها
  233: { ref: [5, 1, 120], whole: true }, // «سورة المائدة أجمع سورة…»
  382: { ref: [7, 1, 206], whole: true }, // حديثا قراءة الأعراف في المغرب
  402: { ref: [7, 33, 33] }, // الآية في نصها
  430: { ref: [7, 205, 205] }, // آية الذكر (الأعراف ٢٠٥) وآية الدعاء (٥٥): على أولاهما
  476: { ref: [8, 45, 45] }, // العزو «الأنفال: ٢٤»
  575: { ref: [10, 39, 39] }, // العزو «يونس: ٦١»
  799: { ref: [18, 9, 26], whole: true }, // «قصة أصحاب الكهف»
  821: { ref: [18, 60, 82], whole: true }, // «قصة موسى والخضر»
  1358: { ref: [39, 71, 73] }, // «وسيق الذين كفروا… وسيق الذين اتقوا» والعزو «٧٢-٧٣»
  1857: { ref: [81, 1, 29], whole: true }, // «سورة التكوير والانفطار والانشقاق»: تحت أولاها
  // الآية في أعلى الصورة (محمد ١٩) خطأ من المصمم: نصها عن «ولا تبطلوا أعمالكم» (محمد ٣٣)، فلا تُعرض آية الصورة
  1504: { ref: [47, 33, 33], dropQuote: true },
  // عبارة ليست في الكتاب ومعناها مضطرب («تركه هو سبب التفرق، لا أنه هو سبب التفرق»)، فتُترك (بقرار صاحب المشروع)
  132: { skip: true },
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

// عنوان صورة باسم السورة: «سورة الأنفال»، «سورة: ق»، «من أسماء سورة التوبة»
const SURA_TITLE = /^(?:من أسماء\s+)?سورة\s*:?\s*[ء-ي ]+[:：]*\s*$/;
const suraOfTitle = (title) => title.replace(/^(?:من أسماء\s+)?سورة\s*:?\s*/, '');

// أسطر النص والمصدر (آخر سطر، إلا إن لم يكن لها مصدر nosrc) ⇐ { t, src }
const bodyOf = (rest, nosrc = false) => ({
  t: rest
    .slice(0, nosrc ? rest.length : -1)
    .map(([l]) => (BULLET.test(l) ? `• ${tidy(l.replace(BULLET, ''))}` : tidy(l)))
    .filter((l) => l !== '•')
    .join('\n'),
  src: nosrc ? '' : tidy(rest.at(-1)[0]).replace(/\.$/, '').replace(/^تفسيرال/, 'تفسير ال'),
});

// صورة بلا آية في أعلاها: بعنوان (title، «سورة الأنفال» أو «قصة أصحاب الكهف»)، أو آيتها مذكورة في FIXES
export function parseHeadless(m) {
  const nonEmpty = m.text
    .split('\n')
    .map((l) => l.trim())
    .map((l, i) => [l, i])
    .filter(([l]) => l);
  if (nonEmpty.length < 2) return null;
  const title = m.title ?? null;
  // (والعنوان اسم السورة وحده لا يُكرَّر: الفوائد العامة تُعرض تحت اسم السورة)
  const plainSura = Boolean(title && SURA_TITLE.test(title) && /^سورة/.test(title));
  return { id: m.id, quote: null, ref: null, title, plainSura, by: '', ...bodyOf(nonEmpty, m.nosrc) };
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
  // (وفي نصوص الصور قد تأتي الآية بلا عزو، فتُعرف من نصها)
  const afterQuote = first.replace(QUOTE, '').trim();
  const verseFirst = QUOTE.test(first) && (REF.test(afterQuote) || (m.photo !== undefined && !afterQuote));
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

// رسالة «💎 آية اليوم:» ثم الآية وعزوها (برنامج رمضان بعد الختمة الثانية)
const DAY = /^\s*💎?\s*آية اليوم\s*:/;
function dayVerses(m, idx, sura, at) {
  const line = m.text.replace(DAY, '').trim().split('\n')[0].trim();
  const q = line.match(QUOTE);
  const r = q && line.slice(q[0].length).trim().match(REF);
  const s = r && sura(r[1].trim());
  if (!s) return null;
  const v = [at(s, num(r[2])), at(s, r[3] ? num(r[3]) : num(r[2]))];
  return v[0] >= 0 && v[1] >= v[0] && quoteIn(idx, tidy(q[1]), v[0], v[1]) ? v : null;
}

// فوائد ختمة: [{ id, k, v, title?, by, t, src, tip? }]، ومعها المشكلات (لتوقف البناء)
export function buildKhatma(quran, data) {
  const idx = verseIndex(quran);
  const sura = suraNames(quran);
  const at = verseAt(quran);
  const items = [];
  const problems = [];
  const fixed = [];
  const seen = new Set();
  // آية اليوم (برنامج رمضان بعد الختمة الثانية): [أول، آخر] من آخر رسالة «💎 آية اليوم» قبل الرسالة
  let day = null;
  // رسائل الختمة، ونصوص صورها (الختمتان الأولى والثانية: كل فائدة صورة، نُسخ نصها بشكل الرسالة النصية نفسه)
  for (let m of [...data.messages, ...(data.images ?? []).filter((x) => x.text)]) {
    if (DAY.test(m.text)) {
      day = dayVerses(m, idx, sura, at);
      if (!day) problems.push(`${m.id}: آية اليوم غير معروفة`);
      // (وفي ٣٠٦٤ جاءت الفائدة بعد الآية في رسالة «آية اليوم» نفسها: تُقرأ بلا السطر الأول)
      const rest = m.text.replace(DAY, '').trim();
      if (rest.split('\n').filter((l) => l.trim()).length < 3) continue;
      m = { ...m, text: rest };
    }
    const f = m.day
      ? parseHeadless(m)
      : (parseMessage(m) ?? (m.photo !== undefined && (m.title || FIXES[m.id]?.ref) ? parseHeadless(m) : null));
    if (!f) continue;
    let v = null;
    const fix = FIXES[f.id];
    if (fix?.skip) continue;
    if (m.day) {
      if (day) v = day;
      else problems.push(`${f.id}: فائدة يوم بلا آية اليوم قبلها`);
    } else if (fix?.ref) {
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
            fixed.push(`${f.id}: عزو صُحّح بنص الآية: ${f.ref.sura} ${f.ref.from} ⇐ ${quran.verses[near[0]].a}`);
            v = near;
          } else problems.push(`${f.id}: الاقتباس لا يطابق ${f.ref.sura} ${f.ref.from}-${f.ref.to}: ${f.quote.slice(0, 50)}`);
        }
      }
    } else if (f.title && SURA_TITLE.test(f.title) && sura(suraOfTitle(f.title))) {
      // عن السورة كلها
      const s = sura(suraOfTitle(f.title));
      v = [at(s, 1), at(s, quran.suras[s - 1].count)];
      f.whole = true;
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
    if (f.title && !f.plainSura) item.title = f.title;
    if (fix?.whole || f.whole) item.all = 1;
    // جزء الآية الذي تتكلم عنه الفائدة («﴿من ذا الذي يشفع عنده إلا بإذنه﴾»)، إن لم تقتبس آياتها كاملة
    if (f.quote && !fix?.dropQuote && skeleton(f.quote).length < 0.9 * skeleton(idx.slice(v[0], v[1] + 1).join(' ')).length) item.q = f.quote;
    if (f.by) item.by = f.by;
    Object.assign(item, { t: f.t, src: f.src });
    if (m.tip) item.tip = tidy(m.tip);
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
  for (const x of fixed) console.log(`  تصحيح: ${x}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    throw new Error(`${problems.length} مشكلة في الفوائد`);
  }
  // بترتيب المصحف، ثم بترتيب الختمات (الأولى ثم الثانية ثم الثالثة، بقرار صاحب المشروع ٢٠٢٦-١١-٢٢)، ثم بترتيب نشرها
  items.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.k - b.k || a.id - b.id);
  await writeFile(OUT, `${JSON.stringify({ items })}\n`);
  console.log(`✓ ${OUT}: ${items.length} فائدة`);
}

if (import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
