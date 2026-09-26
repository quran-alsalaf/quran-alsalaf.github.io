// الخطوة ١: جلب خريطة الأسطر — رقم السطر لكل كلمة في صفحات المصحف الـ٦٠٤.
//
// لماذا: ملف مجمع الملك فهد يذكر سطر بداية الآية وسطر نهايتها فقط، ولا يذكر
// أي كلمة تقع في أي سطر، و٧١٪ من الآيات تمتد عبر أكثر من سطر. فرقم السطر
// لكل كلمة يُؤخذ من تخطيط طبعة المجمع الرقمية (١٥ سطرًا) عبر واجهة Quran.com للمطوّرين.
//
// يُحفظ كل ما يُجلب في .cache/qdc19/pages، فإعادة التشغيل لا تعيد
// التنزيل، وتكمل من حيث توقفت إن انقطع الاتصال.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';

// تخطيط أسطر مصحف المدينة كما في طبعة مجمع الملك فهد الرقمية التي بُني عليها ملف
// hafsData_v2-0 — وهو في واجهة qdc برقم mushaf=19. جُرّبت أرقام الطبعات من ١ إلى ٢٢
// على أصعب الصفحات فلم يطابق أسطرَ المجمع تمامًا غيره (٥٠ آية من ٥٠). أما mushaf=1
// (طبعة ١٤٢١هـ) فخالفته في ٧٨ صفحة، والواجهة القديمة api.quran.com/api/v4 تتجاهل
// اختيار الطبعة أصلًا وتعطي تخطيط طبعة ١٤٠٥هـ.
const OUT = '.cache/qdc19/pages';
const API = 'https://api.qurancdn.com/api/qdc/verses/by_page';
const MUSHAF = 19;
const CONCURRENCY = 6;
const RETRIES = 5;

await mkdir(OUT, { recursive: true });

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} (لا يُعاد)`);
      return await res.json();
    } catch (err) {
      if (attempt === RETRIES || String(err.message).includes('لا يُعاد')) throw err;
      await sleep(600 * 2 ** attempt);
    }
  }
}

async function fetchPage(p) {
  const file = `${OUT}/${String(p).padStart(3, '0')}.json`;
  if (await exists(file)) return 'مخزَّن';

  const verses = [];
  let k = 1;
  // الصفحة الواحدة قد تزيد آياتها على حدّ الطلب الواحد، فيُتابع ترقيم النتائج
  for (;;) {
    const url =
      `${API}/${p}?words=true&word_fields=line_number,page_number,text_uthmani` +
      `&per_page=50&page=${k}&mushaf=${MUSHAF}`;
    const j = await getJson(url);
    for (const v of j.verses) {
      verses.push({
        key: v.verse_key,
        words: v.words.map((w) => ({
          pos: w.position,
          type: w.char_type_name,
          line: w.line_number,
          page: w.page_number,
          text: w.text_uthmani,
        })),
      });
    }
    const next = j.pagination?.next_page;
    if (!next) break;
    k = next;
  }

  await writeFile(file, JSON.stringify({ page: p, verses }));
  return `${verses.length} آية`;
}

const pages = Array.from({ length: 604 }, (_, i) => i + 1);
let done = 0;
const failed = [];

async function worker() {
  while (pages.length) {
    const p = pages.shift();
    try {
      await fetchPage(p);
    } catch (err) {
      failed.push(`${p}: ${err.message}`);
    }
    done++;
    if (done % 50 === 0 || done === 604) console.log(`  ${done}/604`);
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nانتهى في ${((Date.now() - t0) / 1000).toFixed(0)} ثانية.`);
if (failed.length) {
  console.log(`فشل ${failed.length} صفحة:\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('كل الصفحات الـ٦٠٤ جُلبت بنجاح.');
}
