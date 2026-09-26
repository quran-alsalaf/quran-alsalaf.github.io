// الخطوة ٤: «المختصر في تفسير القرآن الكريم» — تفسير كل آية، و«من مقاصد السورة»،
// و«من فوائد الآيات» لكل صفحة.
//
// المصادر (كلها من موسوعة القرآن الكريم quranenc.com، إصدار arabic_mokhtasar):
//   • تفسير الآيات: قاعدة البيانات الرسمية للتنزيل — طوبقت حرفيًّا بمذكرة النبأ
//   • الفوائد: مقطع كل صفحة مصحف (/browse/arabic_mokhtasar/{سورة}-{ترتيب الصفحة}_)
//   • المقاصد: صفحة كل سورة (/ar/browse/arabic_mokhtasar/{سورة})
// وقاعدة البيانات خالية من المقاصد والفوائد، فتؤخذان من صفحات الموقع.
//
// كل ما يُنزَّل يُحفظ في .cache/quranenc، فإعادة التشغيل لا تعيد التنزيل.
//
// ولماذا quranenc لا نسخة الشاملة (١٨١٠٢) مصدرًا أساسيًّا:
//   • مذكرات صاحب المشروع تنقل «من مقاصد السورة» من المختصر، فطوبقت بالمصدرين:
//     ٤٨ من ٥١ تطابق نص quranenc حرفيًّا (والثلاث الباقية فروق تحريرية لا تمسّ المعنى)،
//     ومنها مقاصد النبأ التي يختلف فيها نص الشاملة — فquranenc هي طبعة المذكرات نفسها.
//   • ونسخة الشاملة فيها أخطاء طباعية ظاهرة: «ينفخ الملك في الفرن» (القرن)،
//     و«اليعث» (البعث)، ورقم آية مكرر في النبأ، و«اللحم الطبري» (الطري) في الكهف.
//   • وطوبقت الفوائد بالشاملة في الصفحات ٣ و٤ و١٠٠ و٣٠٠ و٥٨٢ و٦٠٣ و٦٠٤ فكانت هي هي،
//     عدا تصحيحات quranenc لأخطاء الشاملة.
//   • ويخلو المختصر في quranenc من جمل الربط بين المقاطع («ولما بيَّن الله... فقال:»)
//     التي في الكتاب المطبوع؛ فهي غير معروضة في التطبيق.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const QURAN = 'public/data/quran.json';
const DB = '.cache/quranenc/arabic_mokhtasar.sqlite';
const FRAG = '.cache/quranenc/frag';
const SURA = '.cache/quranenc/sura';
const OUT = 'public/data/tafsir-mukhtasar.json';
const REPORT = '.cache/report-mukhtasar.json';
const CONCURRENCY = 4;

await mkdir(FRAG, { recursive: true });
await mkdir(SURA, { recursive: true });

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url, file) {
  if (await exists(file)) return readFile(file, 'utf8');
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(file, html);
      return html;
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(700 * 2 ** attempt);
    }
  }
}

async function pool(items, fn) {
  const queue = [...items];
  const failed = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const it = queue.shift();
        try {
          await fn(it);
        } catch (err) {
          failed.push(`${JSON.stringify(it)}: ${err.message}`);
        }
      }
    })
  );
  return failed;
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- الترتيب: لكل صفحة مصحف، أول سورة فيها وترتيب هذه الصفحة بين صفحات السورة ----------
const quran = JSON.parse(await readFile(QURAN, 'utf8'));
const suraPages = new Map(); // سورة → صفحاتها مرتبة
for (const v of quran.verses) {
  if (!suraPages.has(v.s)) suraPages.set(v.s, []);
  const list = suraPages.get(v.s);
  if (list[list.length - 1] !== v.p) list.push(v.p);
}
const pageFirst = new Map(); // صفحة → { s, k, verses:[مفاتيح آيات هذه السورة في الصفحة] }
for (const v of quran.verses) {
  if (!pageFirst.has(v.p)) pageFirst.set(v.p, { s: v.s, k: suraPages.get(v.s).indexOf(v.p) + 1, keys: [] });
  const pf = pageFirst.get(v.p);
  if (v.s === pf.s) pf.keys.push(`${v.s}:${v.a}`);
}

