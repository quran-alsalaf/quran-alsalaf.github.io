// قرّاء رواية ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٣): فحص تسجيلاتهم آيةً آية وبناء ما يلزم لتشغيلها.
//   NODE_USE_ENV_PROXY=1 node scripts/data/14-warsh-reciters.mjs
//   (يحتاج شبكة إلى files.quranpedia.net وeveryayah.com وwww.mp3quran.net وcdn.mp3quran.net، وffmpeg)
//
// القرّاء الخمسة في src/data/reciters.json (riwayah: 'warsh')، ومصدرهم:
//   • Quranpedia (الحصري، عبد الباسط، ياسين الجزائري، العيون الكوشي): ملف لكل آية بترقيم ورش ({sura}{ayah}.mp3)،
//     وملف البسملة لكل سورة ({sura}000.mp3، عدا التوبة: basmala: 'sura')؛ وملف الآية الأولى بلا بسملة.
//   • everyayah (إبراهيم الدوسري): ملف لكل آية بترقيم حفص (hafsKeyed: true)، والبسملة ملف الفاتحة ١:١ كقرّاء حفص.
//   وأُجِّل عبد الكريم الدغوش (Quranpedia 264) بقرار صاحب المشروع: تسجيله مقطوع على غير تقسيم الآيات (نحو ٤٢٠
//   موضعًا آيتان في ملف واحد، وبسملة مكررة في أول بضع سور)، ولا مصدر آخر له آيةً آية.
//
// ما وُجد في الفحص (٢٠٢٦-١١-١٥، بمقارنة مدة كل ملف بمدد القرّاء الآخرين وبتوقيت mp3quran المنشور) فعُولج:
//   • سورة الملك في Quranpedia مقطوعة بتقسيم حفص عند القرّاء الأربعة (٣٠ ملفًّا لآيات ورش الـ٣١: الملف ٩ فيه آيتا
//     ورش ٩ و١٠) ⇐ hafsKeyed: [67]، فتُقرأ بملفات حفص المقابلة (src/lib/reciters.js).
//   • آيات متتالية بملف واحد مكرَّر (بصمة ETag واحدة؛ عند الكوشي في ٦٥ موضعًا قُطع فيها بتقسيم حفص ثم كُرِّر الملف
//     لآيتي ورش) ⇐ «same» في المخرجات: الآية في ملف التي قبلها، فيُقرأ مرة واحدة وتُظلَّل الآيتان معًا.
//     ومثلها ما ليس نسخة مطابقة لكنه يحوي الآيتين (merge في reciters.json: الكوشي، الفاتحة ٦ فيها ٦ و٧).
//   • البسملة داخل ملف الآية الأولى من سورة القلم عند الخمسة (قرؤوها وصلًا بـ«نۤ») ⇐ basmalaIn: [68]، فلا تُسبق ببسملة.
//   • ملفات ناقصة أو تالفة ⇐ fix في reciters.json: { url } رابط بديل للتسجيل نفسه، أو { cut: رقم التلاوة في
//     mp3quran } فتُقطع الآية من ملف السورة بتوقيتها المنشور (مضبوطًا على أقرب سكتة) إلى
//     public/audio/warsh/<id>/<sura><ayah>.mp3، ويُبنى مع التطبيق: الحصري النحل ٦١ (ملفه مقطوع)، وعبد الباسط
//     التوبة ٤١ (ناقص، من everyayah)، وياسين الحج ٤ والشعراء ٢٦ والغاشية ٢٦، والكوشي آل عمران ١٤٠ (ناقص).
// المخرجات:
//   • src/data/warsh-audio.json: { [id]: { same: ['سورة:آية', ...], mb } } — mb الحجم التقريبي لملفاته كلها.
//   • public/audio/preview/warsh/<id>.mp3: مقطع المعاينة («الحمد لله رب العالمين»، الفاتحة ١ في ورش).
// ويتوقف إن نقص ملف لا بديل له.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('src/data/reciters.json', 'utf8'));
const warsh = JSON.parse(readFileSync('public/data/warsh/quran.json', 'utf8'));
const hafs = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
const TMP = process.env.WARSH_TMP || '/tmp/warsh-reciters';
mkdirSync(TMP, { recursive: true });

