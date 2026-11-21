// ويدجت «آية اليوم» (تطبيق أندرويد، الجلسة ٣ ج ٢): آية كل يوم من قائمة ثابتة (src/data/ayahOfDay.js)، بخط المصحف
// وتشكيله، وتحتها اسم السورة ورقم الآية؛ وفي ورش برسمه وترقيمه.
//
// • أندرويد نفسه يختار آية اليوم ويرسمها والتطبيق مغلق (android/.../widgets/AyahWidget.java)، من بيانات مبنية مع
//   التطبيق (scripts/data/18-ayah-of-day.mjs ← ayahEntries أدناه)؛ فلا يحتاج من الصفحة إلا الألوان والرواية
//   (syncAyahWidget في src/lib/widgets.js).
// • آية اليوم بترتيبها من يوم ثابت (ayahIndex)، كـ AyahDays.index في أندرويد.
// • الضغط عليه يفتح التطبيق بحدث «open» نوعه «ayah:رقم آية حفص» (parseAyahOpen)، فتُفتح صفحتها وتُميَّز.
import { AYAH_EPOCH, AYAT_OF_DAY } from '../data/ayahOfDay.js';
import { toArabicDigits } from '../data/quran.js';

const n = toArabicDigits;
const DAY_MS = 24 * 60 * 60 * 1000;

// رقم يوم «YYYY-MM-DD» (أيام منذ ١٩٧٠-٠١-٠١) بلا أثر للمنطقة الزمنية
const dayNumber = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

// موضع آية اليوم day في القائمة: ٠ يوم AYAH_EPOCH، ثم بالترتيب، وتعود الدورة بعد آخرها (وقبله بالعكس)
export function ayahIndex(day, count = AYAT_OF_DAY.length) {
  const k = (dayNumber(day) - dayNumber(AYAH_EPOCH)) % count;
  return k < 0 ? k + count : k;
}

// «سورة الشرح · ٥–٦» · «سورة الزمر · ٥٣»
export function ayahRef(name, first, last = first) {
  return `سورة ${name} · ${first === last ? n(first) : `${n(first)}–${n(last)}`}`;
}

// نص آيات المصحف from..to (بالترتيب) بخط المصحف، وكل آية بعلامة نهايتها
const textOf = (quran, from, to) => quran.verses.slice(from, to + 1).flatMap((v) => v.t).join(' ');

// آيات ورش المقابلة لآيات حفص h0..h1: كل آية ورش يقع فيها شيء منها، كاملة
export function warshVersesOf(warsh, h0, h1) {
  const out = [];
  warsh.hafs.forEach(([a, b], w) => {
    if (a <= h1 && b >= h0) out.push(w);
  });
  return out;
}

/*
  بيانات الويدجت: لكل آية من القائمة بترتيبها
    { h: [أول آية حفص، آخرها] (من ٠، لفتح صفحتها)، topic، e: نصها الإملائي (لقارئ الشاشة)،
      hafs: { text, ref }، warsh: { text, ref } }
  hafs وwarsh: بيانات المصحفين (public/data/quran.json وpublic/data/warsh/quran.json)
*/
export function ayahEntries(hafs, warsh, list = AYAT_OF_DAY) {
  const at = new Map(hafs.verses.map((v, i) => [`${v.s}:${v.a}`, i]));
  return list.map(([s, a, b, topic]) => {
    const h0 = at.get(`${s}:${a}`);
    const h1 = at.get(`${s}:${b}`);
    if (h0 == null || h1 == null || h1 < h0) throw new Error(`آية غير موجودة: ${s}:${a}–${b}`);
    const ws = warshVersesOf(warsh, h0, h1);
    if (!ws.length || ws.some((w, i) => i > 0 && w !== ws[i - 1] + 1)) throw new Error(`لا مقابل متصل في ورش: ${s}:${a}–${b}`);
    const w0 = warsh.verses[ws[0]];
    const w1 = warsh.verses[ws.at(-1)];
    if (w0.s !== s || w1.s !== s) throw new Error(`مقابل ورش في سورة أخرى: ${s}:${a}–${b}`);
    return {
      h: [h0, h1],
      topic,
      e: hafs.verses
        .slice(h0, h1 + 1)
        .map((v) => v.e)
        .join(' '),
      hafs: { text: textOf(hafs, h0, h1), ref: ayahRef(hafs.suras[s - 1].name, a, b) },
      warsh: { text: textOf(warsh, ws[0], ws.at(-1)), ref: ayahRef(warsh.suras[s - 1].name, w0.a, w1.a) },
    };
  });
}

// حدث «open» من الضغط على الويدجت: «ayah:1234» ← رقم آية حفص (من ٠)، وإلا null
export function parseAyahOpen(type) {
  const m = /^ayah:(\d+)$/.exec(type ?? '');
  return m ? Number(m[1]) : null;
}
