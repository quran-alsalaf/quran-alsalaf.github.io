// القرّاء (الفصل ٦): بياناتهم في src/data/reciters.json لا في الكود — فيُضاف قارئ جديد بسطر واحد
// هناك، بشرط توفّر ملف مستقل لكل آية له (٦٢٣٦ ملفًّا كاملة، رواية حفص)، لا ملف سورة كامل.
// ولكل قارئ مصدر (source) له قالب رابط في "sources" بالملف نفسه: {folder} و{sura} و{ayah}
// (السورة والآية بثلاث خانات). وتُقرأ البسملة قبل أول كل سورة من ملف الفاتحة ١:١ بصوت القارئ نفسه
// (src/lib/player.js)، فيلزم أن يكون ملف الآية الأولى من كل سورة بلا بسملة كسائر القرّاء.
// ولكل قارئ مجموعة (group) من "groups" في الملف نفسه — مجوّد، معلّم، مرتّل — بها تُقسَم صفحة الاختيار
// بترتيب "groups"، وفي كل مجموعة بترتيب القرّاء في الملف. ولمجموعة المجوّد والمعلّم إلحاق (suffix) يُكتب
// بجانب الاسم خارج صفحة الاختيار (نافذة الاستماع وشاشة القفل) لتمييز تسجيلات القارئ الواحد.
// ولكل قارئ حجم تقريبي لملفاته كلها بالميغابايت (mb) يُعرض قبل تحميله على الجهاز (src/lib/offline.js):
// لقرّاء everyayah مجموع أحجام الملفات من قائمة مجلده، وللنفيس تقدير من عيّنة ملفات (٢٠٢٦-١١-١٤).
//
// سجلّ البحث ٢٠٢٦-١١-١٠ (everyayah بمطابقة قائمة ملفات كل مجلد بالآيات الـ٦٢٣٦، وQUL/Tarteel،
// وquran.com، وalquran.cloud): أُضيف ١٧ قارئًا اختارهم صاحب المشروع، كلهم ٦٢٣٦/٦٢٣٦، وملف الآية
// الأولى من كل سورة عندهم بلا بسملة. ولم يتوفر ملف آية بآية برواية حفص لياسين الجزائري (everyayah
// عنده رواية ورش)، ولا لخالد الغامدي ولا لابن طالب ولا للبعيجان ولا للحيدان ولا لوديع اليمني ولا لرعد
// الكردي ولا لمحمد خليل القارئ (سور كاملة فقط). وفي everyayah تسجيلات كاملة تضع البسملة داخل ملف
// الآية الأولى (محمود علي البنا، محمد عبد الكريم، پرهيزگار، ونسخة ketaballah للعجمي) فلا تصلح كما هي.
//
// سجلّ البحث ٢٠٢٦-١١-١٤ (everyayah، وموقع القرآن لجامعة الملك سعود quran.ksu.edu.sa/ayat/mp3، وQUL/Tarteel،
// وquran.com، وalquran.cloud، وquranicaudio، وmp3quran، وروابط تطبيقات مفتوحة على GitHub): أُضيف بطلب
// صاحب المشروع أكرم العلاقمي وسهل ياسين وعزيز عليلي (everyayah، ٦٢٣٦/٦٢٣٦، وفُحص ملف الآية الأولى من
// كل السور فلا بسملة فيه). وصالحون لم يُطلبوا: محمد جبريل، أحمد نعينع، خالد القحطاني، علي حجاج السويسي
// (everyayah)، ومصطفى إسماعيل (جامعة الملك سعود Mostafa_Ismail_128kbps، كامل، لكن الموقع بلا CORS فلا
// يعمل له التحميل لكامل القرآن). وكريم منصوري البسملة داخل ملف الآية الأولى عنده كالمذكورين أعلاه، ونبيل
// الرفاعي ناقص ٥ آيات. ولم يُفحص لحجب الشبكة: إبراهيم الدوسري (cdn.equran.id/audio-partial)، وأيمن سويد
// المعلّم (archive.org: Quran4u_Sweed_Muallim_Ayah)، وتسجيلات Quranpedia.
//
// قرّاء رواية ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٣): في reciters.json بحقل riwayah: 'warsh'، ولا يظهر في كل
// مصحف إلا قرّاء روايته (بقرار صاحب المشروع)، ولكل رواية قارئها المختار (src/lib/player.js). فُحصت تسجيلاتهم
// ملفًّا ملفًّا وبُني ما يلزمها بـ scripts/data/14-warsh-reciters.mjs (src/data/warsh-audio.json)، ومنه:
// • ملفاتهم بترقيم ورش، إلا hafsKeyed: سور (أو كل المصحف: true) ملفاتها بترقيم حفص، فتُقرأ آية ورش بملفات حفص
//   المقابلة لها (src/lib/verseMap.js): آية ورش التي تقابل آيتين من حفص ملفّان، وآيتا ورش من آية حفص واحدة ملف واحد.
// • same: آية في ملف التي قبلها (قرأهما القارئ وصلًا أو كُرِّر الملف)، فتُقرأ معها مرة واحدة.
// • fix: ملف بديل للآية (رابط آخر للتسجيل نفسه، أو مقطع قُطع من ملف السورة ويُبنى مع التطبيق).
// • البسملة قبل أول كل سورة: basmala: 'sura' ملف لكل سورة ({sura}000، وقبل الفاتحة أيضًا)، وإلا ملف الفاتحة ١:١
//   بترقيم حفص (عدا الفاتحة)؛ ولا تُسبق بها سور basmalaIn (البسملة داخل ملف آيتها الأولى). ولا بسملة قبل التوبة.
import data from '../data/reciters.json';
import warshAudio from '../data/warsh-audio.json';
import { hafsOf } from './verseMap.js';

