// الرواية (٢٠٢٦-١١-١٥، «الروايات» الجلسة ١): حفص عن عاصم أو ورش عن نافع. باختيارها يتبدّل المصحف كله
// (بقرار صاحب المشروع)، على الصفحة نفسها: صفحات المصحفين الـ٦٠٤ تبدأ بالسور والأجزاء نفسها.
//
// • تُختار عند أول فتح للتطبيق (RiwayahChooser)، ثم من الإعدادات. وما لم تُختر فـ readRiwayah() ترجع null.
//   (وحين تُضاف اللغة الإنجليزية والشاشة الترحيبية، تأتي شاشة اللغة قبل شاشة الرواية.)
// • مصحف ورش يُبنى بـ scripts/data/12-warsh.mjs بالبنية نفسها لمصحف حفص، فيعرضه التطبيق بالمكوّنات نفسها،
//   ويُعرف بـ quran.riwayah === 'warsh'.
// • ترقيم آيات ورش (٦٢١٤ آية بعدّ المدني) غير ترقيم حفص (٦٢٣٦) الذي رُبط به المحتوى وبيانات المستخدم. فيُنقل بينهما
//   في src/lib/verseMap.js («الروايات» الجلسة ٢): تعمل في ورش التفاسير والمعاني والعمل والعلامات والملاحظات
//   والمقادير ومقررات الأسابيع، وبيانات المستخدم واحدة في الروايتين. ويبقى موقوفًا فيه (ويظهر WARSH_SOON):
//   الاستماع حتى قرّاء ورش (الجلسة ٣)، والأرباع (مطبوع ورش مقسوم أثمانًا، ولا مصدر موثوق بعدُ لمواضعها).
import { useEffect, useState } from 'react';

const KEY = 'hq.riwayah';
const EVENT = 'hq-riwayah';

export const RIWAYAT = [
  { id: 'hafs', name: 'حفص', full: 'حفص عن عاصم', note: 'رواية أكثر المسلمين اليوم' },
  { id: 'warsh', name: 'ورش', full: 'ورش عن نافع', note: 'رواية أهل المغرب وغرب إفريقيا' },
];

export const WARSH_SOON = 'تُتاح برواية ورش قريبًا';

export const isWarsh = (quran) => quran?.riwayah === 'warsh';

// 'hafs' | 'warsh'، أو null إن لم يختر المستخدم بعد
export function readRiwayah() {
  try {
    const r = localStorage.getItem(KEY);
    return RIWAYAT.some((x) => x.id === r) ? r : null;
  } catch {
    return null;
  }
}

export function setRiwayah(r) {
  try {
    localStorage.setItem(KEY, r);
  } catch {
    // بلا تخزين: تبقى في هذه الجلسة
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: r }));
}

// الرواية المختارة، وتتبع تغييرها من أي مكان (الإعدادات أو شاشة الاختيار)
export function useRiwayah() {
  const [r, setR] = useState(readRiwayah);
  useEffect(() => {
    const on = (e) => setR(e.detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return r;
}
