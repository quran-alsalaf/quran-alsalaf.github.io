// التطبيق الأصلي (أندرويد، Capacitor، ٢٠٢٦-١١-١٨): الكود نفسه يعمل في الموقع وداخل التطبيق، وهنا وحده ما
// يختلف بينهما. في الموقع لا يُحمَّل شيء من إضافات Capacitor (تُستورد عند الحاجة داخل التطبيق فقط).
import { Capacitor } from '@capacitor/core';

// هل الصفحة تعمل داخل التطبيق الأصلي؟
export const isNative = () => Capacitor.isNativePlatform();

// عنوان الموقع المنشور: يُحمَّل منه داخل التطبيق ما لا يُحزم معه (التفاسير الكبيرة، scripts/native-web.mjs)
export const SITE_URL = 'https://quran-alsalaf.github.io/';

// ---------- زرّ الرجوع في أندرويد ----------
/*
  ترتيب ما يفعله الضغط على زرّ الرجوع:
    ١. إن كانت طبقة مفتوحة (نافذة، قائمة، بطاقة، صفحة — src/lib/layers.js) أُغلق آخرها فتحًا، كمفتاح Esc
    ٢. وإلا فإن كان وضع يُخرج منه بالرجوع (وضع القراءة) خرج منه
    ٣. وإلا فإن كانت الأزرار العائمة ظاهرة أُخفيت
    ٤. وإلا رسالة «اضغط مرة أخرى للخروج»، والضغط ثانيةً خلال ثانيتين يخرج من التطبيق
  closeLayer() / leaveMode() / hideChrome(): كلٌّ يُرجع true إن فعل شيئًا
*/
export const EXIT_WINDOW_MS = 2000;
export function createBackHandler({ closeLayer, leaveMode, hideChrome, hint, exit, now = Date.now }) {
  let last = -Infinity;
  return () => {
    if (closeLayer()) return 'layer';
    if (leaveMode()) return 'mode';
    if (hideChrome()) return 'chrome';
    const t = now();
    if (t - last < EXIT_WINDOW_MS) {
      last = -Infinity;
      exit();
      return 'exit';
    }
    last = t;
    hint();
    return 'hint';
  };
}

// أوضاع يُخرج منها زرّ الرجوع وليست طبقات (وضع القراءة): كومة، آخرها هو المعتمد
const modes = [];
export function pushBackMode(fn) {
  modes.push(fn);
  return () => {
    const i = modes.lastIndexOf(fn);
    if (i >= 0) modes.splice(i, 1);
  };
}
export function leaveBackMode() {
  if (!modes.length) return false;
  modes[modes.length - 1]();
  return true;
}

// يربط زرّ الرجوع في أندرويد بالمعالج (createBackHandler) — داخل التطبيق وحده. يُرجع دالة الفك
export function listenBackButton(handler) {
  if (!isNative()) return () => {};
  let remove = () => {};
  let cancelled = false;
  import('@capacitor/app').then(({ App }) => {
    if (cancelled) return;
    App.addListener('backButton', handler).then((h) => {
      if (cancelled) h.remove();
      else remove = () => h.remove();
    });
  });
  return () => {
    cancelled = true;
    remove();
  };
}

export async function exitApp() {
  const { App } = await import('@capacitor/app');
  await App.exitApp();
}

// ---------- المشاركة ----------
// مشاركة نص بقائمة مشاركة الجهاز. النتيجة: 'shared' أو 'cancelled'
export async function shareText(text) {
  const { Share } = await import('@capacitor/share');
  try {
    await Share.share({ text });
    return 'shared';
  } catch (err) {
    if (isCancel(err)) return 'cancelled';
    throw err;
  }
}

// مشاركة ملف نصي باسم name: يُكتب في ذاكرة التطبيق المؤقتة ثم يُشارك (واتساب، الملفات، درايف…)
export async function shareFile(text, name) {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ files: [uri], title: name });
    return 'shared';
  } catch (err) {
    if (isCancel(err)) return 'cancelled';
    throw err;
  }
}

// إغلاق قائمة المشاركة بلا اختيار يرفضه Capacitor برسالة «Share canceled»
export const isCancel = (err) => /cancel/i.test(err?.message ?? '') || err?.name === 'AbortError';

// ---------- أشرطة النظام ----------
// لون أيقونات شريط الحالة وشريط التنقل بحسب خلفية القراءة: داكنة على الفاتحة، وفاتحة على الداكنة.
// (والتطبيق يمتد تحت الشريطين، فخلفيتهما خلفيته نفسها)
export function followSystemBars() {
  if (!isNative()) return () => {};
  const el = document.documentElement;
  const apply = () => {
    import('@capacitor/core').then(({ SystemBars, SystemBarsStyle }) => {
      const dark = el.dataset.theme === 'dark';
      SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    });
  };
  apply();
  const obs = new MutationObserver(apply);
  obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}
