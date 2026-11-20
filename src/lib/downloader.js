// محرّك التحميل الدائم إلى الجهاز (Cache Storage)، مشترك بين:
//   • صوت القارئ لكامل القرآن (src/lib/offline.js، ٢٠٢٦-١١-١٤)
//   • التفاسير التي تُحمَّل بزرّ (src/lib/tafsirDownload.js، ٢٠٢٦-١١-١٥)
// لكل نوع منهما محرّك مستقل (createDownloader) بحالته وذاكرته، فيُحمَّل تفسير ولو كان قارئ يُحمَّل،
// وفي النوع الواحد عنصر واحد في كل مرة.
//   • لكل عنصر ذاكرة مستقلة فيها ملفاته بمفتاح روابطها.
//   • الإيقاف المؤقت يُبقي ما حُمِّل، والاستئناف يكمل الناقص وحده. وإغلاق التطبيق أثناء التحميل يتركه
//     متوقفًا يُستأنف بزرّه. وانقطاع الاتصال يوقفه، ويُستأنف وحده إذا رجع الاتصال والتطبيق مفتوح.
//   • يُطلب من المتصفح تخزين دائم (navigator.storage.persist) فلا يمسح الملفات من نفسه عند ضيق المساحة.
//   • لا حذف لما حُمِّل (٢٠٢٦-١١-١٥، بطلب صاحب المشروع): ما حُمِّل يبقى.
// الحالة المحفوظة (localStorage، مفتاح لكل محرّك): { [id]: { status: 'paused' | 'done', count, total } }
import { useSyncExternalStore } from 'react';

const CONCURRENCY = 6; // ملفات تُحمَّل معًا
const RETRIES = 2; // إعادة محاولة الملف الواحد قبل إيقاف التحميل
const RETRY_DELAY = 800;
const TICK_MS = 250; // أقصى تواتر لتحديث شريط التقدّم

export const supported = () => typeof caches !== 'undefined' && typeof fetch !== 'undefined';

// رسائل للمستخدم (اكتمال التحميل أو توقّفه) من كل المحرّكات — يعرضها التطبيق رسالةً عابرة أينما كان
const notices = new Set();
export function onDownloadNotice(fn) {
  notices.add(fn);
  return () => notices.delete(fn);
}
export const notify = (text) => notices.forEach((fn) => fn(text));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isQuota = (e) => e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '');

async function fetchStore(cache, url, signal) {
  for (let t = 0; ; t++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // eslint-disable-next-line no-await-in-loop
      await cache.put(url, res);
      return;
    } catch (e) {
      if (signal.aborted || isQuota(e) || t >= RETRIES) throw e;
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_DELAY * (t + 1));
    }
  }
}

// المساحة المتاحة للتطبيق في المتصفح بالميغابايت (null إن لم يُعرف)
export async function freeSpaceMB() {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return null;
    return Math.max(0, Math.floor((quota - (usage || 0)) / 1e6));
  } catch {
    return null;
  }
}

