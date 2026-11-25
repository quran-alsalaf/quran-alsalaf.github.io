// الخطوة ٢٠: معاني الكلمات من «الميسّر في غريب القرآن الكريم» (مجمع الملك فهد) للسور التي لا معاني لها في
// المذكرات (٢٠٢٦-١١-٢٥، بقرار صاحب المشروع: تبقى المذكرات في سورها، ويُكمَّل الباقي من الميسّر بالسورة لا بالآية).
//
// المصدر: scripts/data/gharib/muyassar.tsv — سطر لكل كلمة: رقم السورة، رقم الآية، الكلمة بالرسم العثماني، معناها.
// استُخرج من حزمة Anki «الميسر في غريب القرآن» (https://ankiweb.net/shared/info/2147115725، ١١٣٦١ كلمة للسور
// الـ١١٤)، وطوبق بصفحات الطبعة الأولى المصوَّرة للكتاب (١٤٣٣هـ، https://archive.org/details/WAQ142929): الصفحات
// ٧٧ و٤٢٠ و٥٦٠ كاملة، ٥٧ كلمة من ٥٧ بألفاظها ومعانيها وترتيبها.
//
// العمل:
//   • السور: كل سورة لا تمسّ أقسامُ «معاني الكلمات» في المذكرات (memos.json ← sections k: 'm') شيئًا من آياتها
//     (الأعراف إلى التحريم اليوم)؛ وما سواها يبقى للمذكرات.
//   • موضع الكلمة في آيتها: كلمات المدخل متتالية في كلمات الآية، بمقارنة الهيكل (skeleton في الخطوة ١٣: بلا تشكيل
//     ولا ألف ولا همزة)، ويُقبل حرف ملتصق بأول كلمة في المصحف ليس في المدخل («وَٱلۡفُرۡقَانَ» و«ٱلۡفُرۡقَانَ»).
//     وتكرار الكلمة في الآية: يُبدأ البحث بعد موضع المدخل السابق فيها. وما لا يُعرف موضعه يُكتب بلفظ الكتاب.
//   • تصحيح أخطاء الضبط الظاهرة في نص المعاني (fixMeaning) دون تغيير شيء من الصياغة.
//
// المخرجات (بنية meanings في memos.json، بلا رقم القسم):
//   public/data/muyassar.json        { v, source, suras: [أرقام السور], meanings: [[آية، الكلمة، المعنى، (من، إلى)]] }
//   public/data/warsh/muyassar.json  الشيء نفسه بترقيم ورش ومواضع الكلمات في آيات ورش (كالمذكرات في الخطوة ١٣)
//
//   node scripts/data/20-muyassar-gharib.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { skeleton, mapWarsh, warshMemos } from './13-warsh-map.mjs';

const SRC = 'scripts/data/gharib/muyassar.tsv';
export const OUT = 'public/data/muyassar.json';
export const WARSH_OUT = 'public/data/warsh/muyassar.json';
export const SOURCE = 'الميسّر في غريب القرآن الكريم — مجمع الملك فهد';

// تصحيحات يدوية لأخطاء ضبط في الحزمة (قورنت بالكتاب حيث خفي الصواب)
export const FIXES = [
  ['يْأمُرُهم', 'يَأمُرُهم'],
  ['اْنِقيَادَ', 'انْقِيادَ'],
  ['أْطَهرُ', 'أَطْهَرُ'],
  ['لْلِحَقِّ', 'لِلحَقِّ'],
  ['شّرٍ', 'شَرٍّ'],
  ['تْلتَمِسُوا', 'تَلْتَمِسُوا'],
  ['لمِاَ', 'لِمَا'],
  ['الجنِّةِ', 'الجنَّةِ'],
  ['مَّيدانِ', 'مَيدانِ'],
  ['فيأ خُذُوها', 'فيأخُذُوها'],
  ['و يتمتَّعوا', 'ويتمتَّعوا'],
  ['لاتَلِدُ', 'لا تَلِدُ'],
];

