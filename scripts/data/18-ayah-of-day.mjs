// الخطوة ١٨: بيانات ويدجت «آية اليوم» في تطبيق أندرويد (الجلسة ٣ ج ٢، ٢٠٢٦-١١-٢١).
//
// الويدجت يعمل والتطبيق مغلق، فآياته الـ٤٧ (src/data/ayahOfDay.js) مبنية معه بنصّي المصحفين وخطّيهما:
//   android/app/src/main/res/raw/ayah_of_day.json  { epoch, entries: ayahEntries(...) } — src/lib/ayahOfDay.js
//   android/app/src/main/res/font/ayah_hafs.ttf    خط حفص العام (public/fonts/uthmanic_hafs_v20.ttf) بحروف الآيات وحدها
//   android/app/src/main/res/font/ayah_warsh.ttf   خط ورش العام (public/fonts/warsh-text.woff2) بحروف آيات ورش وحدها
// والخطان TrueType لأن أندرويد لا يقرأ woff2. وبهما تُرسم علامة نهاية الآية برقمها كما في التطبيق.
//
// التحقق (وإلا توقف البناء): كل آية موجودة ولها مقابل متصل في ورش من السورة نفسها، وكل حرف في نصّيها في خطها.
//
// يعمل بعد الخطوتين ١٢ و١٣ (مصحف ورش وربطه بحفص):  node --no-warnings scripts/data/18-ayah-of-day.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';
import { AYAH_EPOCH } from '../../src/data/ayahOfDay.js';
import { ayahEntries } from '../../src/lib/ayahOfDay.js';

const RES = 'android/app/src/main/res';
export const OUT_JSON = `${RES}/raw/ayah_of_day.json`;
const FONTS = [
  { riwayah: 'hafs', from: 'public/fonts/uthmanic_hafs_v20.ttf', to: `${RES}/font/ayah_hafs.ttf` },
  { riwayah: 'warsh', from: 'public/fonts/warsh-text.woff2', to: `${RES}/font/ayah_warsh.ttf` },
];

const readJson = async (f) => JSON.parse(await readFile(f, 'utf8'));

// حروف النص بلا المسافة (تُرسم بخط النظام إن لم تكن في الخط)
const charsOf = (text) => [...new Set([...text.replace(/\s/g, '')])];

async function main() {
  const hafs = await readJson('public/data/quran.json');
  const warsh = await readJson('public/data/warsh/quran.json');
  const entries = ayahEntries(hafs, warsh);

  await mkdir(`${RES}/raw`, { recursive: true });
  await mkdir(`${RES}/font`, { recursive: true });
  await writeFile(OUT_JSON, `${JSON.stringify({ epoch: AYAH_EPOCH, entries })}\n`);

  for (const { riwayah, from, to } of FONTS) {
    const text = entries.map((x) => x[riwayah].text).join(' ');
    const src = await readFile(from);
    const font = fontkit.create(src);
    const missing = charsOf(text).filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
    if (missing.length) throw new Error(`حروف ليست في خط ${riwayah}: ${missing.map((c) => c.codePointAt(0).toString(16)).join(' ')}`);
    const out = await subsetFont(src, `${text} `, { targetFormat: 'truetype' });
    await writeFile(to, out);
    console.log(`✓ ${to} (${Math.round(out.length / 1024)} ك.ب)`);
  }
  console.log(`✓ ${OUT_JSON}: ${entries.length} آية`);
}

if (import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
