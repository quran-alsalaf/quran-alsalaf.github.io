// الخطوة ١٣: ربط ترقيم ورش بترقيم حفص (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٢)
//
// آيات ورش ٦٢١٤ (عدّ المدني) وآيات حفص ٦٢٣٦ (عدّ الكوفي)، والنص واحد إلا فروقًا يسيرة في الرسم والقراءة.
// وكل ما في التطبيق من محتوى (التفاسير والمعاني والعمل ومقررات الأسابيع) وبيانات المستخدم (العلامات
// والملاحظات والمقادير) مربوط بترقيم حفص. فتُربط كلمات المصحفين كلمةً كلمة، ومنها تُعرف آيات حفص المقابلة
// لكل آية من آيات ورش:
//   • آية بآية (الأكثر)
//   • آية ورش = آيتان من حفص أو أكثر (عدّ الكوفي آيةً حيث لا يعدّ المدني)
//   • آيتا ورش = آية واحدة من حفص (عدّ المدني آيةً حيث لا يعدّ الكوفي)
//   • وتداخل نادر (يتقاطع الحدّان)
// وبسملة الفاتحة آية في حفص لا في ورش، فتُضمّ إلى أول آية من الفاتحة في ورش.
//
// الربط: محاذاة كلمات كل سورة (برمجة ديناميكية في شريط حول القطر) على هيكل الكلمة: حروفها بلا تشكيل ولا ألف
// ولا همزة، بتوحيد صور الياء والهاء، فلا يضرّ اختلاف الرسم («العلمين» و«العالمين»). وعلامات الربع والسجدة
// ليست كلمات فلا تدخل فيها.
//
// المخرجات:
//   public/data/warsh/quran.json  يُضاف إليه hafs: لكل آية من آيات ورش [أول آية حفص، آخرها] (وثالث إن
//                                 كانت آية حفص «الأصلية» لها غير الأولى: الآية التي فيها أول كلماتها، فبها تُحفظ
//                                 العلامة والملاحظة)
//   public/data/warsh/memos.json  محتوى المذكرات (المعاني والعمل وأقسام التفسير ومقررات الأسابيع) بترقيم ورش،
//                                 ومواضع كلمات المعاني في آيات ورش نفسها
//   public/fonts/warsh-text.woff2 خط المجمع العام لرواية ورش (الإصدار ٢١) بحروف نص ورش وحدها: به يُكتب نص آيات ورش
//                                 خارج صفحات المصحف (صفحات المحتوى والملاحظات ونتائج البحث)، فخط حفص العام لا يرسم
//                                 بعض علامات ضبط ورش
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import subsetFont from 'subset-font';

const HAFS = 'public/data/quran.json';
const WARSH = 'public/data/warsh/quran.json';
const MEMOS = 'public/data/memos.json';
const WARSH_MEMOS = 'public/data/warsh/memos.json';
const TEXT_FONT = 'public/fonts/warsh-text.woff2';
// خط ورش العام كما نزّلته الخطوة ١٢ (وإلا يُنزَّل من المصدر نفسه)
const TEXT_FONT_CACHE = '.cache/warsh/UthmanicWarsh_V21.ttf';
const TEXT_FONT_URL =
  'https://raw.githubusercontent.com/nuqayah/qpc-fonts/8a4f39d563ea69c994416a1692827e38156c548d/text-mushafs/UthmanicWarsh_V21/UthmanicWarsh%20V21.ttf';

// شريط المحاذاة: أكبر فرق بين موضعي الكلمتين المتقابلتين في السورة (فرق عدد الكلمات في أطول السور يسير)
const BAND = 80;
// كلفة كلمة بلا مقابل، وكلفة كلمتين متقابلتين مختلفتي الهيكل
const GAP = 1;
const SUB = 1.5;

// هيكل الكلمة للمقارنة
export function skeleton(word) {
  return word
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '') // التشكيل وعلامات الضبط والوقف والتطويل
    .replace(/[ٱأإآا]/g, '')
    .replace(/ؤ/g, 'و') // «مؤمن» في حفص و«مومن» في ورش
    .replace(/[ءئ]/g, '')
    .replace(/[ىےي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '');
}

