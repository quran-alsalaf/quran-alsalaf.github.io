// الخطوة ٦: محتوى المذكرات — معاني الكلمات، والعمل بالآيات، وروابط يوتيوب لكل قسم.
//
// المصدر: مذكرات حلقات حفظ القرآن بطريقة السلف (ملفات Word في جذر المشروع، وهي لا تُرفع
// إلى git). فإن لم توجد الملفات تُخطّى هذه الخطوة ويبقى الملف الناتج السابق كما هو.
//
// ما يُستخرج وما يُهمَل (بقرار صاحب المشروع):
//   • معاني الكلمات: جدول «الكلمة | المعنى» بعد عنوان «معاني كلمات سورة …»
//   • العمل بالآيات: فقرات «العمل بالآيات من سورة …» أو «العمل بسورة …»، كل فقرة توجيه
//   • روابط يوتيوب: رمز QR بجوار عنوان كل قسم (تفسير/معاني/عمل) يُفكّ آليًّا
//   • نص تفسير المذكرات وفوائدها يُهمَلان: التفسير من كتاب المختصر (والميسّر) كاملًا.
//     ويُستفاد من عنوان قسم التفسير في نطاق آياته ورابطه فقط.
//
// ربط المحتوى بالآيات:
//   • نطاق كل قسم من عنوانه نفسه («سورة البقرة (١-٧)»)، أو السورة كاملة إن لم يُذكر نطاق
//   • الكلمة في جدول المعاني تُطابَق بنصّها داخل آيات القسم، بالترتيب (الجدول يتبع الآيات)
//   • التوجيه العملي يُربط بآياته من الاقتباس ﴿…﴾ في آخره: برقم الآية إن ذُكر، وإلا بنصّه.
//     وما خلا من الاقتباس يتبع آية التوجيه الذي قبله (التوجيهات تتبع ترتيب الآيات)
//
// المخرجات: public/data/memos.json، وتقرير التغطية في .cache/report-memos.json
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import JSZip from 'jszip';
import jsQR from 'jsqr';
import Jimp from 'jimp';

const QURAN = 'public/data/quran.json';
const OUT = 'public/data/memos.json';
const REPORT = '.cache/report-memos.json';

// تصحيحات يدوية من صاحب المشروع لما نقص من المذكرات نفسها (كرابط قسم لا رمز QR عنده)
const OVERRIDES = JSON.parse(await readFile('scripts/data/memo-overrides.json', 'utf8'));

// رقم الجزء من اسم المذكرة
const JUZ_NAMES = { الأول: 1, الثاني: 2, الثالث: 3, الرابع: 4, الخامس: 5, السادس: 6, السابع: 7, الثامن: 8, الملك: 29, النبأ: 30 };

const files = (await readdir('.')).filter((f) => f.endsWith('.docx') && f.includes('مذكرة'));
if (!files.length) {
  console.log('لا توجد ملفات المذكرات في جذر المشروع — تُخطّى هذه الخطوة، ويبقى', OUT, 'كما هو.');
  process.exit(0);
}

const quran = JSON.parse(await readFile(QURAN, 'utf8'));
const { verses, suras } = quran;
const verseAt = new Map(verses.map((v, i) => [`${v.s}:${v.a}`, i]));

