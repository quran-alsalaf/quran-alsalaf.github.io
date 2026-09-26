// الخطوة ٥: خطوط صفحات المجمع (الإصدار الرابع) ورموز كلماتها — وبها يُرسم المصحف.
//
// لماذا: خط المجمع العام لا يمدّ الحروف، فكانت الأسطر تمتلئ بتوسيع الفراغات بين الكلمات.
// أما خطوط الصفحات فلكل صفحة خطها، وكل كلمة فيه رمز واحد مرسوم بيد الخطّاط بمدّاته،
// فيمتلئ السطر كما في المطبوع. والإصدار الرابع مرسوم على الطبعة الحالية نفسها
// (أسطر mushaf=19 التي بُنيت عليها خريطة أسطرنا)، وعرض أعرض سطر في كل صفحة متقارب
// (15.75–17.00em)، فحجم خط واحد يسع الصفحات كلها.
//
// المخرجات:
//   public/fonts/qcf4/p{N}.woff2    خط كل صفحة؛ يُنزَّل في التطبيق عند فتح الصفحة ويُحفظ
//   public/fonts/surah-header.woff2 إطار اسم السورة (خط عناوين السور للمجمع)، رمز لكل سورة
//   public/fonts/basmala.woff2      كلمات البسملة الأربع (من خط البسملة للمجمع، الإصدار الرابع)
//   public/data/qcf4.json           لكل سطر نصّ: عرضه بوحدة em، وكلماته [رقم الآية، رمز الكلمة]
//
// يُحفظ كل ما يُنزَّل في .cache/qcf4، فإعادة التشغيل لا تعيد التنزيل.
import { mkdir, readFile, writeFile, access, copyFile } from 'node:fs/promises';
import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';

const CACHE = '.cache/qcf4';
const QURAN = 'public/data/quran.json';
const OUT = 'public/data/qcf4.json';
const FONTS_OUT = 'public/fonts/qcf4';

// خطوط الصفحات: النسخة التي يستعملها Quran.com اليوم (الأحدث). ونسخة static.qurancdn.com/…/v4/woff2
// أقدم: صفحتها ٣٣٧ لا توافق أسطرها، وتنقصها علامة الربع «۞».
const PAGE_FONT = (p) => `https://quran.com/fonts/quran/hafs/v4/colrv1/woff2/p${p}.woff2`;
const CODES = (p, k) =>
  `https://api.qurancdn.com/api/qdc/verses/by_page/${p}?words=true&word_fields=line_number,code_v2&per_page=50&page=${k}&mushaf=19`;
const HEADER_FONT = 'https://static-cdn.tarteel.ai/qul/fonts/surah-names/surah-header/QCF_SurahHeader_COLOR-Regular.ttf';
const BASMALA_FONT = 'https://raw.githubusercontent.com/mustafa0x/qpc-fonts/master/mushaf-v4-hafs/QCF4_QBSML.ttf';

// كلمات البسملة في خط البسملة: بسم (بسين ممدودة)، الله، الرحمن (بنون ممدودة)، الرحيم
const BASMALA = [0xfad5, 0xfad6, 0xfad7, 0xfad8];
// رمز إطار كل سورة في خط العناوين (من جدول QUL: qul.tarteel.ai/resources/font/458)
const HEADER_MAP = JSON.parse(await readFile('scripts/data/surah-header-map.json', 'utf8'));

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, file, as = 'buffer') {
  if (!(await exists(file))) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        break;
      } catch (err) {
        if (attempt === 5) throw new Error(`${url}: ${err.message}`);
        await sleep(600 * 2 ** attempt);
      }
    }
  }
  const buf = await readFile(file);
  return as === 'json' ? JSON.parse(buf.toString('utf8')) : buf;
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

await mkdir(`${CACHE}/fonts`, { recursive: true });
await mkdir(`${CACHE}/codes`, { recursive: true });
await mkdir(FONTS_OUT, { recursive: true });

const PAGES = Array.from({ length: 604 }, (_, i) => i + 1);

// ---------- التنزيل ----------
console.log('تنزيل خطوط الصفحات ورموز كلماتها…');
const codes = new Map();
await pool(PAGES, 8, async (p) => {
  await download(PAGE_FONT(p), `${CACHE}/fonts/p${p}.woff2`);
  const verses = [];
  for (let k = 1; ; k++) {
    const j = await download(CODES(p, k), `${CACHE}/codes/${p}-${k}.json`, 'json');
    verses.push(...j.verses);
    if (!j.pagination?.next_page) break;
  }
  codes.set(p, verses);
});
const headerTtf = await download(HEADER_FONT, `${CACHE}/QCF_SurahHeader_COLOR-Regular.ttf`);
const basmalaTtf = await download(BASMALA_FONT, `${CACHE}/QCF4_QBSML.ttf`);

// ---------- البناء ----------
const quran = JSON.parse(await readFile(QURAN, 'utf8'));
const verseIndex = new Map(quran.verses.map((v, i) => [`${v.s}:${v.a}`, i]));