// كلمات المصحف بالترتيب: { v: رقم الآية في المصحف، k: موضع الكلمة في t، s: الهيكل } — بلا رقم الآية وعلامتي الربع والسجدة
export function wordsOf(quran, sura) {
  const out = [];
  quran.verses.forEach((v, i) => {
    if (v.s !== sura) return;
    v.t.slice(0, -1).forEach((w, k) => {
      const s = skeleton(w);
      if (s) out.push({ v: i, k, s });
    });
  });
  return out;
}

// محاذاة متتاليتين من الكلمات: لكل كلمة من a موضع مقابلها في b أو -1
export function align(a, b, band = BAND) {
  const n = a.length;
  const m = b.length;
  const W = 2 * band + 1;
  const INF = 1e9;
  // cost[i][d]: أقل كلفة لمحاذاة a[0..i) مع b[0..j) حيث j = i + d - band
  const cost = new Float64Array((n + 1) * W).fill(INF);
  const from = new Uint8Array((n + 1) * W); // 1 تقابل، 2 كلمة من a بلا مقابل، 3 كلمة من b بلا مقابل
  const at = (i, j) => i * W + (j - i + band);
  const inBand = (i, j) => j >= 0 && j <= m && Math.abs(j - i) <= band;
  cost[at(0, 0)] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = Math.max(0, i - band); j <= Math.min(m, i + band); j++) {
      if (i === 0 && j === 0) continue;
      let best = INF;
      let how = 0;
      if (i > 0 && j > 0 && inBand(i - 1, j - 1)) {
        const c = cost[at(i - 1, j - 1)] + (a[i - 1].s === b[j - 1].s ? 0 : SUB);
        if (c < best) [best, how] = [c, 1];
      }
      if (i > 0 && inBand(i - 1, j)) {
        const c = cost[at(i - 1, j)] + GAP;
        if (c < best) [best, how] = [c, 2];
      }
      if (j > 0 && inBand(i, j - 1)) {
        const c = cost[at(i, j - 1)] + GAP;
        if (c < best) [best, how] = [c, 3];
      }
      cost[at(i, j)] = best;
      from[at(i, j)] = how;
    }
  }
  if (!inBand(n, m)) throw new Error(`فرق الكلمات ${Math.abs(n - m)} أكبر من الشريط`);
  const match = new Int32Array(n).fill(-1);
  let subs = 0;
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const how = from[at(i, j)];
    if (how === 1) {
      match[i - 1] = j - 1;
      if (a[i - 1].s !== b[j - 1].s) subs++;
      i--;
      j--;
    } else if (how === 2) i--;
    else j--;
  }
  return { match, subs, cost: cost[at(n, m)] };
}

/*
  الربط كله: يرجع
    hafs   — لكل آية من آيات ورش [أول، آخر] أو [أول، آخر، الأصلية]
    word   — Map: 'آية حفص:موضع الكلمة' ← [آية ورش، موضع الكلمة] للكلمات المتقابلة
    report — للتحقق والطباعة
*/
export function mapWarsh(hafs, warsh) {
  const ranges = warsh.verses.map(() => null);
  const firstOf = warsh.verses.map(() => null); // آية حفص التي فيها أول كلمة متقابلة من آية ورش
  const word = new Map();
  const report = { subs: 0, gaps: 0 };
  for (let s = 1; s <= 114; s++) {
    const W = wordsOf(warsh, s);
    const H = wordsOf(hafs, s);
    const { match, subs } = align(W, H);
    report.subs += subs;
    W.forEach((w, i) => {
      if (match[i] < 0) {
        report.gaps++;
        return;
      }
      const h = H[match[i]];
      word.set(`${h.v}:${h.k}`, [w.v, w.k]);
      const r = ranges[w.v];
      ranges[w.v] = r ? [Math.min(r[0], h.v), Math.max(r[1], h.v)] : [h.v, h.v];
      if (firstOf[w.v] === null) firstOf[w.v] = h.v;
    });
  }
  // آيات حفص التي لم تقابلها كلمة (بسملة الفاتحة): تُضمّ إلى آية ورش التي تقابل الآية بعدها في سورتها
  const covered = new Uint8Array(hafs.verses.length);
  ranges.forEach((r) => {
    if (r) for (let h = r[0]; h <= r[1]; h++) covered[h] = 1;
  });
  const attached = [];
  for (let h = hafs.verses.length - 1; h >= 0; h--) {
    if (covered[h]) continue;
    const w = ranges.findIndex((r) => r && r[0] === h + 1 && hafs.verses[h + 1].s === hafs.verses[h].s);
    if (w < 0) throw new Error(`آية حفص ${hafs.verses[h].s}:${hafs.verses[h].a} بلا مقابل`);
    ranges[w][0] = h;
    covered[h] = 1;
    attached.push(`${hafs.verses[h].s}:${hafs.verses[h].a}`);
  }
  report.attached = attached;
  const out = ranges.map((r, w) => {
    if (!r) throw new Error(`آية ورش ${warsh.verses[w].s}:${warsh.verses[w].a} بلا مقابل`);
    return firstOf[w] === r[0] ? r : [r[0], r[1], firstOf[w]];
  });
  return { hafs: out, word, report };
}

