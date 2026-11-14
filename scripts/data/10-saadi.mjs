// الخطوة ١٠: تفسير السعدي («تيسير الكريم الرحمن في تفسير كلام المنان») — ٢٠٢٦-١١-١٤
//
// المصدر: مشروع المصحف الإلكتروني «آيات» بجامعة الملك سعود (quran.ksu.edu.sa)، آيةً آية:
//   /interface.php?ui=pc&do=tafsir&author=saadi&sura={س}&aya={آ}
// والجواب: نص الآية ثم «|||» ثم التفسير في <p>، واقتباسات الآيات فيه <span class="t4">{ … }</span>،
// وزيادات المحقق بين معقوفين <span class="t2">[…]</span>.
//
// لماذا لا Quran.com (ar-tafseer-al-saddi): نسخته مزاحة في مواضع، ففي البقرة ١٠٦ «النسخ: هو النقل…»
// وحده، وتفسير ١٠٦ نفسه («فأخبر الله تعالى عن حكمته في النسخ…») في ١٠٨، ولا شيء لـ١٠٧ و١٠٩ و١١١ و٢٨٦.
// ونسخة «آيات» تضع كل تفسير في آيته، وطوبقت عيّنات منها بنسخة الشاملة (انظر التقرير في آخره).
//
// كل جواب يُحفظ في .cache/ksu/saadi، فإعادة التشغيل لا تعيد التنزيل.
// المعالجة في الشكل وحده: حذف الوسوم، وكتابة الاقتباس ﴿…﴾ بلا مسافتي القوسين، والفاصلة
// والفاصلة المنقوطة اللاتينيتين بين الكلمات العربية عربيتين، وتوحيد المسافات.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const QURAN = 'public/data/quran.json';
const CACHE = '.cache/ksu/saadi';
const OUT = 'public/data/tafsir-saadi.json';
const URL_OF = (s, a) => `https://quran.ksu.edu.sa/interface.php?ui=pc&do=tafsir&author=saadi&sura=${s}&aya=${a}`;
const AR = '؀-ۿ';

// نص التفسير من جواب «آيات» (ما بعد «|||»)، مصدَّرة لتختبرها tests/unit/data.test.js
export function cleanSaadi(raw) {
  const i = raw.indexOf('|||');
  if (i < 0) throw new Error('جواب بلا فاصل «|||»');
  let s = raw.slice(i + 3);
  s = s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    // الاقتباس: «{ نص }» ← «﴿نص﴾»
    .replace(/<span class="t4">\s*\{\s*([\s\S]*?)\s*\}\s*<\/span>/g, '﴿$1﴾')
    .replace(/<[^>]+>/g, '')
    // علامة صفحة الطبعة متروكة في النص: «&; 1-599 &;»
    .replace(/\s*&;\s*[\d-]+\s*&;\s*/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  // علامة الاتجاه (U+200F) المبثوثة في بعض السور، ثم ما بقي من أقواس معقوفة خارج الوسم، وفي
  // النسخة اقتباسات تُفتح بقوس وتُغلق بآخر («{ … ﴾»): فالمعقوفان كلاهما قوسا آية في هذا التفسير
  s = s
    .replace(/\u200f/g, '')
    .replace(/\{\s*/g, '﴿')
    .replace(/\s*\}/g, '﴾')
    .replace(/﴿\s+/g, '﴿')
    .replace(/\s+ْ?﴾/g, '﴾');
  return s
    .split('\n')
    .map((p) =>
      p
        .replace(/[ \t  ]+/g, ' ')
        // الفاصلة والفاصلة المنقوطة اللاتينيتان في النص العربي
        .replace(new RegExp(`([${AR}\\])﴾»)]) ?, ?(?=[${AR}\\[﴿«(])`, 'g'), '$1، ')
        .replace(new RegExp(`([${AR}\\])﴾»)]) ?; ?(?=[${AR}\\[﴿«(])`, 'g'), '$1؛ ')
        // لا مسافة قبل علامة الترقيم
        .replace(/ ([،؛:.؟!])(?!\.)/g, '$1')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

const exists = (p) => access(p).then(() => true, () => false);

async function fetchOne(s, a) {
  const file = `${CACHE}/${s}-${a}.txt`;
  if (await exists(file)) return readFile(file, 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(URL_OF(s, a));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('|||')) throw new Error('جواب غير متوقع');
      await writeFile(file, text);
      return text;
    } catch (err) {
      if (attempt >= 5) throw new Error(`${s}:${a} — ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const quran = JSON.parse(await readFile(QURAN, 'utf8'));
  const raws = new Array(quran.verses.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < quran.verses.length) {
      const i = next++;
      const { s, a } = quran.verses[i];
      raws[i] = await fetchOne(s, a);
      if (++done % 500 === 0) console.log(`… ${done}/${quran.verses.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const verses = raws.map(cleanSaadi);
  const empty = verses.map((t, i) => (t ? null : `${quran.verses[i].s}:${quran.verses[i].a}`)).filter(Boolean);
  const leftover = verses.filter((t) => /[<>{}]|&[a-z]+;/.test(t)).length;
  const json = JSON.stringify({
    v: 1,
    source: 'تيسير الكريم الرحمن في تفسير كلام المنان — عبد الرحمن بن ناصر السعدي (عبر مشروع «آيات» بجامعة الملك سعود)',
    verses,
  });
  await writeFile(OUT, json);

  console.log('═══ تقرير تفسير السعدي ═══');
  console.log(`الآيات: ${verses.length} · بلا تفسير: ${empty.length} ${empty.slice(0, 40).join(' ')}`);
  console.log(`نصوص فيها بقايا وسوم أو أقواس معقوفة: ${leftover}`);
  console.log(`حجم الملف الناتج: ${(Buffer.byteLength(json) / 1024).toFixed(0)} ك.ب → ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