// تصحيح نص المعنى: التصحيحات اليدوية، ثم حركة على ألف المدّ (غير تنوين الفتح: «ماَلَتْ»، «الدعاُء»)، وحركة على لام
// التعريف بعد ألفها («الَملائكة»، لا شدّتها في «الَّذي»)، والمسافة قبل علامة الترقيم، والمسافات المكررة
export function fixMeaning(text) {
  let t = text;
  for (const [a, b] of FIXES) t = t.split(a).join(b);
  return t
    .replace(/ا[ٌ-ْ]+/g, 'ا')
    .replace(/(^|[\s(«"وفبكل])ال[َ-ِ](?![ّ])/g, '$1ال')
    .replace(/\s+([،.:؛])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readSource(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [s, a, word, meaning] = line.split('\t');
      return { s: +s, a: +a, word, meaning };
    });
}

// السور التي لا تمسّ أقسامُ المعاني في المذكرات شيئًا من آياتها
export function gharibSuras(quran, memos) {
  const covered = new Set();
  for (const sec of memos.sections) {
    if (sec.k !== 'm') continue;
    for (const [a, b] of sec.r) for (let v = a; v <= b; v++) covered.add(quran.verses[v].s);
  }
  return quran.suras.map((s) => s.n).filter((n) => !covered.has(n));
}

// أرخى من الهيكل: بلا الواو والياء أيضًا («ٱلسَّيِّـَٔاتُ» و«ٱلسَّئَِّاتُ»)
const loose = (s) => s.replace(/[وي]/g, '');

// موضع الكلمة في الآية: [من، إلى] بفهرس كلمات t، أو null. from: أول موضع يُبحث منه.
// بالهيكل كلمةً كلمة، ثم بالهيكل موصولًا (مسافة زائدة أو ناقصة: «حَصۡحَصَٱلۡحَقُّ»، «أَوَ لَمۡ»)، ثم بالأرخى موصولًا؛
// ويُقبل في كل ذلك حرفان ملتصقان بأول كلمة في المصحف («وَٱلۡفُرۡقَانَ»)
export function locate(tokens, word, from = 0) {
  const want = word.split(/\s+/).map(skeleton).filter(Boolean);
  if (!want.length) return null;
  const ks = []; // مواضع الكلمات ذات الهيكل (لا رقم الآية ولا علامتي الربع والسجدة)
  tokens.forEach((t, k) => skeleton(t) && ks.push(k));
  const sk = ks.map((k) => skeleton(tokens[k]));
  const order = [...ks.keys()].filter((i) => ks[i] >= from).concat([...ks.keys()].filter((i) => ks[i] < from));
  // حرف أو حرفان ملتصقان بأول الكلمة في المصحف، من حروف العطف والجر وحدها («وَٱلۡفُرۡقَانَ»، «فَأَسَرَّهَا»)
  const prefixed = (s, w, first) => {
    if (s === w) return true;
    const pre = s.length - w.length;
    return s.endsWith(w) && pre >= 1 && pre <= 2 && first.length > pre && /^[وفبلك]+$/.test(s.slice(0, pre));
  };
  // التطابق التام أولًا في الآية كلها، ثم بالحرف الملتصق (فلا تُؤخذ «وَشَهِدَ» قبل «شَاهِدࣱ» في الأحقاف ١٠)
  for (const exact of [true, false]) {
    const head = exact ? (s, w) => s === w : prefixed;
    for (const i of order) {
      const ok = want.every((w, j) => sk[i + j] !== undefined && (j === 0 ? head(sk[i], w, sk[i]) : sk[i + j] === w));
      if (ok) return [ks[i], ks[i + want.length - 1]];
    }
  }
  for (const f of [(s) => s, loose]) {
    const target = f(want.join(''));
    for (const exact of [true, false]) {
      for (const i of order) {
        let joined = '';
        for (let j = i; j < sk.length && j < i + want.length + 2; j++) {
          joined += f(sk[j]);
          if (exact ? joined === target : prefixed(joined, target, f(sk[i]))) return [ks[i], ks[j]];
          if (joined.length > target.length + 2) break;
        }
      }
    }
  }
  return null;
}

// تصحيح بنية الحزمة قبل الربط:
//   • أسطر متتالية سورتُها غير سورة ما قبلها وما بعدها، وهما من سورة واحدة: خطأ في الحزمة (كلمات فاطر ١٠–١١
//     مكتوبة «الأنفال»)، فتأخذ سورة ما حولها
//   • المدخل المكرر لآيتين متتاليتين، والكلمة ليست في الثانية وحدها (تمتد في الآيتين: «حمٓ عٓسٓقٓ» في الشورى ١ و٢)،
//     يبقى أوله وحده («ٱبۡتَلَىٰهُ» في الفجر ١٥ و١٦ في كل منهما فتبقى)
//   • علامة الحزب ۞ داخل الكلمة تُحذف
export function fixRows(rows, quran) {
  const verseAt = new Map(quran.verses.map((v, i) => [`${v.s}:${v.a}`, i]));
  const fixed = [];
  const out = rows.map((r) => ({ ...r, word: r.word.replace(/\s*۞\s*/g, ' ').trim() }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].s === out[i - 1].s) continue;
    let j = i;
    while (j < out.length && out[j].s === out[i].s) j++;
    if (j < out.length && out[j].s === out[i - 1].s) {
      for (let k = i; k < j; k++) {
        fixed.push(`${out[k].s}:${out[k].a}←${out[i - 1].s}`);
        out[k].s = out[i - 1].s;
      }
    }
  }
  const dropped = [];
  const kept = out.filter((r, i) => {
    const dup = out.slice(Math.max(0, i - 3), i).some((p) => p.s === r.s && p.a < r.a && p.word === r.word && p.meaning === r.meaning) &&
      !locate(quran.verses[verseAt.get(`${r.s}:${r.a}`)]?.t ?? [], r.word);
    if (dup) dropped.push(`${r.s}:${r.a} «${r.word}»`);
    return !dup;
  });
  return { rows: kept, fixed, dropped };
}

// الآيات التي يُبحث فيها عن الكلمة: آيتها، ثم ما حولها من سورتها (رقم آية خاطئ في الحزمة: «فَنُزُلࣱ» في الواقعة ٩٢ وهي ٩٣)
const NEAR = [0, 1, -1, 2, -2];

export function build(quran, memos, sourceRows) {
  const suras = gharibSuras(quran, memos);
  const keep = new Set(suras);
  const verseAt = new Map(quran.verses.map((v, i) => [`${v.s}:${v.a}`, i]));
  const { rows, fixed, dropped } = fixRows(sourceRows, quran);
  const meanings = [];
  const unplaced = [];
  const moved = [];
  const missing = [];
  let last = { v: -1, to: -1 };
  for (const r of rows) {
    if (!keep.has(r.s)) continue;
    const v0 = verseAt.get(`${r.s}:${r.a}`);
    if (v0 === undefined) {
      missing.push(`${r.s}:${r.a}`);
      continue;
    }
    const meaning = fixMeaning(r.meaning);
    let found = null;
    for (const d of NEAR) {
      const v = v0 + d;
      if (!quran.verses[v] || quran.verses[v].s !== r.s) continue;
      const at = locate(quran.verses[v].t, r.word, last.v === v ? last.to + 1 : 0);
      if (at) {
        found = { v, at };
        break;
      }
    }
    if (found) {
      const { v, at } = found;
      // المدخل نفسه نُقل إلى آية فيها مثله («ٱلثَّالِثَةَ ٱلۡأُخۡرَىٰٓ» في النجم ١٩ و٢٠، وهي في ٢٠)
      if (meanings.some((m) => m[0] === v && m[3] === at[0] && m[4] === at[1] && m[2] === meaning)) continue;
      if (v !== v0) moved.push(`${r.s}:${r.a}→${quran.verses[v].a} «${r.word}»`);
      meanings.push([v, r.word, meaning, at[0], at[1]]);
      last = { v, to: at[1] };
    } else {
      meanings.push([v0, r.word, meaning]);
      unplaced.push(`${r.s}:${r.a} «${r.word}»`);
    }
  }
  // بترتيب الآيات ثم مواضع الكلمات (ما نُقل إلى آية أخرى يأخذ مكانه فيها)
  const order = meanings.map((m, i) => [m, i]);
  order.sort(([a, i], [b, j]) => a[0] - b[0] || (a[3] ?? Infinity) - (b[3] ?? Infinity) || i - j);
  return { data: { v: 1, source: SOURCE, suras, meanings: order.map(([m]) => m) }, unplaced, moved, fixed, dropped, missing };
}

// بترقيم ورش: بالدالّة نفسها التي تنقل معاني المذكرات (warshMemos)، والقسم فيها لا يُستعمل
export function buildWarsh(hafs, warsh, data) {
  const { hafs: ranges, word } = mapWarsh(hafs, warsh);
  const asMemos = {
    sections: [],
    weeks: [],
    actions: [],
    meanings: data.meanings.map(([v, w, m, from, to]) => (from === undefined ? [v, w, m, -1] : [v, w, m, -1, from, to])),
  };
  const { memos: wm, report } = warshMemos(asMemos, hafs, warsh, ranges, word);
  const meanings = wm.meanings.map(([v, w, m, , from, to]) => (from === undefined ? [v, w, m] : [v, w, m, from, to]));
  return { data: { ...data, riwayah: 'warsh', meanings }, report };
}

async function main() {
  const quran = JSON.parse(await readFile('public/data/quran.json', 'utf8'));
  const memos = JSON.parse(await readFile('public/data/memos.json', 'utf8'));
  const warsh = JSON.parse(await readFile('public/data/warsh/quran.json', 'utf8'));
  const rows = readSource(await readFile(SRC, 'utf8'));

  const { data, unplaced, moved, fixed, dropped, missing } = build(quran, memos, rows);
  await writeFile(OUT, JSON.stringify(data));
  const { data: wd, report } = buildWarsh(quran, warsh, data);
  await writeFile(WARSH_OUT, JSON.stringify(wd));

  console.log('═══ معاني الكلمات من الميسّر ═══');
  console.log(`السور (${data.suras.length}): ${data.suras[0]}–${data.suras.at(-1)}`);
  console.log(`الكلمات: ${data.meanings.length} · بموضعها في الآية: ${data.meanings.length - unplaced.length} · بلفظ الكتاب: ${unplaced.length}`);
  console.log(`ورش: ${report.meanings} · بموضعها في آية ورش: ${report.placed}`);
  if (fixed.length) console.log(`سورة مصحَّحة: ${fixed.join(' ')}`);
  if (dropped.length) console.log(`مكرر لآيتين: ${dropped.join(' | ')}`);
  if (moved.length) console.log(`إلى آية مجاورة (${moved.length}): ${moved.join(' | ')}`);
  if (unplaced.length) console.log(`بلا موضع: ${unplaced.slice(0, 40).join(' | ')}`);
  if (missing.length) {
    console.log(`آيات غير موجودة: ${missing.join(' ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
