// تذكير الختمة اليومي (تطبيق أندرويد، الجلسة ٣ أ، ٢٠٢٦-١١-٢٠): لكل ختمة (الورد والحفظ) تذكيرها المستقل بوقت
// يختاره المستخدم (بالساعة والدقيقة) عند إنشائها أو في «تعديل الخطة»، وملغى افتراضيًّا (بقرار صاحب المشروع).
//
// • أندرويد نفسه يُظهر الإشعار في وقته والتطبيق مغلق وبلا إنترنت (إضافة QuranReminders:
//   android/app/src/main/java/com/quranalsalaf/app/reminders/). وفي الموقع لا يظهر الخيار أصلًا: المتصفح لا
//   يجدول إشعارًا على الجهاز.
// • الصفحة تُرسل إلى أندرويد إشعارات الأيام القادمة (REMINDER_DAYS) بنصوصها، وتعيد إرسالها كلما تغيّرت الختمة
//   (إتمام ورد، تعديل، حذف) وكلما فُتح التطبيق أو رجع إليه المستخدم. فمن أتمّ ما عليه قبل الوقت لا يُرسل
//   إشعار يومه (بقرار صاحب المشروع)، ويعود التذكير من الغد.
// • الوقت تقريبي: سياسة جوجل بلاي لا تتيح التوقيت الدقيق إلا لتطبيقات المنبّه والتقويم، فيصل الإشعار في
//   نحو عشر دقائق من وقته، وإن كان الجوال في سبات عميق ظهر حين يستيقظ.
import { registerPlugin } from '@capacitor/core';
import { toArabicDigits } from '../data/quran.js';
import { addDays, dayKey, wirdState } from './khatma.js';
import { hifzState } from './hifz.js';
import { isNative } from './native.js';

const n = toArabicDigits;

// عدد الأيام المجدولة مسبقًا. ومن لم يفتح التطبيق بعدها تقف التذكيرات حتى يفتحه
export const REMINDER_DAYS = 30;
// الوقت المقترح حين يفعّل المستخدم التذكير، ويغيّره بمنتقي الوقت
export const DEFAULT_REMINDER = '20:00';