const report = { words: 0, missingGlyphs: [], lineMismatch: [], versesSeen: 0 };
let widest = 0;
const pagesOut = [];

for (const p of PAGES) {
  const font = fontkit.create(await readFile(`${CACHE}/fonts/p${p}.woff2`));
  const lines = quran.pages[p - 1];
  const out = lines.map((ln) => (ln.g ? { w: 0, k: [] } : null));

  // الصفحتان الأوليان: الخريطة ترقّم أسطرهما على شبكة ١٥ سطرًا وملفنا من ١ إلى ٨،
  // فالفرق يُحسب من البيانات نفسها (أول سطر نصّ هنا وهناك)
  const verses = codes.get(p);
  const words = verses.flatMap((v) => v.words.map((w) => ({ ...w, key: v.verse_key })));
  const firstOurs = lines.findIndex((ln) => ln.g) + 1;
  const shift = p <= 2 ? Math.min(...words.map((w) => w.line_number)) - firstOurs : 0;
  report.versesSeen += verses.length;

  for (const w of words) {
    const vi = verseIndex.get(w.key);
    const slot = out[w.line_number - shift - 1];
    if (vi === undefined || !slot) throw new Error(`كلمة خارج أسطر النص: صفحة ${p} سطر ${w.line_number} (${w.key})`);
    for (const ch of w.code_v2) {
      if (!font.hasGlyphForCodePoint(ch.codePointAt(0))) report.missingGlyphs.push(`${p}:${w.key}`);
    }
    slot.k.push([vi, w.code_v2]);
    report.words++;
  }

  out.forEach((slot, i) => {
    if (!slot) return;
    // عرض السطر بوحدة em: مجموع عروض رموزه كما صمّمها الخطّاط
    const units = [...slot.k.map((x) => x[1]).join('')].reduce(
      (s, ch) => s + font.glyphForCodePoint(ch.codePointAt(0)).advanceWidth,
      0
    );
    slot.w = Math.round((units / font.unitsPerEm) * 1000) / 1000;
    if (p > 2) widest = Math.max(widest, slot.w);
    // الآيات في السطر يجب أن تكون هي آيات السطر نفسه في خريطة أسطرنا
    const ours = [...new Set(lines[i].g.map((s) => s[0]))].join(',');
    const theirs = [...new Set(slot.k.map((x) => x[0]))].join(',');
    if (!slot.k.length || ours !== theirs) report.lineMismatch.push(`${p}:${i + 1} (${ours} ≠ ${theirs})`);
  });
  pagesOut.push(out);

  await copyFile(`${CACHE}/fonts/p${p}.woff2`, `${FONTS_OUT}/p${p}.woff2`);
}

// خط العناوين وخط البسملة: يُبقى منهما ما يُستعمل فقط، بصيغة woff2
const headerChars = Object.values(HEADER_MAP).map((h) => String.fromCodePoint(parseInt(h, 16))).join('');
await writeFile('public/fonts/surah-header.woff2', await subsetFont(headerTtf, headerChars, { targetFormat: 'woff2' }));
await writeFile('public/fonts/basmala.woff2', await subsetFont(basmalaTtf, String.fromCodePoint(...BASMALA), { targetFormat: 'woff2' }));
const hf = fontkit.create(headerTtf);
const headerEm = hf.glyphForCodePoint(parseInt(HEADER_MAP[1], 16)).advanceWidth / hf.unitsPerEm;

const data = {
  v: 1,
  source: 'خطوط صفحات مجمع الملك فهد لطباعة المصحف الشريف — الإصدار الرابع',
  widest: Math.round(widest * 1000) / 1000,
  headerEm: Math.round(headerEm * 10000) / 10000,
  header: Object.fromEntries(Object.entries(HEADER_MAP).map(([s, h]) => [s, parseInt(h, 16)])),
  basmala: BASMALA,
  pages: pagesOut,
};
const json = JSON.stringify(data);
await writeFile(OUT, json);

// ---------- التقرير ----------
const kb = async (f) => `${((await readFile(f)).length / 1024).toFixed(0)} ك.ب`;
console.log('═══ تقرير خطوط الصفحات ═══');
console.log(`الآيات المقروءة: ${report.versesSeen}/${quran.verses.length} · الكلمات: ${report.words}`);
console.log(`رموز بلا شكل في خط صفحتها: ${report.missingGlyphs.length}  ${report.missingGlyphs.slice(0, 10).join(' ')}`);
console.log(`أسطر لا توافق آياتُها خريطةَ أسطرنا: ${report.lineMismatch.length}  ${report.lineMismatch.slice(0, 10).join(' ')}`);
console.log(`أعرض سطر في المصحف (الصفحات ٣–٦٠٤): ${data.widest}em · عرض إطار السورة ${data.headerEm}em`);
console.log(`خط العناوين ${await kb('public/fonts/surah-header.woff2')} · خط البسملة ${await kb('public/fonts/basmala.woff2')} · ${OUT} ${(json.length / 1024).toFixed(0)} ك.ب`);
if (report.versesSeen !== quran.verses.length || report.missingGlyphs.length || report.lineMismatch.length) process.exitCode = 1;
