// الخطوة ٠: تنزيل المصادر الخام التي تُبنى منها البيانات، إلى .cache.
// كل ملف موجود يُتخطّى، فإعادة التشغيل لا تعيد التنزيل.
//
//   • نص المصحف: حزمة مجمع الملك فهد UthmanicHafs_v2-0 (hafsData_v2-0.json)
//   • التفسير الميسّر: الإصدار الرسمي للمجمع tafseerMouaser_v03
//   • المختصر: قاعدة بيانات quranenc الرسمية arabic_mokhtasar
//
// والفكّ بأداة unzip المتوفرة في طرفية Git Bash التي تُشغَّل منها هذه السكربتات.
import { mkdir, access, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const exists = (p) => access(p).then(() => true, () => false);

const SOURCES = [
  {
    name: 'نص المصحف (مجمع الملك فهد)',
    url: 'https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip',
    zip: '.cache/kfgqpc/UthmanicHafs_v2-0.zip',
    entry: 'UthmanicHafs_v2-0 data/hafsData_v2-0.json',
    dir: '.cache/kfgqpc',
    flatten: true,
    out: '.cache/kfgqpc/hafsData_v2-0.json',
  },
  {
    name: 'التفسير الميسّر (مجمع الملك فهد)',
    url: 'https://download.qurancomplex.gov.sa/resources_dev/hafs_tafseerMouaser_v3.zip',
    zip: '.cache/kfgqpc/tafseerMouaser.zip',
    entry: 'hafs_tafseerMouaser_v3_data/tafseerMouaser_v03.txt',
    dir: '.cache/kfgqpc',
    flatten: false,
    out: '.cache/kfgqpc/hafs_tafseerMouaser_v3_data/tafseerMouaser_v03.txt',
  },
  {
    name: 'المختصر (quranenc)',
    url: 'https://quranenc.com/downloads/sqlite/arabic_mokhtasar.zip',
    zip: '.cache/quranenc/arabic_mokhtasar.zip',
    entry: 'arabic_mokhtasar.sqlite',
    dir: '.cache/quranenc',
    flatten: true,
    out: '.cache/quranenc/arabic_mokhtasar.sqlite',
  },
];

for (const s of SOURCES) {
  if (await exists(s.out)) {
    console.log(`  ✓ ${s.name} — موجود`);
    continue;
  }
  await mkdir(s.dir, { recursive: true });
  if (!(await exists(s.zip))) {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`تعذّر تنزيل ${s.name}: HTTP ${res.status}`);
    await writeFile(s.zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync('unzip', ['-o', '-q', ...(s.flatten ? ['-j'] : []), s.zip, s.entry, '-d', s.dir], {
    stdio: 'inherit',
  });
  if (!(await exists(s.out))) throw new Error(`لم يُعثر على ${s.out} بعد الفكّ`);
  console.log(`  ✓ ${s.name} — نُزّل`);
}
console.log('المصادر الخام جاهزة.');
