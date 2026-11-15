// أدوات مشتركة لتفاسير مشروع المصحف الإلكتروني «آيات» بجامعة الملك سعود (quran.ksu.edu.sa)،
// تستعملها الخطوة ١٠ (السعدي) والخطوة ١١ (البغوي)، ويُضاف بها ابن كثير والطبري لاحقًا.
//
// الجلب آيةً آية: /interface.php?ui=pc&do=tafsir&author={المؤلف}&sura={س}&aya={آ}
// والجواب: نص الآية ثم «|||» ثم التفسير في <p>. وكل جواب يُحفظ في .cache/ksu/{المؤلف}، فإعادة
// التشغيل لا تعيد التنزيل. والخادم بطيء ويقطع الاتصال أحيانًا («Empty reply»)، فتُعاد المحاولة.
//
// والتفاسير التي تُحمَّل بزرّ (٢٠٢٦-١١-١٥) تُكتب ملفًّا لكل سورة: public/data/tafsir/{id}/{س}.json
// فيه { verses: [تفسير الآية ١، ٢، …] }، ولا يحفظها عامل الخدمة مسبقًا (vite.config.js)، بل يحمّلها
// المستخدم من قائمة التفاسير (src/lib/tafsirDownload.js).
import { readFile, writeFile, mkdir, access, rm, stat, readdir } from 'node:fs/promises';

export const QURAN = 'public/data/quran.json';
const URL_OF = (author, s, a) => `https://quran.ksu.edu.sa/interface.php?ui=pc&do=tafsir&author=${author}&sura=${s}&aya=${a}`;

const exists = (p) => access(p).then(() => true, () => false);

async function fetchOne(author, cache, s, a) {
  const file = `${cache}/${s}-${a}.txt`;
  if (await exists(file)) return readFile(file, 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(URL_OF(author, s, a), { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('|||')) throw new Error('جواب غير متوقع');
      await writeFile(file, text);
      return text;
    } catch (err) {
      if (attempt >= 12) throw new Error(`${s}:${a} — ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * Math.min(attempt, 6)));
    }
  }
}

// أجوبة كل الآيات بترتيب المصحف (الفهرس نفسه في quran.verses)
export async function fetchAll(author, quran, workers = 6) {
  const cache = `.cache/ksu/${author}`;
  await mkdir(cache, { recursive: true });
  const raws = new Array(quran.verses.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < quran.verses.length) {
      const i = next++;
      const { s, a } = quran.verses[i];
      raws[i] = await fetchOne(author, cache, s, a);
      if (++done % 500 === 0) console.log(`… ${done}/${quran.verses.length}`);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  return raws;
}

// يكتب التفسير ملفًّا لكل سورة، ويعيد الحجم الكلي بالبايت (يُكتب في TAFSIR_SOURCES ويطابقه اختبار)
export async function writeSplit(id, quran, verses) {
  const dir = `public/data/tafsir/${id}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const bySura = quran.suras.map(() => []);
  verses.forEach((t, i) => bySura[quran.verses[i].s - 1].push(t));
  let bytes = 0;
  for (let s = 1; s <= bySura.length; s++) {
    const json = JSON.stringify({ verses: bySura[s - 1] });
    bytes += Buffer.byteLength(json);
    // eslint-disable-next-line no-await-in-loop
    await writeFile(`${dir}/${s}.json`, json);
  }
  return bytes;
}

// الحجم الكلي لملفات تفسير مكتوب (للتقرير)
export async function splitBytes(id) {
  const dir = `public/data/tafsir/${id}`;
  let bytes = 0;
  for (const f of await readdir(dir)) bytes += (await stat(`${dir}/${f}`)).size;
  return bytes;
}

export { exists };
