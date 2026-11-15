// الخطوة ١١: تفسير البغوي («معالم التنزيل في تفسير القرآن») — ٢٠٢٦-١١-١٥
//
// المصدر: مشروع المصحف الإلكتروني «آيات» بجامعة الملك سعود (quran.ksu.edu.sa)، آيةً آية بالمؤلف «baghawy»
// (الجلب في scripts/data/ksu.mjs، ويُحفظ في .cache/ksu/baghawy). والناتج ملف لكل سورة في
// public/data/tafsir/baghawy، يحمّله المستخدم بزرّ في قائمة التفاسير (src/lib/tafsirDownload.js).
//
// وسوم النسخة:
//   <span class="t4">{…}</span> اقتباس الآية المفسَّرة في بعض السور ← ﴿…﴾ (كالسعدي)
//   <span class="t3">( … )</span> اقتباس الآية في سور أخرى، وكلمة يُتكلَّم عليها، وعزو الآية («( 50 - المؤمنون )»)
//   <span class="t1">" … "</span> نصّ منقول: آية من موضع آخر، أو حديث، أو قول
//   <span class="t2">[ … ]</span> زيادة أو عزو بين معقوفين
// وt3 وt1 تجمعان الآية وغيرها، فلا تُحوَّلان إلى ﴿…﴾ لئلا يُكتب غير القرآن بقوسي الآية: تبقى أقواسهما كما
// في النسخة، ويُحذف الفراغ داخلها وحده. والمعالجة بعدها في الشكل وحده، كالسعدي: فقرات الأصل، والفاصلة
// والفاصلة المنقوطة اللاتينيتان بين الكلمات العربية عربيتين، ولا فراغ قبل علامة الترقيم، وتوحيد المسافات.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchAll, QURAN, writeSplit } from './ksu.mjs';

const AR = '؀-ۿ';

// أخطاء في وسوم النسخة نفسها، تُصلح في الجواب قبل التنظيف (موضعها: [النص الخطأ، الصواب])
export const FIXES = {
  // الاقتباس بلا قوس غالق
  '2:105': [['<p>{أن ينزل عليكم من خير من ربكمْ أي', '<p><span class="t4">{أن ينزل عليكم من خير من ربكمْ}</span> أي']],
  // عزو بقوس معقوف غالق بدل المعقوف
  '2:115': [['[88-القصص}', '[88-القصص]']],
  // قول عطاء يُفتح بقوس معقوف ويُغلق بعلامة تنصيص
  '2:133': [['قال عطاء: {إن الله تعالى', 'قال عطاء: "إن الله تعالى']],
  // «>» زائدة بعد الكلام
  '2:26': [['أي بهذا المثل></p>', 'أي بهذا المثل</p>']],
};
export function applyFixes(key, raw) {
  let s = raw;
  for (const [from, to] of FIXES[key] ?? []) {
    if (!s.includes(from)) throw new Error(`إصلاح ${key} لم يجد نصّه: ${from}`);
    s = s.replace(from, to);
  }
  return s;
}

// يحذف الفراغ بعد القوس الفاتح وقبل القوس الغالق في نص الوسم الواحد
const trimInside = (t) => t.replace(/^\s*([("[])\s+/, '$1').replace(/\s+([)"\]])\s*$/, '$1').trim();

// نص التفسير من جواب «آيات» (ما بعد «|||»)، مصدَّرة لتختبرها tests/unit/data.test.js
export function cleanBaghawy(raw) {
  const i = raw.indexOf('|||');
  if (i < 0) throw new Error('جواب بلا فاصل «|||»');
  let s = raw.slice(i + 3);
  s = s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    // الآية المفسَّرة: «{ نص }» ← «﴿نص﴾»
    .replace(/<span class="t4">\s*\{\s*([\s\S]*?)\s*\}\s*<\/span>/g, '﴿$1﴾')
    .replace(/<span class="t[123]">([\s\S]*?)<\/span>/g, (_, t) => trimInside(t))
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/‏/g, '');
  return s
    .split('\n')
    .map((p) =>
      p
        .replace(/[ \t  ]+/g, ' ')
        // الفاصلة والفاصلة المنقوطة اللاتينيتان في النص العربي
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?, ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1، ')
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?; ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1؛ ')
        // لا فراغ قبل علامة الترقيم («قال :» ← «قال:»)، إلا «...»
        .replace(/ ([،؛:.؟!])(?!\.)/g, '$1')
        // علامة ترقيم ملتصقة بما بعدها («قال:وقيل») تفصلها مسافة
        .replace(new RegExp(`([،؛:؟!])(?=[${AR}﴿«(])`, 'g'), '$1 ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const quran = JSON.parse(await readFile(QURAN, 'utf8'));
  const raws = await fetchAll('baghawy', quran);

  const verses = raws.map((raw, i) => cleanBaghawy(applyFixes(`${quran.verses[i].s}:${quran.verses[i].a}`, raw)));
  const empty = verses.map((t, i) => (t ? null : `${quran.verses[i].s}:${quran.verses[i].a}`)).filter(Boolean);
  const leftover = verses.filter((t) => /[<>{}]|&[a-z]+;/.test(t)).length;
  const bytes = await writeSplit('baghawy', quran, verses);

  console.log('═══ تقرير تفسير البغوي ═══');
  console.log(`الآيات: ${verses.length} · بلا تفسير: ${empty.length} ${empty.slice(0, 60).join(' ')}`);
  console.log(`نصوص فيها بقايا وسوم أو أقواس معقوفة: ${leftover}`);
  console.log(`حجم الملفات الناتجة: ${bytes} بايت → public/data/tafsir/baghawy (اكتبه في src/data/tafsirs.js)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