// ---------- التطبيع للمطابقة ----------
// يُسقط التشكيل وعلامات الضبط، ويوحّد صور الألف والياء والتاء المربوطة والهمزات.
// (المحارف برموزها الصريحة: علامات التشكيل لا تُرى في المحرّر ويُعاد ترتيبها عند الكتابة)
const norm = (s) =>
  s
    .normalize('NFC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '')
    .replace(/[^ء-ي]+/g, ' ')
    .trim();
// أرخى منه: يُسقط حروف المدّ أيضًا، لاختلاف الرسم («الصلوة» و«الصلاة»)
const loose = (s) => norm(s).replace(/[اوي]/g, '').replace(/\s+/g, ' ');

const verseNorm = verses.map((v) => ` ${norm(v.e)} `);
const verseLoose = verses.map((v) => ` ${loose(v.e)} `);
const toAscii = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

// الآيات (من بين المرشّحة) التي يرد فيها النص
function versesContaining(text, candidates) {
  const a = ` ${norm(text)} `;
  if (a.trim().length < 2) return [];
  let hit = candidates.filter((i) => verseNorm[i].includes(a));
  if (!hit.length) {
    const b = ` ${loose(text)} `;
    if (b.trim().length >= 2) hit = candidates.filter((i) => verseLoose[i].includes(b));
  }
  return hit;
}

// ---------- ربط التوجيه الخالي من الاقتباس بمضمونه ----------
// التوجيهات تتبع ترتيب الآيات، والخالي من الاقتباس يتكلم غالبًا عن الآيات التي تلي التوجيه
// المربوط قبله. فيُبحث بين آية ما قبله وآية ما بعده عن أشبه آية بمضمونه: أكثرها اشتراكًا
// معه في الكلمات، والكلمة النادرة في آيات القسم أثقل من الشائعة، وعند التساوي تُقدَّم
// الآية اللاحقة. فإن لم يشترك مع شيء أُعطي الآية التي تلي آية ما قبله.
const STOP = new Set(['الله', 'الذي', 'الذين', 'التي', 'علي', 'الي', 'عن', 'من', 'في', 'ما', 'لا', 'ان', 'كان', 'هو', 'هم', 'ذلك', 'هذا', 'كل', 'قد', 'او', 'ثم', 'حتي', 'اذا', 'لم', 'لن', 'به', 'له', 'لهم', 'عليه', 'عليهم', 'منه', 'منهم', 'بما', 'مما', 'انه', 'انهم', 'ولا', 'وما', 'فان', 'الا', 'قال', 'قالوا']);
function stem(word) {
  let s = word;
  const pre = s.match(/^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل)/);
  if (pre && s.length - pre[0].length >= 3) s = s.slice(pre[0].length);
  const suf = s.match(/(هما|هم|هن|كم|نا|ها|ون|ين|ات|ه|ك)$/);
  if (suf && s.length - suf[0].length >= 3) s = s.slice(0, -suf[0].length);
  return s;
}
const bag = (text) => new Set(norm(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map(stem));
const verseBags = new Map();
const verseBag = (v) => {
  if (!verseBags.has(v)) verseBags.set(v, bag(verses[v].e));
  return verseBags.get(v);
};

function linkByContent(items, sectionVerses, byContent) {
  const df = new Map();
  for (const v of sectionVerses) for (const w of verseBag(v)) df.set(w, (df.get(w) || 0) + 1);
  const n = sectionVerses.length;
  items.forEach((item, i) => {
    if (item.v.length) return;
    const before = items.slice(0, i).reverse().find((x) => x.v.length && !x.guess);
    const after = items.slice(i + 1).find((x) => x.v.length && !x.guess);
    const lo = before ? sectionVerses.indexOf(before.v.at(-1)) : 0;
    const hi = after ? sectionVerses.indexOf(after.v[0]) : n - 1;
    const range = sectionVerses.slice(lo, Math.max(lo, hi) + 1);
    const words = bag(item.t);
    const bestIn = (candidates) => {
      let best = null;
      let bestScore = 0;
      for (const v of candidates) {
        let score = 0;
        for (const w of verseBag(v)) if (words.has(w)) score += Math.log(1 + n / df.get(w));
        if (score > 0 && score >= bestScore) {
          best = v;
          bestScore = score;
        }
      }
      return [best, bestScore];
    };
    let [best, bestScore] = bestIn(range);
    // المذكرة لا تلتزم ترتيب الآيات دائمًا: إن لم يشترك مع شيء بين جاريه بُحث في القسم كله
    if (best === null) [best, bestScore] = bestIn(sectionVerses);
    if (best === null) best = before && range.length > 1 ? range[1] : range[0];
    item.v = [best];
    item.guess = true;
    byContent.push(`${verses[best].s}:${verses[best].a}${bestScore ? '' : ' (بلا اشتراك)'} ← ${item.t.slice(0, 70)}`);
  });
  for (const item of items) delete item.guess;
}

// ---------- قراءة ملف Word ----------
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

async function readDocx(file) {
  const zip = await JSZip.loadAsync(await readFile(file));
  const xml = await zip.file('word/document.xml').async('string');
  const rels = await zip.file('word/_rels/document.xml.rels').async('string');
  const relMap = Object.fromEntries([...rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const body = xml.slice(xml.indexOf('<w:body>'));
  const tok = /<w:tbl>|<\/w:tbl>|<w:tr[ >]|<w:tc>|<w:tc |<w:p[ >][\s\S]*?<\/w:p>/g;
  const items = [];
  let depth = 0, tbl = -1, row = -1, cell = -1;
  for (const [t] of body.matchAll(tok)) {
    if (t === '<w:tbl>') { depth++; tbl++; row = -1; items.push({ k: 'tbl' }); continue; }
    if (t === '</w:tbl>') { depth--; continue; }
    if (t.startsWith('<w:tr')) { row++; cell = -1; continue; }
    if (t.startsWith('<w:tc')) { cell++; continue; }
    const text = dec([...t.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join('')).replace(/\s+/g, ' ').trim();
    const imgs = [...t.matchAll(/r:embed="(rId\d+)"/g)].map((x) => relMap[x[1]]).filter(Boolean);
    if (!text && !imgs.length) continue;
    items.push(depth ? { k: 'cell', tbl, row, cell, text } : { k: 'p', text, imgs });
  }
  return { zip, items };
}

// فكّ رمز QR من صورة في الملف (مع تكبيرها إن تعذّر)؛ النتيجة رابط يوتيوب أو null
async function decodeQr(zip, target, cache) {
  if (cache.has(target)) return cache.get(target);
  let url = null;
  try {
    const f = zip.file(`word/${target}`);
    if (f && !/\.(svg|emf|wmf)$/i.test(target)) {
      const img = await Jimp.read(await f.async('nodebuffer'));
      let { data, width, height } = img.bitmap;
      let r = jsQR(new Uint8ClampedArray(data), width, height);
      if (!r && width < 600) {
        const big = img.clone().scale(3).bitmap;
        r = jsQR(new Uint8ClampedArray(big.data), big.width, big.height);
      }
      if (r && /youtu/.test(r.data)) url = r.data.trim();
    }
  } catch {
    // صورة لا تُقرأ (زخرفة بصيغة غير مدعومة) — ليست رمزًا
  }
  cache.set(target, url);
  return url;
}

// ---------- عناوين الأقسام ----------
const KINDS = [
  [/^تفسير\s/, 't'],
  [/^معاني كلمات\s/, 'm'],
  [/^العمل ب/, 'a'],
];
const END = /^(نشاط الأسبوع|للاستزادة|مقرر الأسبوع|تصحيح تلاوة|مِنْ فَوَائِدِ|من فوائد|كتابة المقرر)/;

const suraByName = new Map(suras.map((s) => [norm(s.name).replace(/\s/g, ''), s]));

// «تفسير سورة البقرة (١-٧) من التفسير الميسر» → { suras: [2], from: 1, to: 7 }
function parseHeading(text) {
  let rest = text
    .replace(/^(تفسير|معاني كلمات|العمل بالآيات من|العمل ب)\s*/, '')
    .replace(/\s*(من\s+)?(المختصر|التفسير|تفسير)\s.*$/, '')
    .replace(/^(سورتي|سورة)\s*/, '');
  rest = toAscii(rest);
  const range = rest.match(/(\d+)\s*[-–—]\s*(\d+)/) || rest.match(/(\d+)/);
  const names = rest.replace(/[()\d\-–—:]/g, ' ').trim().split(/\s+و(?=ال)/).map((n) => n.trim()).filter(Boolean);
  const found = names.map((n) => suraByName.get(norm(n).replace(/\s/g, '')));
  if (!found.length || found.some((s) => !s)) return null;
  const from = range ? +range[1] : 1;
  const to = range ? +(range[2] ?? range[1]) : null;
  const list = [];
  if (found.length === 1) {
    const s = found[0];
    for (let a = from; a <= (to ?? s.count); a++) list.push(verseAt.get(`${s.n}:${a}`));
  } else {
    for (const s of found) for (let a = 1; a <= s.count; a++) list.push(verseAt.get(`${s.n}:${a}`));
  }
  if (list.some((v) => v === undefined)) return null;
  return { suras: found.map((s) => s.n), verses: list };
}

// ---------- الاستخراج ----------
const report = { memos: [], badHeadings: [], noLink: [], linkOverrides: [], duplicates: [], wordsGuessed: [], itemsByContent: [], fixProblems: [] };
// تصحيحات ربط التوجيهات بآياتها (بمراجعة المحتوى): مفاتيحها مطبّعة لتُقارن ببداية النص
const ACTION_FIXES = Object.fromEntries(Object.entries(OVERRIDES.actions ?? {}).map(([k, refs]) => [norm(k), refs]));
const usedFixes = new Set();
const sections = []; // { k, juz, r: [[أول آية، آخر آية], ...], link }
// آيات القسم مقاطعَ متصلة: فقسم «التين والقدر» مقطعان تتوسطهما العلق (وهي أسبوع آخر)
const toRanges = (list) => {
  const out = [];
  for (const v of [...list].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
};
const meanings = []; // [رقم الآية، الكلمة، المعنى، رقم القسم]
const actions = []; // { t, v: [أرقام الآيات], s: رقم القسم }
const coveredBy = new Map(); // آية → جزء المذكرة التي غطّتها (لمنع التكرار)

// المذكرات بترتيب الأجزاء، فيُحسم التكرار لصالح مذكرة جزء الآية نفسه
// الكلمة التي تلي «الجزء» أو «جزء» وحدها: فاسم «الجزء الثامن (الحزب الأول)» فيه «الأول» أيضًا
const memoJuz = (f) => JUZ_NAMES[(f.match(/(?:الجزء|جزء)\s+(\S+?)(?:\.docx|\s|$)/) || [])[1]];
files.sort((a, b) => memoJuz(a) - memoJuz(b));

for (const file of files) {
  const juz = memoJuz(file);
  const { zip, items } = await readDocx(file);
  const qrCache = new Map();
  const stat = { memo: file.replace(/^[\u200F\s]+/, '').replace('.docx', ''), juz, t: 0, m: 0, a: 0 };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.k !== 'p') continue;
    const kind = KINDS.find(([re]) => re.test(it.text))?.[1];
    if (!kind) continue;

    const head = parseHeading(it.text);
    if (!head) {
      report.badHeadings.push(`${stat.memo}: ${it.text}`);
      continue;
    }
    // القسم لآيات جزء آخر غطّته مذكرة ذلك الجزء (كالفاتحة في مذكرة جزء النبأ): يُترك
    const own = head.verses.every((v) => verses[v].j === juz);
    if (!own && head.verses.every((v) => coveredBy.has(`${kind}:${v}`))) {
      report.duplicates.push(`${stat.memo}: ${it.text} (سبقت في مذكرة الجزء ${coveredBy.get(`${kind}:${head.verses[0]}`)})`);
      continue;
    }

    // الرابط: رمز QR في فقرة العنوان، أو في الفقرتين التاليتين (كأول سورة في قسم يجمع سورًا)
    let link = null;
    for (let j = i; j < Math.min(items.length, i + 3) && !link; j++) {
      const p = items[j];
      if (j > i && (p.k !== 'p' || KINDS.some(([re]) => re.test(p.text)) || END.test(p.text))) break;
      for (const img of p.imgs || []) {
        link = await decodeQr(zip, img, qrCache);
        if (link) break;
      }
    }
    // تصحيحات صاحب المشروع (بمفتاح «نوع سورة:من-إلى») تتقدّم على رمز المذكرة: لما لا رمز له،
    // ولما أشار رمزه في المذكرة إلى فيديو قسم آخر خطأً
    {
      const first = verses[head.verses[0]];
      const last = verses[head.verses.at(-1)];
      const key = `${kind} ${first.s}:${first.a}-${last.s === first.s ? '' : last.s + ':'}${last.a}`;
      const fixed = OVERRIDES.links?.[key];
      if (fixed) {
        report.linkOverrides.push(`${key} ← ${fixed}${link && link !== fixed ? ` (بدل رمز المذكرة ${link})` : ''}`);
        link = fixed;
      } else if (!link) report.noLink.push(`${stat.memo}: ${it.text} (مفتاح التصحيح: ${key})`);
    }

    const sIdx = sections.length;
    sections.push({ k: kind, juz, r: toRanges(head.verses), link });
    head.verses.forEach((v) => coveredBy.set(`${kind}:${v}`, juz));
    stat[kind]++;

    // محتوى القسم: حتى العنوان التالي أو علامة نهاية
    let j = i + 1;
    const body = [];
    for (; j < items.length; j++) {
      const p = items[j];
      if (p.k === 'p' && (KINDS.some(([re]) => re.test(p.text)) || END.test(p.text))) break;
      body.push(p);
    }

    if (kind === 'm') {
      // صفوف الجدول: الخلية الأولى الكلمة، والثانية معناها (وقد تتعدد فقرات الخلية)
      const rows = new Map();
      for (const c of body) {
        if (c.k !== 'cell') continue;
        const key = `${c.tbl}:${c.row}`;
        if (!rows.has(key)) rows.set(key, ['', '']);
        const r = rows.get(key);
        if (c.cell <= 1) r[c.cell] = (r[c.cell] + ' ' + c.text).trim();
      }
      let pointer = 0; // الجدول يتبع ترتيب الآيات: يُبحث من آية الكلمة السابقة فصاعدًا
      for (const [word, meaning] of rows.values()) {
        if (!word || !meaning || /^الكلمة$/.test(word)) continue;
        const later = head.verses.slice(pointer);
        let hit = versesContaining(word, later);
        if (!hit.length) hit = versesContaining(word, head.verses);
        if (!hit.length) {
          // تعذّرت العبارة كاملة لاختلاف رسم كلمة فيها («ياليتها» في النص الإملائي متصلة):
          // تُطابَق بأطول كلماتها، واحدة بعد أخرى
          const parts = norm(word).split(' ').filter((x) => x.length >= 3).sort((a, b) => b.length - a.length);
          for (const part of parts) {
            hit = versesContaining(part, later);
            if (!hit.length) hit = versesContaining(part, head.verses);
            if (hit.length) break;
          }
        }
        let v;
        if (hit.length) v = hit[0];
        else {
          v = head.verses[pointer];
          report.wordsGuessed.push(`${verses[v].s}:${verses[v].a} «${word}»`);
        }
        pointer = Math.max(pointer, head.verses.indexOf(v));
        meanings.push([v, word, meaning, sIdx]);
      }
    }

    if (kind === 'a') {
      let prev = null;
      const sectionItems = [];
      for (const p of body) {
        if (p.k !== 'p' || !p.text) continue;
        const text = p.text.replace(/^[•\-–\s]+/, '');
        const quotes = [...text.matchAll(/﴿([^﴾]+)﴾/g)].map((m) => m[1]);
        if (!quotes.length) {
          // اقتباس بين قوسين عاديين، كقوله: (ومما رزقناهم ينفقون)
          for (const m of text.matchAll(/\(([^()]{6,})\)/g)) if (versesContaining(m[1], head.verses).length) quotes.push(m[1]);
        }
        const linked = new Set();
        for (const q of quotes) {
          // أرقام الآيات داخل الاقتباس، وقد يجمع آيات متتالية: ﴿… (١) … (٢)﴾ — فتُربط كلها
          const nums = [...toAscii(q).matchAll(/\((\d+)\)/g)].map((m) => +m[1]);
          if (nums.length && head.suras.length === 1) {
            const vs = nums.map((n) => verseAt.get(`${head.suras[0]}:${n}`)).filter((v) => v !== undefined && head.verses.includes(v));
            if (vs.length) {
              vs.forEach((v) => linked.add(v));
              continue;
            }
          }
          // بلا رقم (أو في قسم يجمع سورًا): يُطابَق كل مقطع من الاقتباس بنصّه
          const segments = q.split(/\([\d٠-٩]+\)/).map((s) => s.trim()).filter((s) => norm(s).includes(' ') || norm(s).length > 3);
          for (const seg of segments.length ? segments : [q]) {
            const hit = versesContaining(seg, head.verses);
            if (hit.length) linked.add(prev != null ? hit.find((v) => v >= prev) ?? hit[0] : hit[0]);
          }
        }
        const item = { t: text, v: [...linked].sort((a, b) => a - b), s: sIdx };
        if (item.v.length) prev = item.v.at(-1);
        sectionItems.push(item);
        actions.push(item);
      }
      // التوجيهات الخالية من الاقتباس: تُربط بأشبه آية بمضمونها بين ما قبلها وما بعدها
      linkByContent(sectionItems, head.verses, report.itemsByContent);
      // ثم تصحيحات المراجعة: التوجيه يُعرف ببداية نصّه (بلا تشكيل)، ويُعطى آياته المذكورة
      for (const item of sectionItems) {
        const text = norm(item.t);
        const key = Object.keys(ACTION_FIXES).find((k) => text.startsWith(k));
        if (!key) continue;
        // وقد تتكرر بداية التوجيه في قسم آخر: فلا يُطبَّق التصحيح إلا حيث آياته من آيات القسم
        const vs = ACTION_FIXES[key].map((ref) => verseAt.get(ref)).filter((v) => v !== undefined && head.verses.includes(v));
        if (vs.length !== ACTION_FIXES[key].length) continue;
        item.v = vs;
        usedFixes.add(key);
      }
    }
  }
  report.memos.push(stat);
}

// ---------- الكلمة بلفظها من المصحف ----------
// جدول المعاني يكتب الكلمة بالرسم الإملائي («ذلك الكتاب»)، وتُعرض بلفظها من المصحف
// («ذَٰلِكَ ٱلۡكِتَٰبُ»): أقصر تتابع من كلمات الآية يطابقها هيكلًا. فيُلحق بصفّ الكلمة
// موضعُها في كلمات الآية [من، إلى]، وإلا عُرضت كما كُتبت في المذكرة.
// (والحرف المكرّر حرف واحد: «الليل» في المصحف بلام واحدة «ٱلَّيۡلِ»)
const tight = (s) => loose(s).replace(/\s+/g, '').replace(/(.)\1+/g, '$1');
let wordsFromMushaf = 0;
for (const row of meanings) {
  const [v, word] = row;
  const toks = verses[v].t.slice(0, -1);
  const target = tight(word);
  if (!target) continue;
  let span = null;
  for (let len = 1; len <= Math.min(8, toks.length) && !span; len++) {
    for (let a = 0; a + len <= toks.length; a++) {
      if (tight(toks.slice(a, a + len).join(' ')) === target) {
        span = [a, a + len - 1];
        break;
      }
    }
  }
  if (span) {
    row.push(span[0], span[1]);
    wordsFromMushaf++;
  }
}
report.wordsFromMushaf = wordsFromMushaf;

// ---------- الإخراج ----------
const weeks = sections.filter((s) => s.k === 't').flatMap((s) => s.r.map((x) => [...x])).sort((a, b) => a[0] - b[0]);
report.weekOverlaps = weeks.filter((w, i) => i && w[0] <= weeks[i - 1][1]).map((w) => `${verses[w[0]].s}:${verses[w[0]].a}`);
const data = {
  v: 1,
  source: 'مذكرات حلقات حفظ القرآن بطريقة السلف',
  // الأقسام: k نوعها (t تفسير، m معاني، a عمل)، juz جزء المذكرة، r مقاطع آياته المتصلة
  // [[أول آية، آخر آية]] بترقيم الآيات في المصحف، link رابط يوتيوب القسم
  sections,
  // مقررات الأسابيع: مقاطع متصلة بترتيب المصحف (لكل أسبوع قسم تفسير واحد، وقد يكون مقطعين).
  // يُلوَّن في المصحف ما كان ترتيبه زوجيًّا (الأول ملوّن)، فتتناوب المقررات لونًا وبياضًا
  weeks,
  meanings,
  actions,
};
const json = JSON.stringify(data);
await mkdir('.cache', { recursive: true });
await writeFile(OUT, json);

// ---------- تقرير التغطية ----------
const covered = new Set();
for (const s of sections) for (const [a, b] of s.r) for (let v = a; v <= b; v++) covered.add(v);
console.log(`مقررات الأسابيع (مقاطع بترتيب المصحف): ${weeks.length} · متداخلة: ${report.weekOverlaps.length}`);
const withMeaning = new Set(meanings.map((m) => m[0]));
const withAction = new Set(actions.flatMap((a) => a.v));
const ranges = (list) => {
  const out = [];
  for (const v of list.sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out.map(([a, b]) => (a === b ? `${verses[a].s}:${verses[a].a}` : `${verses[a].s}:${verses[a].a}–${verses[b].s === verses[a].s ? '' : verses[b].s + ':'}${verses[b].a}`));
};
const byJuz = {};
for (const v of covered) {
  const j = verses[v].j;
  byJuz[j] ??= { verses: 0, meanings: 0, actions: 0, noMeaning: [], noAction: [] };
  const b = byJuz[j];
  b.verses++;
  if (withMeaning.has(v)) b.meanings++; else b.noMeaning.push(v);
  if (withAction.has(v)) b.actions++; else b.noAction.push(v);
}
const juzReport = Object.fromEntries(Object.entries(byJuz).map(([j, b]) => [j, { ...b, noMeaning: ranges(b.noMeaning), noAction: ranges(b.noAction) }]));
await writeFile(REPORT, JSON.stringify({ ...report, juz: juzReport }, null, 2));

console.log('═══ تقرير المذكرات ═══');
for (const m of report.memos) console.log(`  ${m.memo}: تفسير ${m.t} · معاني ${m.m} · عمل ${m.a}`);
console.log(`الأقسام: ${sections.length} · الكلمات: ${meanings.length} · التوجيهات: ${actions.length}`);
console.log(`كلمات المعاني بلفظها من المصحف: ${report.wordsFromMushaf} من ${meanings.length}`);
console.log(`عناوين لم تُفهم: ${report.badHeadings.length}`); report.badHeadings.forEach((b) => console.log(`   ! ${b}`));
console.log(`أقسام بلا رابط: ${report.noLink.length}`); report.noLink.forEach((b) => console.log(`   ! ${b}`));
console.log(`أقسام مكرّرة تُركت: ${report.duplicates.length}`); report.duplicates.forEach((b) => console.log(`   · ${b}`));
console.log(`كلمات لم يوجد نصّها في آيات قسمها (رُبطت بآية ما قبلها): ${report.wordsGuessed.length}  ${report.wordsGuessed.slice(0, 12).join(' ')}`);
console.log(`روابط من تصحيحات صاحب المشروع: ${report.linkOverrides.length}`); report.linkOverrides.forEach((b) => console.log(`   + ${b}`));
const unusedFixes = Object.keys(ACTION_FIXES).filter((k) => !usedFixes.has(k));
console.log(`تصحيحات ربط التوجيهات: طُبّق ${usedFixes.size} من ${Object.keys(ACTION_FIXES).length}${unusedFixes.length ? ' — لم يُطابَق: ' + unusedFixes.join(' | ') : ''}${report.fixProblems.length ? ' — مشكلات: ' + report.fixProblems.join(' | ') : ''}`);
const noOverlap = report.itemsByContent.filter((x) => x.includes('بلا اشتراك')).length;
console.log(`توجيهات بلا اقتباس رُبطت بمضمونها: ${report.itemsByContent.length} (منها ${noOverlap} بلا اشتراك في الكلمات، فأُعطيت الآية التالية)`);
console.log('التغطية بالجزء (آيات مغطّاة · لها معانٍ · لها عمل):');
for (const [j, b] of Object.entries(juzReport)) console.log(`  الجزء ${j}: ${b.verses} · ${b.meanings} · ${b.actions}`);
console.log(`حجم الملف: ${(json.length / 1024).toFixed(0)} ك.ب → ${OUT}`);
