// تنبيه التحديث (تطبيق أندرويد، ٢٠٢٦-١١-٢٣، بقرار صاحب المشروع قبل النشر): إذا نُشرت في جوجل بلاي نسخة أحدث
// وصارت متاحة لهذا الجهاز، تظهر نافذة جوجل «يتوفر تحديث» بالنوع المرن (يتنزّل في الخلفية والمستخدم يكمل)، فإذا
// اكتمل التنزيل ظهر شريط «التحديث جاهز» بزرّ «تحديث الآن» يعيد التشغيل على النسخة الجديدة.
//
// • لا شيء إذا لم توجد نسخة أحدث: جوجل لا تخبر بالتحديث إلا بعد نشره فعلًا (لا أثناء المراجعة ولا لمن ليس في
//   مسار نشره)، ولا يعمل إلا في تطبيق مثبّت من المتجر.
// • الرفض: لا تُعاد النافذة للنسخة نفسها إلا بعد DECLINE_DAYS أيام؛ ونسخة أحدث منها تُعرض فورًا.
// • الشريط: يُغلق بـ✕ حتى الفتح التالي، ويظهر أيضًا إذا فُتح التطبيق والتحديث منزَّل لم يُثبَّت.
// • الموقع لا يحتاجه (يتحدّث وحده)، والآيفون بلا أداة رسمية مثلها فيُضاف له تنبيه مشابه عند بناء نسخته.
//
// إضافة QuranUpdate (android/app/src/main/java/com/quranalsalaf/app/update/QuranUpdatePlugin.java):
//   check() ← { available, versionCode, downloaded } · start() ← { accepted } · complete()
//   والحدث state ← { status: 'downloading' | 'downloaded' | 'installed' | 'failed' | 'canceled' }
import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { hasOpenLayer } from './layers.js';
import { isNative } from './native.js';

let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranUpdate'));

export const UPDATE_KEY = 'hq.update';
export const DECLINE_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;
// مهلة بعد استقرار المصحف قبل السؤال، وإعادة المحاولة ما دامت طبقة مفتوحة أو تلاوة جارية
export const CHECK_DELAY_MS = 4000;

// hq.update: { declined: رقم النسخة التي رُفضت (versionCode)، at: وقت الرفض (ms) }
export function readUpdate() {
  try {
    const r = JSON.parse(localStorage.getItem(UPDATE_KEY) ?? 'null');
    return r && typeof r === 'object' ? r : {};
  } catch {
    return {};
  }
}
function writeUpdate(r) {
  try {
    localStorage.setItem(UPDATE_KEY, JSON.stringify(r));
  } catch {
    // بلا تخزين
  }
}

// أتُعرض نافذة التحديث؟ info من check()، وrec من hq.update
export function updateDue(info, rec, now = Date.now()) {
  if (!info?.available || info.downloaded) return false;
  if (rec?.declined == null || rec.declined !== info.versionCode) return true;
  return now - (rec.at ?? 0) >= DECLINE_DAYS * DAY;
}

export const markDeclined = (versionCode, now = Date.now()) => writeUpdate({ declined: versionCode ?? null, at: now });

export async function checkUpdate() {
  try {
    return await P().check();
  } catch {
    return { available: false, downloaded: false };
  }
}

// نافذة جوجل؛ يرجع true إن قبل المستخدم (فيبدأ التنزيل في الخلفية)
export async function startUpdate(info) {
  try {
    const { accepted } = await P().start();
    if (!accepted) markDeclined(info?.versionCode);
    return !!accepted;
  } catch {
    return false;
  }
}

export async function completeUpdate() {
  try {
    await P().complete();
  } catch {
    // تعذّر: يبقى المنزَّل ويُثبَّت عند إغلاق التطبيق
  }
}

/*
  ready: التطبيق مستقر على المصحف (انتهت شاشة الإقلاع واختيرت الرواية)
  busy: تلاوة جارية أو وضع القراءة أو التسميع — لا تُعرض النافذة فوقها، وتُنتظر حتى تنتهي
  يرجع { ready: التحديث منزَّل وجاهز (يظهر الشريط)، install، dismiss }
*/
export function useAppUpdate({ ready, busy }) {
  const available = isNative();
  const [downloaded, setDownloaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const state = useRef({ ready, busy, asked: false });
  state.current.ready = ready;
  state.current.busy = busy;

  // حالة التنزيل من أندرويد، وعند الرجوع إلى التطبيق: هل نُزّل تحديث لم يُثبَّت
  useEffect(() => {
    if (!available) return undefined;
    const subs = [];
    let gone = false;
    const keep = (p) => p.then((s) => (gone ? s?.remove?.() : subs.push(s))).catch(() => {});
    keep(P().addListener('state', ({ status }) => setDownloaded(status === 'downloaded')));
    keep(
      import('@capacitor/app').then(({ App }) =>
        App.addListener('resume', () => checkUpdate().then((i) => i.downloaded && setDownloaded(true)))
      )
    );
    return () => {
      gone = true;
      subs.forEach((s) => s?.remove?.());
    };
  }, [available]);

  // مرة في كل فتح: بعد استقرار المصحف، بلا طبقة مفتوحة ولا تلاوة
  useEffect(() => {
    if (!available || !ready || busy || state.current.asked) return undefined;
    const id = setInterval(async () => {
      const s = state.current;
      if (s.asked || !s.ready || s.busy || hasOpenLayer()) return;
      s.asked = true;
      clearInterval(id);
      const info = await checkUpdate();
      if (info.downloaded) setDownloaded(true);
      else if (updateDue(info, readUpdate())) startUpdate(info);
    }, CHECK_DELAY_MS);
    return () => clearInterval(id);
  }, [available, ready, busy]);

  return {
    ready: available && downloaded && !hidden,
    install: () => {
      setHidden(true);
      completeUpdate();
    },
    dismiss: () => setHidden(true),
  };
}
