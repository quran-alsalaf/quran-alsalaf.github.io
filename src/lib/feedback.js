// «رأيك يهمنا» (تطبيق أندرويد، الجلسة ٣ ب، ٢٠٢٦-١١-٢٠): الأسطر الأربعة أسفل الإعدادات — عن التطبيق، والمساعدة
// والتواصل (كان «للشكاوى والاقتراحات» ثم صار ٢٠٢٦-١١-٢٤، وقبله «تواصل معنا»)، وقيّم التطبيق، وشارك التطبيق — ونافذة التقييم التلقائية.
//
// • التقييم: نافذة تقييم جوجل بلاي داخل التطبيق تظهر من نفسها مرة واحدة (useRatePrompt أدناه). وسطر «قيّم التطبيق»
//   يفتح صفحة التطبيق في المتجر: جوجل تحدّد عدد مرات ظهور نافذتها ولا تخبر هل ظهرت، فلا تصلح لزرّ يضغطه المستخدم
//   متى شاء. والسطر والنافذة في التطبيق وحده (لا متجر في الموقع).
// • المشاركة: نصّ قصير ورابط — رابط المتجر داخل التطبيق، ورابط الموقع في الموقع.
// • التواصل: واتساب، برسالة جاهزة في آخرها نسخة التطبيق والجهاز والرواية.
//
// إضافة QuranFeedback (android/app/src/main/java/com/quranalsalaf/app/feedback/QuranFeedbackPlugin.java):
//   requestReview() ← نافذة التقييم · openStore() ← صفحة التطبيق في المتجر · openUrl({ url }) ← رابط خارجي
//   (واتساب) · deviceInfo() ← { version, manufacturer, model, android }
import { useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import { TASK_DONE } from './khatma.js';
import { hasOpenLayer } from './layers.js';
import { SITE_URL, isNative } from './native.js';

let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranFeedback'));

export const APP_ID = 'com.quranalsalaf.app';
export const STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

// ---------- المشاركة ----------
export const SHARE_TEXT = 'قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.';
export const shareLink = (native = isNative()) => (native ? STORE_URL : SITE_URL);
export const shareMessage = (native = isNative()) => `${SHARE_TEXT}\n${shareLink(native)}`;

// ---------- التواصل ----------
export const WHATSAPP = '966548470724'; // بالصيغة الدولية لرابط واتساب
export const WHATSAPP_SHOWN = '0548470724'; // كما يظهر للمستخدم
export const CONTACT_NOTE =
  'هذا التطبيق تم إنشاؤه بمساعدة الذكاء الاصطناعي، فإذا وجدت أي أخطاء أو كانت لديك اقتراحات فتواصل معنا من فضلك.';

// سطر المعلومات في آخر الرسالة: «قرآن السلف ١.٠ (أندرويد ١٤ · Samsung SM-S918B) · رواية حفص»
export function contactInfo({ native, version, manufacturer, model, android, riwayah }) {
  const where = native
    ? ['أندرويد' + (android ? ` ${android}` : ''), [manufacturer, model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    : 'الموقع';
  const app = native && version ? `قرآن السلف ${version}` : 'قرآن السلف';
  return `${app} (${where}) · رواية ${riwayah === 'warsh' ? 'ورش' : 'حفص'}`;
}

// نص الرسالة الجاهزة: السلام، وسطران فارغان يكتب فيهما، ثم سطر المعلومات
export const contactMessage = (info) => `السلام عليكم،\n\n\n—\n${contactInfo(info)}`;

export const whatsappUrl = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

// معلومات الجهاز داخل التطبيق (بلا شيء في الموقع)
export async function deviceInfo() {
  if (!isNative()) return { native: false };
  try {
    return { native: true, ...(await P().deviceInfo()) };
  } catch {
    return { native: true };
  }
}

// يفتح رابطًا خارج التطبيق: داخل التطبيق بأندرويد نفسه (واتساب أو المتصفح)، وفي الموقع بنافذة جديدة
export async function openExternal(url) {
  if (isNative()) {
    try {
      await P().openUrl({ url });
      return;
    } catch {
      // تعذّر: يُجرَّب فتحه من الصفحة
    }
  }
  window.open(url, '_blank', 'noopener');
}

// ---------- التقييم ----------
export const ratingAvailable = () => isNative();

export async function openStore() {
  try {
    await P().openStore();
  } catch {
    window.open(STORE_URL, '_blank', 'noopener');
  }
}

/*
  نافذة التقييم التلقائية: مرة واحدة، في أول لحظة تتحقّق من اثنتين:
    ١. إتمام مهمة ختمة (الحدث TASK_DONE من khatma.js، يُطلق في إتمام الورد والحفظ والمراجعة)
    ٢. فتح التطبيق بعد RATE_AFTER_DAYS من أول استعمال
  ولا تظهر في أول فتح، ولا أثناء التلاوة أو وضع القراءة أو التسميع؛ وفي الثانية لا وطبقة مفتوحة فوق المصحف.
  hq.rate: { first: وقت أول استعمال (ms)، asked: true بعد ظهورها }
*/
export const RATE_KEY = 'hq.rate';
export const RATE_AFTER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
// مهلة بعد استقرار المصحف (أو بعد إتمام المهمة: تُرى رسالة الإتمام أولًا)
export const RATE_DELAY_MS = 3000;
export const TASK_DELAY_MS = 1500;

export function readRate() {
  try {
    const r = JSON.parse(localStorage.getItem(RATE_KEY) ?? 'null');
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}
function writeRate(r) {
  try {
    localStorage.setItem(RATE_KEY, JSON.stringify(r));
  } catch {
    // بلا تخزين
  }
}

// يسجّل أول استعمال إن لم يُسجَّل (والمستخدم الحالي يُحسب من أول فتح بعد هذه النسخة)
export function noteFirstUse(now = Date.now()) {
  const r = readRate();
  if (!r.first) writeRate({ ...r, first: now });
}

// أحان وقتها؟ task: أتمّ مهمة ختمة الآن
export function rateDue(r, { now = Date.now(), task = false } = {}) {
  if (r.asked) return false;
  if (task) return true;
  return !!r.first && now - r.first >= RATE_AFTER_DAYS * DAY;
}

export const markAsked = () => writeRate({ ...readRate(), asked: true });

// يطلب نافذة جوجل ويسجّل أنها طُلبت (جوجل لا تخبر هل ظهرت فعلًا، ولا تُطلب مرة ثانية من نفسها)
export async function requestReview() {
  markAsked();
  try {
    await P().requestReview();
  } catch {
    // بلا متجر (نسخة التجربة) أو تعذّر: لا شيء
  }
}

/*
  ready: التطبيق مستقر على المصحف (انتهت شاشة الإقلاع واختيرت الرواية)
  busy: تلاوة جارية أو وضع القراءة أو التسميع
  عند فتح التطبيق بعد ٧ أيام: تُنتظر مهلة ثم يُطلب إن بقي مستقرًّا بلا طبقة مفتوحة، وإلا أعيدت المحاولة
  حين يستقر. وعند إتمام مهمة: بعد مهلة قصيرة، ولو كانت القائمة مفتوحة (فيها بطاقة الختمة).
*/
export function useRatePrompt({ ready, busy }) {
  const state = useRef({ ready, busy, task: false });
  state.current.ready = ready;
  state.current.busy = busy;
  const available = ratingAvailable();

  useEffect(() => {
    if (available) noteFirstUse();
  }, [available]);

  useEffect(() => {
    if (!available) return undefined;
    let timer = null;
    const tryNow = (task) => {
      const s = state.current;
      if (!s.ready || s.busy || !rateDue(readRate(), { task })) return false;
      if (!task && hasOpenLayer()) return false;
      requestReview();
      return true;
    };
    const onTask = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!tryNow(true)) state.current.task = true; // مشغول الآن: تُطلب حين يستقر
      }, TASK_DELAY_MS);
    };
    window.addEventListener(TASK_DONE, onTask);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(TASK_DONE, onTask);
    };
  }, [available]);

  useEffect(() => {
    if (!available || !ready || busy) return undefined;
    // كل مهلة يُعاد الفحص ما دام مستقرًّا (لعل طبقة أُغلقت)، حتى تُطلب مرة واحدة
    const id = setInterval(() => {
      const s = state.current;
      if (!rateDue(readRate(), { task: s.task })) {
        if (readRate().asked) clearInterval(id);
        return;
      }
      if (!s.task && hasOpenLayer()) return;
      clearInterval(id);
      requestReview();
    }, RATE_DELAY_MS);
    return () => clearInterval(id);
  }, [available, ready, busy]);
}
