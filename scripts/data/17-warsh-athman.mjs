// الخطوة ١٧: أثمان الأحزاب في مصحف ورش (٢٠٢٦-١١-١٦) — ٦٠ حزبًا في كل حزب ثمانية أثمان، فهي ٤٨٠ ثمنًا.
//
// مطبوع المجمع برواية ورش مقسوم أثمانًا: في هامشه زخرفة عند كل ثمن («حزب» لأول الحزب، ثم «ثمن» و«ربع» و«نصف
// الحزب» و«ثمن» و«ربع» و«ثمن» بالترتيب)، وفي النص علامة ۞ قبل أول كلمة في الثمن، إلا ما بدأ بأول سورة فلا
// علامة فيه (زخرفة الهامش وحدها). ونص المجمع (الخطوة ١٢) لا ينقل الهامش، ففيه ٤٣٥ علامة ۞، ١٢ منها في وسط آية.
//
// المصدر: الأثمان = علامات ۞ في نص المجمع + أول الفاتحة + أوائل السور الـ٤٤ أدناه. وهذه الـ٤٤ مأخوذة من هوامش
// مطبوع المجمع (warsh39-1.pdf) — صور صفحاته كاملةً بهوامشها:
//   https://github.com/almandoub15-cell/quran-warsh-pages (pages/NNN.jpg، مطبوع المجمع صفحاتٍ ١–٦٠٤)
// فُحصت هوامش الصفحات الـ٦٠٤ كلها (٢٠٢٦-١١-١٦): فيها ٤٧٩ زخرفة قسم (غير زخارف السجدة)، كل منها على سطر علامة ۞
// أو على أول سورة من هذه الـ٤٤، ولا زخرفة غيرها؛ والفاتحة صفحتها مزخرفة كلها بلا هامش. وتوافقها بيانات «المصحف
// المحمدي» المغربي برواية ورش (smartmaker-devs/nuralhifz-data)، إلا موضعين يخالفان المجمع بآية: البقرة ٢٢٦
// والأعراف ٢٠٠، والمعتمد فيهما المجمع (علامته في نصه وزخرفته في هامش مطبوعه).
//
// التحقق (وإلا توقف البناء): ٤٨٠ ثمنًا متتابعة، وفي كل جزء ١٦ ثمنًا وأوله أول ثمن فيه، وكل علامة ۞ أول ثمن،
// وكل أول سورة في القائمة أول سورة فعلًا في صفحة المطبوع المذكورة بلا علامة ۞.
//
// المخرج في public/data/warsh/quran.json:
//   athman  أول آية في كل ثمن بالترتيب (من ٠)؛ والثمن الذي يبدأ في وسط آية أوله علامة ۞ في نصها
//   rubs    أول آية في كل ربع (كل ثمنين) — ٢٤٠، كأرباع حفص (للمراجعة البعيدة في ختمة الحفظ)
import { readFile, writeFile } from 'node:fs/promises';

const WARSH = 'public/data/warsh/quran.json';
const RUB = '۞';

// [السورة، صفحة المطبوع]: أوائل السور التي يبدأ بها ثمن (زخرفة في الهامش بلا ۞ في النص)
const SURA_STARTS = [
  [6, 128], [14, 255], [15, 262], [16, 267], [17, 282], [18, 293], [20, 312], [21, 322], [22, 332], [23, 342],
  [26, 367], [28, 385], [33, 418], [34, 428], [38, 453], [40, 467], [45, 499], [46, 502], [49, 515], [51, 520],
  [55, 531], [56, 534], [58, 542], [60, 549], [61, 551], [62, 553], [63, 554], [65, 558], [66, 560], [67, 562],
  [70, 568], [72, 572], [75, 577], [76, 578], [78, 582], [79, 583], [81, 586], [82, 587], [87, 591], [90, 594],
  [92, 595], [94, 596], [98, 598], [106, 602],
];

const quran = JSON.parse(await readFile(WARSH, 'utf8'));
const V = quran.verses;
const key = (v) => `${V[v].s}:${V[v].a}`;
const problems = [];

const marked = V.map((x, v) => (x.t.includes(RUB) ? v : null)).filter((v) => v != null);
const suraStarts = SURA_STARTS.map(([s, p]) => {
  const v = V.findIndex((x) => x.s === s && x.a === 1);
  if (v < 0) problems.push(`لا أول للسورة ${s}`);
  else if (V[v].p !== p) problems.push(`أول السورة ${s} في صفحة ${V[v].p} لا ${p}`);
  else if (V[v].t.includes(RUB)) problems.push(`أول السورة ${s} فيه علامة ۞`);
  return v;
});
const athman = [...new Set([0, ...marked, ...suraStarts])].sort((a, b) => a - b);

if (athman.length !== 480) problems.push(`عدد الأثمان ${athman.length} لا ٤٨٠`);
if (marked.length !== 435) problems.push(`علامات ۞ ${marked.length} لا ٤٣٥`);
// كل جزء ١٦ ثمنًا، وأوله أول ثمن فيه
for (let j = 1; j <= 30; j++) {
  const first = V.findIndex((x) => x.j === j);
  const n = athman.filter((v) => V[v].j === j).length;
  if (n !== 16) problems.push(`الجزء ${j} فيه ${n} ثمنًا لا ١٦`);
  if (athman[(j - 1) * 16] !== first) problems.push(`أول الجزء ${j} (${key(first)}) ليس الثمن ${(j - 1) * 16 + 1}`);
}
// علامة واحدة في الآية على الأكثر (وإلا التبس موضع الثمن)
for (const v of marked) if (V[v].t.filter((t) => t === RUB).length !== 1) problems.push(`في ${key(v)} أكثر من علامة ۞`);

const mid = marked.filter((v) => V[v].t.indexOf(RUB) > 0);
console.log('═══ تقرير أثمان ورش ═══');
console.log(`الأثمان: ${athman.length} · بعلامة ۞: ${marked.length} (في وسط آية: ${mid.length}) · أول الفاتحة: ١ · أوائل سور: ${suraStarts.length}`);
problems.forEach((p) => console.log(`     ✗ ${p}`));
if (problems.length) {
  process.exitCode = 1;
} else {
  quran.athman = athman;
  quran.rubs = athman.filter((_, i) => i % 2 === 0);
  await writeFile(WARSH, JSON.stringify(quran));
  console.log(`أُضيفت athman (٤٨٠) وrubs (٢٤٠) إلى ${WARSH}`);
}