/*
  metaKey: مفتاح الحالة في localStorage
  cacheName(id): اسم ذاكرة العنصر
  urlsOf(id): روابط ملفاته كلها
  messages: { done(id), nospace(id), offline(id), failed(id) } — نصوص الرسائل
*/
export function createDownloader({ metaKey, cacheName, urlsOf, messages }) {
  function readMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(metaKey) || '{}');
      // تحميل كان جاريًا حين أُغلق التطبيق: صار متوقفًا يُستأنف بزرّه
      for (const id of Object.keys(m)) if (m[id].status !== 'done') m[id] = { ...m[id], status: 'paused' };
      return m;
    } catch {
      return {};
    }
  }

  // items: { [id]: { status: 'downloading' | 'paused' | 'done', count, total } } · active: الجاري تحميله
  let state = { items: readMeta(), active: null };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  function setItem(id, item) {
    const items = { ...state.items };
    if (item) items[id] = item;
    else delete items[id];
    state = { ...state, items };
    emit();
  }
  function saveMeta() {
    const out = {};
    for (const [id, it] of Object.entries(state.items)) out[id] = { status: it.status === 'done' ? 'done' : 'paused', count: it.count, total: it.total };
    try {
      localStorage.setItem(metaKey, JSON.stringify(out));
    } catch {
      // التخزين غير متاح
    }
  }

  const getState = () => state;
  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const useDownloads = () => useSyncExternalStore(subscribe, getState);

  let token = 0; // يُزاد عند كل بدء أو إيقاف، فتتوقف عمّال التحميل السابقة
  let controller = null;
  let resumeOnline = null; // عنصر توقف تحميله لانقطاع الاتصال: يُستأنف وحده إذا رجع
  let live = null; // العدد الفعلي للتحميل الجاري { id, count } (شريط التقدّم يُحدَّث على فترات)

  // يبدأ تحميل العنصر id أو يستأنفه. النتيجة: 'done' · 'paused' (أوقفه المستخدم) · 'offline' (انقطع
  // الاتصال) · 'failed' · 'nospace' · 'busy' (غيره يُحمَّل الآن) · 'unsupported' (المتصفح لا يتيح الحفظ)
  async function start(id) {
    if (!supported()) return 'unsupported';
    if (state.active) return 'busy';
    const urls = urlsOf(id);
    const total = urls.length;
    const my = ++token;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    resumeOnline = null;
    const prev = state.items[id];
    state = { ...state, active: id };
    setItem(id, { status: 'downloading', count: prev?.count ?? 0, total });
    // تخزين دائم: لا يمسح المتصفح الملفات من نفسه عند ضيق المساحة (يُطلب ولا يُنتظر قبوله)
    navigator.storage?.persist?.().catch(() => {});

    let cache;
    let todo;
    try {
      cache = await caches.open(cacheName(id));
      const have = new Set((await cache.keys()).map((req) => req.url));
      todo = urls.filter((u) => !have.has(u));
    } catch {
      return finish(my, id, 'failed');
    }
    live = { id, count: total - todo.length };
    let next = 0;
    let error = null;
    let last = 0;
    let pending = null;
    // تحديث شريط التقدّم مرة كل TICK_MS على الأكثر، وآخر تحديث لا يضيع
    const tick = (force) => {
      if (my !== token) return;
      const now = Date.now();
      if (force || now - last >= TICK_MS) {
        clearTimeout(pending);
        pending = null;
        last = now;
        setItem(id, { status: 'downloading', count: live.count, total });
        saveMeta();
      } else if (!pending) {
        pending = setTimeout(() => {
          pending = null;
          tick(true);
        }, TICK_MS - (now - last));
      }
    };
    tick(true);

    const worker = async () => {
      while (next < todo.length && !error && my === token) {
        const url = todo[next++];
        try {
          // eslint-disable-next-line no-await-in-loop
          await fetchStore(cache, url, signal);
          if (my === token) live.count++;
          tick(false);
        } catch (e) {
          if (!error) error = e;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    clearTimeout(pending);

    if (my !== token) return 'paused'; // أوقفه المستخدم (pause تكفّل بالحالة)
    const got = live.count;
    live = null;
    if (!error) {
      setItem(id, { status: 'done', count: total, total });
      state = { ...state, active: null };
      saveMeta();
      emit();
      notify(messages.done(id));
      return 'done';
    }
    setItem(id, { status: 'downloading', count: got, total });
    if (isQuota(error)) return finish(my, id, 'nospace');
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return finish(my, id, offline ? 'offline' : 'failed');
  }

  function finish(my, id, result) {
    if (my !== token) return 'paused';
    token++;
    controller?.abort();
    const it = state.items[id];
    state = { ...state, active: null };
    if (it?.count) setItem(id, { ...it, status: 'paused' });
    else setItem(id, null);
    saveMeta();
    if (result === 'offline') resumeOnline = id;
    if (messages[result]) notify(messages[result](id));
    return result;
  }

  // إيقاف مؤقت: يبقى ما حُمِّل، ويُستأنف لاحقًا من حيث وقف
  function pause() {
    const id = state.active;
    resumeOnline = null;
    if (!id) return;
    token++;
    controller?.abort();
    const it = { ...state.items[id], ...(live?.id === id ? { count: live.count } : {}) };
    live = null;
    state = { ...state, active: null };
    if (it.count) setItem(id, { ...it, status: 'paused' });
    else setItem(id, null);
    saveMeta();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      const id = resumeOnline;
      resumeOnline = null;
      if (id && !state.active && state.items[id]?.status === 'paused') start(id);
    });
  }

  // المتصفح قد يمسح الملفات (عند ضيق المساحة بلا تخزين دائم): عنصر سُجِّل محمَّلًا وذاكرته غير موجودة
  // يُعاد إلى «لم يُحمَّل»
  async function verify() {
    if (!supported()) return;
    for (const id of Object.keys(state.items)) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await caches.has(cacheName(id)).catch(() => true);
      if (!ok && state.active !== id) setItem(id, null);
    }
    saveMeta();
  }

  return {
    getState,
    subscribe,
    useDownloads,
    start,
    pause,
    verify,
    // هل للعنصر ملفات محفوظة (كاملة أو بعضها)؟
    hasFiles: (id) => !!state.items[id]?.count,
    // هل حُمِّل كاملًا؟
    isComplete: (id) => state.items[id]?.status === 'done',
  };
}
