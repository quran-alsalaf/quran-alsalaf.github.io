// ويدجت «ختمتي اليوم» (تطبيق أندرويد، الجلسة ٣ ج ١، ٢٠٢٦-١١-٢١): على الشاشة الرئيسية للجوال، للعرض فقط
// (لا يُسجَّل منه شيء، بقرار صاحب المشروع)، والضغط عليه يفتح صفحة الورد أو تبويب الختمة كالضغط على الإشعار.
//
// • ويدجت واحد للختمتين: الورد بسطره («الورد ١٢ من ٣٠ · من ص ٢٢١ إلى ٢٤٠») وشريط ما أُنجز من الختمة،
//   والحفظ بخطوات يومه الثلاث وعلامة ✓ عند ما أُتمّ منها؛ وبلا ختمة: «ابدأ ختمة».
// • أندرويد نفسه يرسم الويدجت والتطبيق مغلق (android/app/src/main/java/com/quranalsalaf/app/widgets/). والصفحة
//   ترسل إليه حال الأيام القادمة (WIDGET_DAYS) بنصوصها كتذكير الختمة (src/lib/reminders.js)، فيتبدّل وحده عند
//   منتصف الليل؛ وتعيد إرسالها كلما تغيّرت الختمة أو المظهر وكلما رجع المستخدم إلى التطبيق. ومن لم يفتحه بعدها
//   يظهر له «افتح التطبيق لتحديث ختمتك».
// • ألوانه ألوان التطبيق: خلفية القراءة ولون نص المصحف ولون التطبيق.
// • وفي الموقع لا شيء: المتصفح لا يضع ويدجت على الشاشة الرئيسية.
import { registerPlugin } from '@capacitor/core';
import { toArabicDigits } from '../data/quran.js';
import { addDays, dayKey, splitWirds, wirdState } from './khatma.js';
import { LAST_PAGE } from './position.js';
import { hifzSteps } from './reminders.js';
import { isNative } from './native.js';

const n = toArabicDigits;

// عدد الأيام المرسلة مسبقًا (كالتذكيرات)
export const WIDGET_DAYS = 30;

// «من ص ٢٢١ إلى ٢٤٠» · «ص ٥»
const pagesLine = ([a, b]) => (a === b ? `ص ${n(a)}` : `من ص ${n(a)} إلى ${n(b)}`);

/*
  ختمة الورد في يوم: { line, percent, done } أو { finished: true, line }
  • اليوم وقد أتمّ ورده: سطر الورد الذي أتمّه وعلامته (والغد بالورد التالي)
  • ما لم يُتمّ: الورد الحالي (يتبع الإنجاز لا التاريخ)
*/
export function wirdDay(k, day) {
  if (k.finished) return { finished: true, line: 'أتممت الختمة، تقبل الله منك' };
  const s = wirdState(k, day);
  if (s.doneToday && k.done > 0) {
    const wirds = splitWirds(k.from, LAST_PAGE, k.mode, k.value);
    const prev = wirds[k.done - 1];
    return { line: `الورد ${n(s.index - 1)} من ${n(s.total)} · ${pagesLine(prev)}`, percent: s.percent, done: true };
  }
  if (!s.current) return { finished: true, line: 'أتممت الختمة، تقبل الله منك' };
  return { line: `الورد ${n(s.index)} من ${n(s.total)} · ${pagesLine(s.current)}`, percent: s.percent, done: false };
}

// ختمة الحفظ في يوم: { steps: [{ name, done }], done } أو { finished: true, line }. quran: مصحف حفص
export function hifzDay(quran, k, day) {
  if (k.finished) return { finished: true, line: 'أتممت ختمة الحفظ، تقبل الله منك' };
  const { steps } = hifzSteps(quran, k, day);
  if (!steps.length) return { finished: true, line: 'أتممت ختمة الحفظ، تقبل الله منك' };
  return { steps, done: steps.every((x) => x.done) };
}

/*
  أيام الويدجت: [{ day: 'YYYY-MM-DD', wird, hifz }] من اليوم، WIDGET_DAYS يومًا
  • اليوم بحاله الآن (ما أُتمّ منه)، وما بعده بحال يوم لم يُعمل فيه شيء بعد آخر إتمام.
  • لا شيء إن لم تكن ختمة (فيظهر «ابدأ ختمة»).
  quran: مصحف حفص، ولا يلزم إلا لختمة الحفظ
*/
export function widgetDays({ wird, hifz, quran, now = new Date(), days = WIDGET_DAYS }) {
  if (!wird && !hifz) return [];
  const today = dayKey(now);
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    out.push({
      day,
      wird: wird ? wirdDay(wird, day) : null,
      hifz: hifz && quran ? hifzDay(quran, hifz, day) : null,
    });
  }
  return out;
}

// ألوان التطبيق الحالية (index.html يضعها على الصفحة): الخلفية، ونص المصحف، ولون التطبيق، ولونه للنصوص
export function widgetTheme(root = document.documentElement) {
  const css = getComputedStyle(root);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--bg', '#F5EDDC'),
    ink: v('--ink', '#2E2A24'),
    accent: v('--accent', '#8A6110'),
    accentText: v('--accent-text', v('--accent', '#8A6110')),
    dark: root.dataset.theme === 'dark',
  };
}

// ---------- الصلة بأندرويد ----------
/*
  إضافة QuranWidgets (android/app/src/main/java/com/quranalsalaf/app/widgets/QuranWidgetsPlugin.java):
    setKhatma({ data: { theme, days } }) يحفظ حال الأيام ويعيد رسم كل ويدجت «ختمتي اليوم» على الشاشة.
    والضغط على الويدجت يفتح التطبيق بحدث «open» في QuranReminders (src/lib/reminders.js) بنوع: wird · hifz · khatma
*/
let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranWidgets'));

export const widgetsAvailable = () => isNative();

// آخر ما أُرسل في هذه الجلسة، فلا يُعاد إرسال الحال نفسها
let sent = null;
export function syncWidgets({ wird, hifz, hafs, now = new Date(), theme }) {
  if (!widgetsAvailable()) return;
  if (hifz && !hifz.finished && !hafs) return; // ينتظر مصحف حفص
  const data = { theme: theme ?? widgetTheme(), days: widgetDays({ wird, hifz, quran: hafs, now }) };
  const key = JSON.stringify(data);
  if (sent === key) return;
  sent = key;
  Promise.resolve(P().setKhatma({ data })).catch(() => {
    sent = null;
  });
}
// للاختبارات: يُنسي ما أُرسل
export const resetWidgetsSent = () => {
  sent = null;
};