// ---------- تنزيل مقاطع الصفحات وصفحات السور ----------
const t0 = Date.now();
const fragFailed = await pool([...pageFirst.keys()], async (p) => {
  const { s, k } = pageFirst.get(p);
  await getText(
    `https://quranenc.com/browse/arabic_mokhtasar/${s}-${k}_`,
    `${FRAG}/p${String(p).padStart(3, '0')}.html`
  );
});
const suraFailed = await pool(
  quran.suras.map((s) => s.n),
  async (s) => {
    await getText(`https://quranenc.com/ar/browse/arabic_mokhtasar/${s}`, `${SURA}/${String(s).padStart(3, '0')}.html`);
  }
);
console.log(`التنزيل: ${((Date.now() - t0) / 1000).toFixed(0)} ثانية`);
if (fragFailed.length || suraFailed.length) {
  console.log(`فشل: ${[...fragFailed, ...suraFailed].join('\n  ')}`);
  process.exit(1);
}

// ---------- الاستخراج ----------
const report = { pagesWithFawaid: 0, pagesWithout: [], fawaidItems: 0, maqasid: 0, maqasidMissing: [], verseCheckBad: [] };

const fawaid = {};
for (let p = 1; p <= 604; p++) {
  const html = await readFile(`${FRAG}/p${String(p).padStart(3, '0')}.html`, 'utf8');

  // تأكيد أن المقطع هو المقصود: الآيات فيه هي آيات هذه السورة في هذه الصفحة
  const shown = [...new Set([...html.matchAll(/data-det="saadi\/(\d+)\/(\d+)"/g)].map((m) => `${m[1]}:${m[2]}`))];
  const expected = pageFirst.get(p).keys;
  if (shown.join() !== expected.join()) report.verseCheckBad.push(`${p}: المتوقع ${expected[0]}…${expected.at(-1)} والمعروض ${shown[0] ?? '—'}…${shown.at(-1) ?? '—'}`);

  const at = html.indexOf('من فوائد الآيات في هذه الصفحة');
  if (at < 0) {
    report.pagesWithout.push(p);
    continue;
  }
  const items = [...html.slice(at).matchAll(/<span>([\s\S]*?)<\/span>\s*<a[^>]*data-det="\d+\/fawaed\/\d+"/g)]
    .map((m) => decode(m[1]).replace(/^•\s*/, ''))
    .filter(Boolean);
  if (items.length) {
    fawaid[p] = items;
    report.pagesWithFawaid++;
    report.fawaidItems += items.length;
  } else report.pagesWithout.push(p);
}

const maqasid = {};
for (const { n } of quran.suras) {
  const html = await readFile(`${SURA}/${String(n).padStart(3, '0')}.html`, 'utf8');
  const m = html.match(/من مقاصد السورة:<\/b><\/div>\s*<div class="aligner">\s*<span>([\s\S]*?)<\/span>/);
  if (m) {
    maqasid[n] = decode(m[1]);
    report.maqasid++;
  } else report.maqasidMissing.push(n);
}

// تفسير الآيات من قاعدة البيانات الرسمية، بترتيب المصحف
const db = new DatabaseSync(DB, { readOnly: true });
const get = db.prepare('SELECT translation FROM translations WHERE sura = ? AND aya = ?');
const verses = quran.verses.map((v) => (get.get(v.s, v.a)?.translation ?? '').replace(/\s+/g, ' ').trim());
const emptyVerses = verses.filter((t) => !t).length;

const data = {
  v: 1,
  source: 'المختصر في تفسير القرآن الكريم — مركز تفسير للدراسات القرآنية (عبر quranenc.com)',
  verses,
  fawaid,
  maqasid,
};
const json = JSON.stringify(data);
await writeFile(OUT, json);
await writeFile(REPORT, JSON.stringify({ ...report, emptyVerses, bytes: Buffer.byteLength(json) }, null, 2));

console.log('═══ تقرير المختصر ═══');
console.log(`تفسير الآيات: ${verses.length - emptyVerses}/${verses.length}`);
console.log(`صفحات فيها «من فوائد الآيات»: ${report.pagesWithFawaid}/604 · مجموع الفوائد: ${report.fawaidItems}`);
console.log(`صفحات بلا فوائد: ${report.pagesWithout.length ? report.pagesWithout.join(',') : 'لا شيء'}`);
console.log(`«من مقاصد السورة»: ${report.maqasid}/114${report.maqasidMissing.length ? ' · ناقصة: ' + report.maqasidMissing.join(',') : ''}`);
console.log(`مقاطع لا تطابق آياتها المتوقعة: ${report.verseCheckBad.length}`);
report.verseCheckBad.slice(0, 10).forEach((b) => console.log(`   ✗ ${b}`));
console.log(`حجم الملف الناتج: ${(Buffer.byteLength(json) / 1024).toFixed(0)} ك.ب → ${OUT}`);
