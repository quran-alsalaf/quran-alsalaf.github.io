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
// كل جواب يُحفظ في .cache/ksu/saadi، فإعادة التشغيل لا تعيد التنزيل (الجلب في scripts/data/ksu.mjs).
// والناتج ملف لكل سورة في public/data/tafsir/saadi (٢٠٢٦-١١-١٥: صار السعدي يُحمَّل بزرّ، وكان ملفًّا
// واحدًا يحفظه عامل الخدمة مسبقًا).
// المعالجة في الشكل وحده: حذف الوسوم، وكتابة الاقتباس ﴿…﴾ بلا مسافتي القوسين، والفاصلة
// والفاصلة المنقوطة اللاتينيتين بين الكلمات العربية عربيتين، وتوحيد المسافات.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchAll, QURAN, writeSplit } from './ksu.mjs';

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

async function main() {
  const quran = JSON.parse(await readFile(QURAN, 'utf8'));
  const raws = await fetchAll('saadi', quran);

  const verses = raws.map(cleanSaadi);
  const empty = verses.map((t, i) => (t ? null : `${quran.verses[i].s}:${quran.verses[i].a}`)).filter(Boolean);
  const leftover = verses.filter((t) => /[<>{}]|&[a-z]+;/.test(t)).length;
  const bytes = await writeSplit('saadi', quran, verses);

  console.log('═══ تقرير تفسير السعدي ═══');
  console.log(`الآيات: ${verses.length} · بلا تفسير: ${empty.length} ${empty.slice(0, 40).join(' ')}`);
  console.log(`نصوص فيها بقايا وسوم أو أقواس معقوفة: ${leftover}`);
  console.log(`حجم الملفات الناتجة: ${bytes} بايت → public/data/tafsir/saadi (اكتبه في src/data/tafsirs.js)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