const ALL = data.reciters;
// قرّاء حفص (بترتيبهم في الملف) — RECITERS كما كان قبل إضافة ورش
export const RECITERS = ALL.filter((r) => !r.riwayah || r.riwayah === 'hafs');
export const WARSH_RECITERS = ALL.filter((r) => r.riwayah === 'warsh').map((r) => ({ ...r, ...warshAudio[r.id] }));
// قرّاء الرواية ('hafs' | 'warsh')
export const recitersOf = (riwayah) => (riwayah === 'warsh' ? WARSH_RECITERS : RECITERS);
export const riwayahOf = (r) => (r.riwayah === 'warsh' ? 'warsh' : 'hafs');
// القارئ الافتراضي لكل رواية
export const DEFAULT_RECITER = { hafs: 'shuraym', warsh: 'w-husary' };

export const GROUPS = data.groups;
const groupOf = (r) => GROUPS.find((g) => g.id === r.group) ?? GROUPS.at(-1);
// القرّاء مقسَّمين إلى مجموعاتهم بالترتيب المطلوب، بلا مجموعة فارغة: [{ id, title, reciters }]
export const groupReciters = (list) =>
  GROUPS.map((g) => ({ ...g, reciters: list.filter((r) => groupOf(r) === g) })).filter((g) => g.reciters.length);
// الاسم مع إلحاق المجموعة إن كان لها إلحاق، لتمييز تسجيلات القارئ الواحد خارج صفحة الاختيار
export const reciterTitle = (r) => (groupOf(r).suffix ? `${r.name} (${groupOf(r).suffix})` : r.name);

const byId = new Map([...RECITERS, ...WARSH_RECITERS].map((r) => [r.id, r]));
export const reciterById = (id) => byId.get(id) ?? RECITERS[0];
// قارئ id إن كان من الرواية riwayah، وإلا قارئها الافتراضي
export const reciterFor = (id, riwayah) => {
  const r = byId.get(id);
  return r && riwayahOf(r) === riwayah ? r : byId.get(DEFAULT_RECITER[riwayah]);
};

const pad = (n) => String(n).padStart(3, '0');
export const ayahUrl = (r, s, a) =>
  data.sources[r.source].replace('{folder}', r.folder).replace('{sura}', pad(s)).replace('{ayah}', pad(a));

// هل يشمل تسجيل القارئ كل هذه السور؟ (كل القرّاء الآن كاملون، فتبقى الدالة للتوسّع لاحقًا)
export const covers = (r, suras) => !r.missing || suras.every((s) => !r.missing.includes(s));

// ---------- عدد الآيات ----------
// عدد آيات كل سورة بترقيم حفص (المجموع ٦٢٣٦) — يطابق public/data/quran.json (tests/unit/offline.test.js)
export const HAFS_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69,
  60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
  11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19,
  5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