const pad = (n) => String(n).padStart(3, '0');
const tpl = (r, s, a) => data.sources[r.source].replace('{folder}', r.folder).replace('{sura}', pad(s)).replace('{ayah}', pad(a));
const hafsCounts = hafs.suras.map((x) => x.count);

async function head(url) {
  for (let t = 0; ; t++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, { method: 'HEAD' });
      return { ok: res.ok, size: Number(res.headers.get('content-length')) || 0, etag: res.headers.get('etag') };
    } catch (e) {
      if (t >= 4) throw e;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
    }
  }
}
async function headAll(urls) {
  const out = new Map();
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      // eslint-disable-next-line no-await-in-loop
      out.set(u, await head(u));
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));
  return out;
}

// ---------- قطع آية من ملف سورة بتوقيت mp3quran ----------
const MP3QURAN = {}; // رقم التلاوة ⇐ مجلد ملفات السور
async function surahFolder(read) {
  if (!MP3QURAN[read]) {
    const res = await fetch('https://www.mp3quran.net/api/v3/ayat_timing/reads');
    for (const x of await res.json()) MP3QURAN[x.id] = x.folder_url;
  }
  return MP3QURAN[read];
}
// السكتات حول t (في نافذة ±1 ث) ⇐ [[بدايتها، نهايتها]]
function silences(file, t) {
  // ffmpeg يكتب نتائج silencedetect في stderr
  const r = (() => {
    try {
      return execFileSync('sh', ['-c', `ffmpeg -hide_banner -ss ${Math.max(0, t - 1)} -t 2 -i "${file}" -af silencedetect=noise=-35dB:d=0.12 -f null - 2>&1`], { encoding: 'utf8' });
    } catch (e) {
      return String(e.stdout ?? '');
    }
  })();
  const base = Math.max(0, t - 1);
  const starts = [...r.matchAll(/silence_start: ([\d.]+)/g)].map((m) => base + Number(m[1]));
  const ends = [...r.matchAll(/silence_end: ([\d.]+)/g)].map((m) => base + Number(m[1]));
  return starts.map((s, i) => [s, ends[i] ?? base + 2]);
}
// أقرب سكتة إلى t (وسطها)، وإلا t نفسه
function bestCut(file, t) {
  let best = t;
  let dist = Infinity;
  for (const [a, b] of silences(file, t)) {
    const mid = (a + b) / 2;
    if (Math.abs(mid - t) < dist) {
      dist = Math.abs(mid - t);
      best = mid;
    }
  }
  return dist <= 1 ? best : t;
}
async function cutAyah(read, s, a, out) {
  if (existsSync(out)) return;
  const folder = await surahFolder(read);
  const res = await fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${s}&read=${read}`);
  const timing = await res.json();
  const x = timing.find((y) => y.ayah === a);
  if (!x) throw new Error(`لا توقيت للآية ${s}:${a} في التلاوة ${read}`);
  const src = `${TMP}/mp3quran-${read}-${pad(s)}.mp3`;
  if (!existsSync(src)) {
    const f = await fetch(`${folder}${pad(s)}.mp3`);
    if (!f.ok) throw new Error(`${folder}${pad(s)}.mp3: ${f.status}`);
    writeFileSync(src, Buffer.from(await f.arrayBuffer()));
  }
  const start = bestCut(src, x.start_time / 1000);
  const end = bestCut(src, x.end_time / 1000);
  mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', src, '-c:a', 'libmp3lame', '-b:a', '96k', out]);
  console.log(`  قُطعت ${s}:${a} (${start.toFixed(2)}–${end.toFixed(2)} ث، المنشور ${x.start_time / 1000}–${x.end_time / 1000}) ⇐ ${out}`);
}

// ---------- الفحص ----------
const out = {};
for (const r of data.reciters.filter((x) => x.riwayah === 'warsh')) {
  console.log(`— ${r.name} (${r.id})`);
  const fix = r.fix ?? {};
  const keyed = (s) => r.hafsKeyed === true || r.hafsKeyed?.includes(s);
  // ملفات القارئ بمفاتيحه هو: آيات ورش في السور المرقّمة بورش، وآيات حفص في غيرها، والبسملة
  const want = [];
  for (const v of warsh.verses) if (!keyed(v.s) && !fix[`${v.s}:${v.a}`]) want.push({ s: v.s, a: v.a });
  hafsCounts.forEach((n, i) => {
    if (keyed(i + 1)) for (let a = 1; a <= n; a++) want.push({ s: i + 1, a });
  });
  if (r.basmala === 'sura') for (let s = 1; s <= 114; s++) if (s !== 9) want.push({ s, a: 0 });
  // eslint-disable-next-line no-await-in-loop
  const got = await headAll(want.map((x) => tpl(r, x.s, x.a)));
  const missing = want.filter((x) => !got.get(tpl(r, x.s, x.a)).ok);
  if (missing.length) throw new Error(`${r.id}: ملفات ناقصة بلا بديل: ${missing.map((x) => `${x.s}:${x.a}`).join(' ')}`);

  // آيات متتالية بالملف نفسه (في السور المرقّمة بورش)
  const same = [...(r.merge ?? [])];
  let prev = null;
  for (const v of warsh.verses) {
    const k = `${v.s}:${v.a}`;
    if (keyed(v.s) || fix[k] || v.a === 1) {
      prev = keyed(v.s) || fix[k] ? null : got.get(tpl(r, v.s, v.a)).etag;
      continue;
    }
    const e = got.get(tpl(r, v.s, v.a)).etag;
    if (e && e === prev && !same.includes(k)) same.push(k);
    prev = e;
  }

  // البدائل: رابط آخر للتسجيل نفسه، أو قطع من ملف السورة
  let fixBytes = 0;
  for (const [k, f] of Object.entries(fix)) {
    const [s, a] = k.split(':').map(Number);
    if (f.url) {
      // eslint-disable-next-line no-await-in-loop
      const h = await head(f.url);
      if (!h.ok) throw new Error(`${r.id} ${k}: البديل غير موجود ${f.url}`);
      fixBytes += h.size;
    } else if (f.cut) {
      const file = `public/audio/warsh/${r.id}/${pad(s)}${pad(a)}.mp3`;
      // eslint-disable-next-line no-await-in-loop
      await cutAyah(f.cut, s, a, file);
      fixBytes += readFileSync(file).length;
    }
  }

  const bytes = [...got.values()].reduce((t, x) => t + x.size, 0) + fixBytes;
  out[r.id] = { same, mb: Math.round(bytes / 1048576) };
  console.log(`  ${got.size} ملفًّا كلها موجودة، آيات في ملف سابقتها: ${same.length}، البدائل: ${Object.keys(fix).length}، نحو ${out[r.id].mb} م.ب`);

  // مقطع المعاينة: الفاتحة ١ في ورش «الحمد لله رب العالمين» (في ترقيم حفص الفاتحة ٢)
  const pv = `public/audio/preview/warsh/${r.id}.mp3`;
  if (!existsSync(pv)) {
    const url = r.hafsKeyed === true ? tpl(r, 1, 2) : tpl(r, 1, 1);
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${r.id}: المعاينة ${res.status}`);
    mkdirSync('public/audio/preview/warsh', { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    writeFileSync(pv, Buffer.from(await res.arrayBuffer()));
  }
}
writeFileSync('src/data/warsh-audio.json', `${JSON.stringify(out, null, 1)}\n`);
console.log('✓ src/data/warsh-audio.json');
