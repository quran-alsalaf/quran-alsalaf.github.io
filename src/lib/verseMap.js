// ربط ترقيم ورش بترقيم حفص (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٢).
//
// كل ما يُحفظ ويُقرأ في التطبيق بترقيم حفص: التفاسير والمعاني والعمل (المحتوى)، والعلامات والملاحظات
// والمقادير (بيانات المستخدم، مشتركة بين الروايتين بقرار صاحب المشروع). وما يُعرض في مصحف ورش بترقيمه هو.
// فهذه الدوال تنقل بين الترقيمين، وفي مصحف حفص لا تغيّر شيئًا (الآية هي هي).
//
// في مصحف ورش quran.hafs: لكل آية [أول آية حفص، آخرها] أو [أول، آخر، الأصلية] (scripts/data/13-warsh-map.mjs).
// • أغلب الآيات آية بآية.
// • آية ورش قد تقابل آيتين من حفص أو أكثر: يُعرض محتواهما معًا، وتُحفظ العلامة والملاحظة على «الأصلية»
//   (التي فيها أول كلماتها: الأولى، إلا أول الفاتحة فبسملتها مضمومة إليها).
// • وآية حفص قد تنقسم في ورش آيتين: لكلٍّ منهما محتواها كاملًا، وما عليها من علامة أو ملاحظة يظهر عليهما.
import { isWarsh } from './riwayah.js';

const backs = new WeakMap();
// آيات ورش المقابلة لكل آية من حفص
function backOf(quran) {
  let back = backs.get(quran);
  if (!back) {
    const n = quran.hafs.at(-1)[1] + 1;
    back = Array.from({ length: n }, () => []);
    quran.hafs.forEach(([a, b], w) => {
      for (let h = a; h <= b; h++) back[h].push(w);
    });
    backs.set(quran, back);
  }
  return back;
}

const mapped = (quran) => isWarsh(quran) && Array.isArray(quran.hafs);

// آيات حفص المقابلة لآية المصحف المعروض v (بالترتيب)
export function hafsOf(quran, v) {
  if (!mapped(quran)) return [v];
  const [a, b] = quran.hafs[v];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// آية حفص التي تُحفظ بها علامة آية المصحف المعروض v وملاحظتها
export function hafsKey(quran, v) {
  if (!mapped(quran)) return v;
  const r = quran.hafs[v];
  return r[2] ?? r[0];
}

// آيات المصحف المعروض المقابلة لآية حفص h
export function shownOf(quran, h) {
  if (!mapped(quran)) return [h];
  return backOf(quran)[h] ?? [];
}

// مقدار بترقيم حفص ([أول، آخر] أو بدايته وحدها) ⇐ بترقيم المصحف المعروض: من أول ما يقابل بدايته إلى آخر ما يقابل نهايته
export function shownRange(quran, range) {
  if (!range?.length || !mapped(quran)) return range;
  const out = [shownOf(quran, range[0])[0]];
  if (range.length === 2) out.push(shownOf(quran, range[1]).at(-1));
  return out;
}

// مقدار بترقيم المصحف المعروض ⇐ بترقيم حفص (للحفظ)
export function hafsRange(quran, range) {
  if (!range?.length || !mapped(quran)) return range;
  const out = [hafsOf(quran, range[0])[0]];
  if (range.length === 2) out.push(hafsOf(quran, range[1]).at(-1));
  return out;
}

// الملاحظات بترقيم المصحف المعروض: { آية: ملاحظة } (لرسم علامتها على الآية)
const notesCache = new WeakMap();
export function shownNotes(quran, notes) {
  if (!notes || !mapped(quran)) return notes;
  let byQuran = notesCache.get(notes);
  if (!byQuran) notesCache.set(notes, (byQuran = new WeakMap()));
  let out = byQuran.get(quran);
  if (!out) {
    out = {};
    for (const [h, note] of Object.entries(notes)) {
      if (!note) continue;
      for (const w of shownOf(quran, Number(h))) out[w] ??= note;
    }
    byQuran.set(quran, out);
  }
  return out;
}

// العلامات بترقيم المصحف المعروض: كل آية حفص في علامة ⇐ ما يقابلها، بوقت وضعها (at). وآية ورش التي تقابل
// آيتين معلَّمتين بالعلامة نفسها تُذكر مرة بآخر الوقتين
const marksCache = new WeakMap();
export function shownBookmarks(quran, list) {
  if (!list || !mapped(quran)) return list;
  let byQuran = marksCache.get(list);
  if (!byQuran) marksCache.set(list, (byQuran = new WeakMap()));
  let out = byQuran.get(quran);
  if (!out) {
    out = list.map((b) => {
      const at = new Map();
      for (const x of b.verses) for (const w of shownOf(quran, x.v)) at.set(w, Math.max(at.get(w) ?? 0, x.at));
      return { ...b, verses: [...at].map(([v, t]) => ({ v, at: t })) };
    });
    byQuran.set(quran, out);
  }
  return out;
}

// آيات المصحف المعروض المقابلة لقائمة آيات حفص، بلا تكرار وبالترتيب
export function shownList(quran, list) {
  if (!mapped(quran)) return list;
  return [...new Set(list.flatMap((h) => shownOf(quran, h)))].sort((a, b) => a - b);
}

// آيات حفص المقابلة لقائمة آيات المصحف المعروض، بلا تكرار وبالترتيب
export function hafsList(quran, list) {
  if (!mapped(quran)) return list;
  return [...new Set(list.flatMap((v) => hafsOf(quran, v)))].sort((a, b) => a - b);
}