// وبترقيم ورش (المجموع ٦٢١٤) — يطابق public/data/warsh/quran.json (tests/unit/warsh-reciters.test.js)
export const WARSH_COUNTS = [
  7, 285, 200, 175, 122, 167, 206, 76, 130, 109, 121, 111, 44, 54, 99, 128, 110, 105, 99, 134, 111, 76, 119, 62, 77, 226, 95, 88, 69,
  59, 33, 30, 73, 54, 46, 82, 182, 86, 72, 84, 53, 50, 89, 56, 36, 34, 39, 29, 18, 45, 60, 47, 61, 55, 77, 99, 28, 21, 24, 13, 14, 11,
  11, 18, 12, 12, 31, 52, 52, 44, 30, 28, 18, 55, 39, 31, 50, 40, 45, 42, 29, 19, 36, 25, 22, 17, 19, 26, 32, 20, 15, 21, 11, 8, 8, 20,
  5, 8, 9, 11, 10, 8, 3, 9, 5, 5, 6, 3, 6, 3, 5, 4, 5, 6,
];
// السورة والآية لآية حفص ذات الترتيب h في المصحف (من ٠)
const hafsStarts = HAFS_COUNTS.reduce((acc, n, i) => (acc.push((acc[i - 1] ?? 0) + (HAFS_COUNTS[i - 1] ?? 0)), acc), []);
function hafsSA(h) {
  let s = 0;
  while (s + 1 < 114 && hafsStarts[s + 1] <= h) s++;
  return { s: s + 1, a: h - hafsStarts[s] + 1 };
}

// ---------- ملفات القارئ ----------
const keyed = (r, s) => r.hafsKeyed === true || !!r.hafsKeyed?.includes(s);
// رابط ملف بديل (fix) للآية s:a، أو null
function fixUrl(r, s, a) {
  const f = r.fix?.[`${s}:${a}`];
  if (!f) return null;
  if (f.url) return f.url;
  // رابط كامل (مفتاح ذاكرة التحميل رابط كامل)
  const path = `${import.meta.env.BASE_URL}audio/warsh/${r.id}/${pad(s)}${pad(a)}.mp3`;
  return typeof location === 'undefined' ? path : new URL(path, location.href).href;
}
const sameSets = new WeakMap();
const isSame = (r, s, a) => {
  let set = sameSets.get(r);
  if (!set) sameSets.set(r, (set = new Set(r.same ?? [])));
  return set.has(`${s}:${a}`);
};

// روابط الملفات التي تُقرأ بها الآية v من المصحف المعروض quran، بالقارئ r، بالترتيب. وآية في ملف التي قبلها
// (same) تُعطى ملفَّ تلك، فيضمّهما المشغّل في مقطع واحد
export function verseFiles(r, quran, v) {
  const { s, a } = quran.verses[v];
  if (riwayahOf(r) === 'hafs') return [ayahUrl(r, s, a)];
  const fix = fixUrl(r, s, a);
  if (fix) return [fix];
  if (keyed(r, s)) return hafsOf(quran, v).map((h) => {
    const x = hafsSA(h);
    return ayahUrl(r, x.s, x.a);
  });
  if (a > 1 && isSame(r, s, a)) return verseFiles(r, quran, v - 1).slice(-1);
  return [ayahUrl(r, s, a)];
}

// رابط البسملة قبل الآية v إن كانت أول سورتها وتُسبق بها، وإلا null
export function basmalaFile(r, quran, v) {
  const { s, a } = quran.verses[v];
  if (a !== 1 || s === 9 || r.basmalaIn?.includes(s)) return null;
  if (r.basmala === 'sura') return ayahUrl(r, s, 0);
  return s === 1 ? null : ayahUrl(r, 1, 1);
}

// روابط ملفات القارئ كلها (للتحميل لكامل القرآن)، بلا مكرر، ومنها البسملة
export function allFiles(r) {
  const urls = [];
  if (riwayahOf(r) === 'hafs') {
    HAFS_COUNTS.forEach((n, i) => {
      if (r.missing?.includes(i + 1)) return;
      for (let a = 1; a <= n; a++) urls.push(ayahUrl(r, i + 1, a));
    });
    return urls;
  }
  WARSH_COUNTS.forEach((n, i) => {
    const s = i + 1;
    if (r.basmala === 'sura' && s !== 9) urls.push(ayahUrl(r, s, 0));
    if (keyed(r, s)) {
      for (let a = 1; a <= HAFS_COUNTS[i]; a++) urls.push(ayahUrl(r, s, a));
      return;
    }
    for (let a = 1; a <= n; a++) {
      const fix = fixUrl(r, s, a);
      if (fix) urls.push(fix);
      else if (!(a > 1 && isSame(r, s, a))) urls.push(ayahUrl(r, s, a));
    }
  });
  return [...new Set(urls)];
}