// آيات ورش المقابلة لكل آية من حفص (عكس hafs)
export function warshOfHafs(hafsRanges, hafsCount) {
  const out = Array.from({ length: hafsCount }, () => []);
  hafsRanges.forEach(([a, b], w) => {
    for (let h = a; h <= b; h++) out[h].push(w);
  });
  return out;
}

// التحقق من الربط: يرجع قائمة المشكلات (فارغة إن صحّ)
export function checkMap(hafs, warsh, ranges) {
  const problems = [];
  const name = (q, i) => `${q.verses[i].s}:${q.verses[i].a}`;
  const back = warshOfHafs(ranges, hafs.verses.length);
  back.forEach((ws, h) => {
    if (!ws.length) problems.push(`آية حفص ${name(hafs, h)} بلا مقابل`);
  });
  ranges.forEach(([a, b], w) => {
    if (a > b) problems.push(`ورش ${name(warsh, w)}: مدى مقلوب`);
    for (let h = a; h <= b; h++) if (hafs.verses[h].s !== warsh.verses[w].s) problems.push(`ورش ${name(warsh, w)} تقابل حفص ${name(hafs, h)} من سورة أخرى`);
    if (w > 0) {
      const [pa, pb] = ranges[w - 1];
      // التتابع: تبدأ حيث انتهت سابقتها (آية مقسومة بينهما) أو بعدها مباشرة
      if (a < pa || (a !== pb && a !== pb + 1)) problems.push(`ورش ${name(warsh, w)}: [${a}, ${b}] لا يتبع [${pa}, ${pb}]`);
    }
  });
  return problems;
}

// أنواع المواضع: آية بآية، وآية ورش بأكثر من آية حفص، وآية حفص بأكثر من آية ورش
export function mapKinds(ranges, hafsCount) {
  const back = warshOfHafs(ranges, hafsCount);
  const kinds = { same: 0, merged: [], split: [] };
  ranges.forEach(([a, b], w) => {
    if (a === b && back[a].length === 1) kinds.same++;
    else if (b > a) kinds.merged.push(w);
  });
  back.forEach((ws, h) => {
    if (ws.length > 1) kinds.split.push(h);
  });
  return kinds;
}