// «HH:MM» صحيح؟
export const isTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// «٨:٠٠ م» · «٥:٣٠ ص» · «١٢:١٥ م»
export function timeText(t) {
  if (!isTime(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 || 12;
  return `${n(h12)}:${n(String(m).padStart(2, '0'))} ${h < 12 ? 'ص' : 'م'}`;
}

// «أ» · «أ وب» · «أ، وب، وج»
const joinAnd = (list) => (list.length <= 2 ? list.join(' و') : `${list.slice(0, -1).join('، و')}، و${list.at(-1)}`);

// ---------- نص الإشعار ----------
// ختمة الورد: «الورد ١٢ من ٣٠، من الصفحة ٢٢١ إلى ٢٤٠»
export function wirdText(k, today = dayKey()) {
  const s = wirdState(k, today);
  if (!s.current) return null;
  const [a, b] = s.current;
  const pages = a === b ? `الصفحة ${n(a)}` : `من الصفحة ${n(a)} إلى ${n(b)}`;
  return { title: 'حان وقت وردك', body: `الورد ${n(s.index)} من ${n(s.total)}، ${pages}` };
}

// خطوات ختمة الحفظ في يوم: ما عليه منها، وما بقي (لم يُتمّ)، وsteps بترتيبها مع إتمام كلٍّ (لويدجت الختمة).
// quran: مصحف حفص (الخطة بترقيمه)
export function hifzSteps(quran, k, today = dayKey()) {
  const s = hifzState(quran, k, today);
  if (!s.current) return { all: [], left: [], steps: [] };
  const steps = [];
  if (s.far) steps.push({ name: 'المراجعة البعيدة', done: s.farDone });
  if (k.near > 0 && s.near.length) steps.push({ name: 'المراجعة القريبة', done: s.nearDone });
  steps.push({ name: 'حفظ الورد', done: s.doneToday });
  return { all: steps.map((x) => x.name), left: steps.filter((x) => !x.done).map((x) => x.name), steps };
}

// ختمة الحفظ: «بقي عليك اليوم: المراجعة القريبة وحفظ الورد» (وفي يوم لم يُبدأ: «عليك اليوم: …»)
export function hifzText(quran, k, today = dayKey()) {
  const { all, left } = hifzSteps(quran, k, today);
  if (!left.length) return null;
  const lead = left.length < all.length ? 'بقي عليك اليوم' : 'عليك اليوم';
  return { title: 'حان وقت الحفظ', body: `${lead}: ${joinAnd(left)}` };
}

// ---------- الجدول ----------
// الدقائق من أول اليوم لوقت «HH:MM»
const minutesOf = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/*
  إشعارات ختمة في الأيام القادمة: [{ day: 'YYYY-MM-DD', time: 'HH:MM', title, body }]
  • لا شيء إن لم يكن لها تذكير، أو خُتمت.
  • اليوم داخلٌ إن لم يمضِ وقته ولم يُتمّ ما عليه فيه (وفي الحفظ: نصه بما بقي من خطواته)؛ وإلا فمن الغد.
  • ما بعد اليوم بنصّ يومٍ لم يُعمل فيه شيء: الورد الحالي نفسه (يتبع الإنجاز لا التاريخ)، وخطوات الحفظ كلها.
  now: الوقت الحالي (Date). quran: مصحف حفص، ولا يلزم لختمة الورد
*/
export function reminderItems(type, k, quran, now = new Date(), days = REMINDER_DAYS) {
  if (!k || k.finished || !isTime(k.reminder)) return [];
  if (type === 'hifz' && !quran) return [];
  const today = dayKey(now);
  const textOf = (day) => (type === 'wird' ? wirdText(k, day) : hifzText(quran, k, day));
  // نص يوم بلا عمل فيه: حالة الختمة في يوم بعد آخر إتمام
  const fresh = textOf(addDays(today, 1));
  if (!fresh) return [];
  const passed = now.getHours() * 60 + now.getMinutes() >= minutesOf(k.reminder);
  const todayText = passed || doneToday(type, k, quran, now) ? null : textOf(today);
  const out = [];
  if (todayText) out.push({ day: today, time: k.reminder, ...todayText });
  for (let i = 1; out.length < days; i++) out.push({ day: addDays(today, i), time: k.reminder, ...fresh });
  return out;
}

// هل أتمّ ما عليه اليوم؟ (فيُزال إشعار يومه إن كان ظاهرًا)
export function doneToday(type, k, quran, now = new Date()) {
  if (!k || k.finished) return true;
  const today = dayKey(now);
  if (type === 'wird') return k.lastDone === today;
  return !!quran && hifzSteps(quran, k, today).left.length === 0;
}

// ---------- الصلة بأندرويد ----------
/*
  إضافة QuranReminders (android/app/src/main/java/com/quranalsalaf/app/reminders/QuranRemindersPlugin.java):
    set({ type, items, dismiss }) يستبدل إشعارات النوع كلها بـitems (وفارغةً يلغيها)، وdismiss يزيل إشعاره الظاهر
    checkPermission() / requestPermission() ← { granted } · openSettings(): إعدادات إشعارات التطبيق في الجهاز
    والحدث «open» { type } عند الضغط على الإشعار (ولو فُتح التطبيق به من الإغلاق)
*/
let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranReminders'));

// هل التذكير متاح؟ (داخل التطبيق وحده)
export const remindersAvailable = () => isNative();

export async function notificationsAllowed() {
  try {
    return !!(await P().checkPermission()).granted;
  } catch {
    return false;
  }
}

// يطلب إذن الإشعارات (أندرويد ١٣ فأحدث يسأل المستخدم). النتيجة: true إن صار مسموحًا
export async function askNotifications() {
  try {
    return !!(await P().requestPermission()).granted;
  } catch {
    return false;
  }
}

export const openNotificationSettings = () => Promise.resolve(P().openSettings()).catch(() => {});

// آخر ما أُرسل لكل نوع في هذه الجلسة، فلا يُعاد إرسال الجدول نفسه
const sent = {};
export function syncReminders({ wird, hifz, hafs, now = new Date() }) {
  if (!remindersAvailable()) return;
  for (const [type, k] of [
    ['wird', wird],
    ['hifz', hifz],
  ]) {
    if (type === 'hifz' && k && !k.finished && isTime(k.reminder) && !hafs) continue; // ينتظر مصحف حفص
    const items = reminderItems(type, k, hafs, now);
    const dismiss = !!k && isTime(k.reminder) ? doneToday(type, k, hafs, now) : true;
    const key = JSON.stringify([items, dismiss]);
    if (sent[type] === key) continue;
    sent[type] = key;
    Promise.resolve(P().set({ type, items, dismiss })).catch(() => {
      delete sent[type];
    });
  }
}
// للاختبارات: يُنسي ما أُرسل
export const resetSent = () => Object.keys(sent).forEach((k) => delete sent[k]);

// الضغط على الإشعار: handler(type)
export function listenReminderOpen(handler) {
  if (!remindersAvailable()) return () => {};
  let remove = () => {};
  let cancelled = false;
  Promise.resolve(P().addListener('open', (e) => handler(e?.type)))
    .then((h) => {
      if (cancelled) h?.remove?.();
      else remove = () => h?.remove?.();
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    remove();
  };
}
