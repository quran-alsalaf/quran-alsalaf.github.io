// حفظ الصوت على الجهاز داخل تطبيق أندرويد (الجلسة ٢ ب من التطبيق الأصلي، ٢٠٢٦-١١-٢٠).
// مشغّل التلاوة الأصلي (src/lib/nativeAudio.js) لا يقرأ ذاكرة المتصفح (Cache Storage)، فداخل التطبيق يُحفظ الصوت
// في ملفات الجهاز نفسها (ذاكرة التطبيق الداخلية) بإضافة QuranDownloads
// (android/app/src/main/java/com/quranalsalaf/app/audio/QuranDownloadsPlugin.java)، ويقرؤه المشغّل منها بلا إنترنت:
//   • تحميل قارئ لكامل القرآن يقوم به أندرويد نفسه (بقرار صاحب المشروع): يستمر والشاشة مقفلة وبعد إغلاق
//     التطبيق، بإشعار فيه تقدّمه وزرّ «إيقاف». قارئ واحد في كل مرة، وما يُطلب بعده «بالانتظار» يبدأ وحده بعده.
//     وانقطاع الاتصال يوقفه ويكمل وحده إذا رجع (waiting).
//   • «تنزيل» المقدار يُحفظ حفظًا دائمًا في مجلد القارئ نفسه (بقرار صاحب المشروع)، فلا يُعاد تحميله.
//   • ما حُمِّل في الموقع أو في نسخ التجربة السابقة (ذاكرة المتصفح) لا يراه المشغّل، فيُحمَّل من جديد.
// والموقع كما كان (src/lib/downloader.js).
import { useSyncExternalStore } from 'react';
import { registerPlugin } from '@capacitor/core';

let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranDownloads'));

const EMPTY = { items: {}, active: null, queue: [] };

/*
  تحميل القرّاء لكامل القرآن بالواجهة نفسها لمحرّك الموقع (createDownloader في src/lib/downloader.js):
  getState · subscribe · useDownloads · start · pause · verify · hasFiles · isComplete
  والحالة: { items: { [id]: { status: 'downloading' | 'queued' | 'paused' | 'done', count, total, waiting? } }, active, queue }
  urlsOf(id): روابط ملفات القارئ · nameOf(id): اسمه في الإشعار · messages[result](id): نص الرسالة · notify(text)
*/
export function createNativeDownloads({ urlsOf, nameOf, messages, notify }) {
  let state = EMPTY;
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const apply = (s) => {
    if (!s) return;
    state = { items: s.items || {}, active: s.active ?? null, queue: s.queue || [] };
    emit();
  };
  const refresh = () =>
    Promise.resolve(P().getState())
      .then(apply)
      .catch(() => {});

  let connected = false;
  function connect() {
    if (connected) return;
    connected = true;
    const p = P();
    Promise.resolve(p.addListener('state', apply)).catch(() => {});
    Promise.resolve(
      p.addListener('notice', ({ id, result }) => {
        const m = messages[result];
        if (m) notify(m(id));
      })
    ).catch(() => {});
    refresh();
    // الرجوع إلى التطبيق بعد مدة: قد يكون التحميل تقدّم أو اكتمل والصفحة موقوفة
    import('@capacitor/app')
      .then(({ App }) => App.addListener('resume', refresh))
      .catch(() => {});
  }

  const getState = () => state;
  const subscribe = (l) => {
    connect();
    listeners.add(l);
    return () => listeners.delete(l);
  };

  // يبدأ تحميل القارئ id أو يستأنفه، أو يضعه في الانتظار. النتيجة: 'started' · 'queued' · 'done' · 'failed'
  async function start(id) {
    connect();
    try {
      const { result } = await P().start({ id, name: nameOf(id), urls: urlsOf(id) });
      await refresh();
      return result;
    } catch {
      return 'failed';
    }
  }

  // إيقاف القارئ id (الجاري يتوقف، والمنتظر يخرج من الانتظار)؛ وبلا id: الجاري
  async function pause(id = state.active) {
    if (!id) return;
    try {
      await P().pause({ id });
    } catch {
      // الإضافة غير متاحة
    }
    await refresh();
  }

  return {
    getState,
    subscribe,
    useDownloads: () => useSyncExternalStore(subscribe, getState),
    start,
    pause,
    // عند فتح التطبيق: الحالة من أندرويد (هو الذي يحفظها، والملفات في ذاكرة التطبيق فلا يمسحها المتصفح)
    verify: () => {
      connect();
      return refresh();
    },
    // المشغّل الأصلي يقرأ الملفات المحفوظة بنفسه، فلا يبحث مشغّل الصفحة فيها
    hasFiles: () => false,
    isComplete: (id) => state.items[id]?.status === 'done',
  };
}

// ---------- «تنزيل» المقدار ----------
// يحفظ ملفات urls على الجهاز (الناقص وحده)، وonProgress(saved, total) أثناءه.
// النتيجة: 'ok' · 'cancelled' · 'failed' · 'nospace'
export async function saveFiles(urls, onProgress) {
  const p = P();
  let handle = null;
  try {
    handle = await p.addListener('files', ({ saved, total }) => onProgress?.(saved, total));
    const { result } = await p.saveFiles({ urls });
    return result || 'failed';
  } catch {
    return 'failed';
  } finally {
    handle?.remove?.();
  }
}

export function cancelFiles() {
  return Promise.resolve(P().cancelFiles()).catch(() => {});
}

// كم ملفًّا من urls لم يُحفظ على الجهاز بعد؟
export async function missingFiles(urls) {
  try {
    const { count } = await P().missing({ urls });
    return count;
  } catch {
    return urls.length;
  }
}

// المساحة الفارغة على الجهاز بالميغابايت (null إن لم تُعرف)
export async function freeSpace() {
  try {
    const { mb } = await P().freeSpace();
    return typeof mb === 'number' ? mb : null;
  } catch {
    return null;
  }
}