// ---------- المذكرات بترقيم ورش ----------
export function warshMemos(memos, hafs, warsh, ranges, word) {
  const back = warshOfHafs(ranges, hafs.verses.length);
  const first = (h) => back[h][0];
  const last = (h) => back[h].at(-1);
  const span = ([a, b]) => [first(a), last(b)];
  const report = { meanings: 0, placed: 0 };
  const meanings = memos.meanings.map(([h, text, meaning, section, from, to]) => {
    report.meanings++;
    if (from !== undefined) {
      // موضع الكلمة في آية ورش: كل كلماتها متقابلة، في آية واحدة، متتالية
      const ks = [];
      for (let k = from; k <= to; k++) {
        if (!skeleton(hafs.verses[h].t[k])) continue;
        ks.push(word.get(`${h}:${k}`));
      }
      const ok = ks.length && ks.every((x) => x && x[0] === ks[0][0]) && ks.every((x, i) => !i || x[1] === ks[i - 1][1] + 1);
      if (ok) {
        report.placed++;
        return [ks[0][0], text, meaning, section, ks[0][1], ks.at(-1)[1]];
      }
      // لم تتقابل الكلمة: تُكتب كما في المذكرة، في آية ورش التي فيها أول كلمات آية حفص
    }
    return [first(h), text, meaning, section];
  });
  // ترتيب المعاني بالآيات ثم بمواضعها، كترتيبها في حفص
  return {
    memos: {
      ...memos,
      riwayah: 'warsh',
      sections: memos.sections.map((s) => ({ ...s, r: s.r.map(span) })),
      weeks: memos.weeks.map(span),
      meanings,
      actions: memos.actions.map((a) => ({ ...a, v: [...new Set(a.v.flatMap((h) => back[h]))].sort((x, y) => x - y) })),
    },
    report,
  };
}

async function main() {
  const hafs = JSON.parse(await readFile(HAFS, 'utf8'));
  const warsh = JSON.parse(await readFile(WARSH, 'utf8'));
  const memos = JSON.parse(await readFile(MEMOS, 'utf8'));

  const { hafs: ranges, word, report } = mapWarsh(hafs, warsh);
  const problems = checkMap(hafs, warsh, ranges);
  const kinds = mapKinds(ranges, hafs.verses.length);
  const { memos: wm, report: mr } = warshMemos(memos, hafs, warsh, ranges, word);

  warsh.hafs = ranges;
  await writeFile(WARSH, JSON.stringify(warsh));
  await writeFile(WARSH_MEMOS, JSON.stringify(wm));

  // خط نص ورش: حروف آياته كلها، وقوسا الاقتباس
  if (!(await access(TEXT_FONT_CACHE).then(() => true, () => false))) {
    const res = await fetch(TEXT_FONT_URL);
    if (!res.ok) throw new Error(`${TEXT_FONT_URL}: HTTP ${res.status}`);
    await mkdir('.cache/warsh', { recursive: true });
    await writeFile(TEXT_FONT_CACHE, Buffer.from(await res.arrayBuffer()));
  }
  const chars = new Set('﴿﴾ ');
  for (const v of warsh.verses) for (const c of v.t.join(' ')) chars.add(c);
  const font = await subsetFont(await readFile(TEXT_FONT_CACHE), [...chars].join(''), { targetFormat: 'woff2' });
  await writeFile(TEXT_FONT, font);

  const name = (q, i) => `${q.verses[i].s}:${q.verses[i].a}`;
  console.log('═══ ربط ترقيم ورش بحفص ═══');
  console.log(`آية بآية: ${kinds.same} · آية ورش بأكثر من آية حفص: ${kinds.merged.length} · آية حفص بأكثر من آية ورش: ${kinds.split.length}`);
  console.log(`كلمات مختلفة الهيكل متقابلة: ${report.subs} · كلمات ورش بلا مقابل: ${report.gaps} · آيات حفص ضُمّت: ${report.attached.join(' ')}`);
  console.log(`ورش ← حفص: ${kinds.merged.map((w) => `${name(warsh, w)}←${ranges[w][0] === ranges[w][1] ? '' : `${name(hafs, ranges[w][0])}–${name(hafs, ranges[w][1])}`}`).join(' ')}`);
  console.log(`حفص مقسومة: ${kinds.split.map((h) => name(hafs, h)).join(' ')}`);
  console.log(`المعاني: ${mr.meanings} · بموضعها في آية ورش: ${mr.placed}`);
  console.log(`خط نص ورش: ${chars.size} حرفًا · ${(font.length / 1024).toFixed(0)} ك.ب`);
  if (problems.length) {
    console.log(`مشكلات (${problems.length}): ${problems.slice(0, 20).join(' | ')}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
