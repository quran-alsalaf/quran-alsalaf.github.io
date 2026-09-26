// الخطوة ٣: التفسير الميسّر — من الإصدار الرقمي الرسمي لمجمع الملك فهد
// لطباعة المصحف الشريف (tafseerMouaser_v03)، وهو ناشر الكتاب نفسه.
//
// اختير على نسخة الشاملة لأنه إصدار الناشر، ويفصل التفسير آيةً آية حيث
// تكرّر النسخ الأخرى فقرةً مدموجة على عدة آيات.
//
// المعالجة خفيفة ومحصورة في الشكل لا المضمون:
//   • حذف رقم الآية في أول النص «[12]» — فرقم الآية يُعرض من المصحف
//   • حذف وسوم HTML مع إبقاء اقتباسات الآيات، محاطةً بالقوسين ﵡ…ﵠ اللذين
//     وضعهما الناشر، ليعرضها التطبيق بخط المصحف
//   • ردّ «صور العرض» العربية (ﺑ ﻟ …) إلى حروفها الأصلية، لأنها تُفسد البحث والنسخ
//   • توحيد المسافات الغريبة إلى مسافة عادية
import { readFile, writeFile } from 'node:fs/promises';

const SRC = '.cache/kfgqpc/hafs_tafseerMouaser_v3_data/tafseerMouaser_v03.txt';
const QURAN = 'public/data/quran.json';
const OUT = 'public/data/tafsir-muyassar.json';

const QUOTE_OPEN = 'ﵡ'; // ﵡ
const QUOTE_CLOSE = 'ﵠ'; // ﵠ

const raw = await readFile(SRC, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const head = lines[0].split('\t').map((s) => s.trim());
const rows = lines.slice(1).map((l) => {
  const c = l.split('\t');
  return Object.fromEntries(head.map((h, i) => [h, c[i]]));
});

const quran = JSON.parse(await readFile(QURAN, 'utf8'));
if (rows.length !== quran.verses.length) throw new Error(`عدد الآيات ${rows.length} لا يطابق المصحف ${quran.verses.length}`);

const stats = { presentation: 0, oddSpaces: 0, quotes: 0, labelsRemoved: 0 };

function clean(t) {
  let s = t.trim();

  const label = s.match(/^\[\s*[\d٠-٩]+(?:\s*[،,-]\s*[\d٠-٩]+)*\s*\]\s*/);
  if (label) {
    s = s.slice(label[0].length);
    stats.labelsRemoved++;
  }

  // اقتباسات الآيات: يُحذف الوسم ويبقى النص بقوسيه
  s = s.replace(/<span class='aya'>([\s\S]*?)<\/span>/g, (_, q) => {
    stats.quotes++;
    let inner = q.trim();
    if (!inner.startsWith(QUOTE_OPEN)) inner = QUOTE_OPEN + inner;
    if (!inner.endsWith(QUOTE_CLOSE)) inner = inner + QUOTE_CLOSE;
    return inner;
  });
  s = s.replace(/<[^>]+>/g, '');

  // صور العرض (U+FE70–U+FEFF) إلى حروفها الأصلية
  s = s.replace(/[ﹰ-﻿]/g, (ch) => {
    stats.presentation++;
    return ch.normalize('NFKC');
  });

  s = s.replace(/[     - ]/g, () => {
    stats.oddSpaces++;
    return ' ';
  });

  return s.replace(/[ \t]+/g, ' ').replace(/ ([،؛.:؟!])/g, '$1').trim();
}

const out = [];
const mismatchedKeys = [];
rows.forEach((r, i) => {
  const v = quran.verses[i];
  if (+r.sura_no !== v.s || +r.aya_no !== v.a) mismatchedKeys.push(`${i}: ${r.sura_no}:${r.aya_no} ≠ ${v.s}:${v.a}`);
  out.push(clean(r.aya_tafseer || ''));
});
if (mismatchedKeys.length) throw new Error(`ترتيب الآيات يخالف المصحف:\n${mismatchedKeys.slice(0, 5).join('\n')}`);

const empty = out.map((t, i) => (t ? null : i)).filter((x) => x != null);
const shared = [];
for (let i = 1; i < out.length; i++) {
  if (out[i] && out[i] === out[i - 1]) {
    const a = quran.verses[i - 1];
    const b = quran.verses[i];
    shared.push(`${a.s}:${a.a}–${b.a}`);
  }
}
const leftover = new Set();
out.forEach((t) => {
  for (const ch of t.replace(new RegExp(`${QUOTE_OPEN}[^${QUOTE_CLOSE}]*${QUOTE_CLOSE}`, 'g'), '')) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xfb50) leftover.add(`U+${cp.toString(16).toUpperCase()}`);
  }
});

const data = {
  v: 1,
  source: 'التفسير الميسّر — مجمع الملك فهد لطباعة المصحف الشريف (tafseerMouaser_v03)',
  quote: [QUOTE_OPEN, QUOTE_CLOSE],
  verses: out,
};
const json = JSON.stringify(data);
await writeFile(OUT, json);

console.log('═══ تقرير التفسير الميسّر ═══');
console.log(`الآيات: ${out.length} · بلا تفسير: ${empty.length}`);
console.log(`أرقام آيات حُذفت من أول النص: ${stats.labelsRemoved}`);
console.log(`اقتباسات آيات داخل التفسير: ${stats.quotes}`);
console.log(`صور عرض رُدّت إلى حروفها: ${stats.presentation} · مسافات غريبة وُحّدت: ${stats.oddSpaces}`);
console.log(`آيات متتالية تشترك في نصّ واحد: ${shared.length}  ${shared.join(' ')}`);
console.log(`محارف عرض متبقية خارج الاقتباسات: ${leftover.size ? [...leftover].join(' ') : 'لا شيء'}`);
console.log(`حجم الملف الناتج: ${(Buffer.byteLength(json) / 1024).toFixed(0)} ك.ب → ${OUT}`);
