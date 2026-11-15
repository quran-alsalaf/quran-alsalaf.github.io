// تحميل التفاسير الكبيرة إلى الجهاز (٢٠٢٦-١١-١٥، «تفاسير كثيرة» المرحلة ٢): السعدي والبغوي، ويُضاف بعدهما
// ابن كثير والطبري ببياناتهما وحدها (src/data/tafsirs.js).
//   • تظهر في قائمة التفاسير (صفحات المحتوى وبطاقة «تفسير» من مربع الآية) ولا تُختار قبل اكتمال تحميلها،
//     وفي آخر سطر كلٍّ زرّ تحميل: تأكيد يذكر الحجم، ثم دائرة تقدّم ونسبة، والضغط عليها إيقاف واستئناف.
//     وعند الاكتمال يختفي الزرّ ويصير التفسير متاحًا. ولا حذف لما حُمِّل (بطلب صاحب المشروع).
//   • ملف لكل سورة (١١٤ ملفًّا) في ذاكرة مستقلة لكل تفسير باسم tafsir-<id>، بمحرّك التحميل المشترك مع
//     صوت القرّاء (src/lib/downloader.js) لكن بمحرّك مستقل: يُحمَّل تفسير ولو كان قارئ يُحمَّل.
// الحالة المحفوظة (localStorage «hq.tafsirDownloads»): { [id]: { status: 'paused' | 'done', count, total } }
import { createDownloader, supported } from './downloader.js';
import { isDownloadable, tafsirInfo } from '../data/tafsirs.js';

const SURAS = 114;
// (import.meta.env غائب خارج Vite)
const BASE = import.meta.env?.BASE_URL ?? '/';

export const tafsirCacheName = (id) => `tafsir-${id}`;

// روابط ملفات التفسير المطلقة (مفاتيح الذاكرة)، بترتيب السور
export function tafsirUrls(id) {
  const root = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/';
  return Array.from({ length: SURAS }, (_, i) => new URL(`${BASE}data/tafsir/${id}/${i + 1}.json`, root).href);
}

const nameOf = (id) => `تفسير ${tafsirInfo(id).name}`;
const D = createDownloader({
  metaKey: 'hq.tafsirDownloads',
  cacheName: tafsirCacheName,
  urlsOf: tafsirUrls,
  messages: {
    done: (id) => `اكتمل تحميل ${nameOf(id)} — يعمل الآن بلا إنترنت`,
    nospace: (id) => `توقّف تحميل ${nameOf(id)}: لا تكفي المساحة المتاحة على الجهاز`,
    offline: (id) => `توقّف تحميل ${nameOf(id)} لانقطاع الاتصال، ويُستأنف وحده إذا رجع`,
    failed: (id) => `توقّف تحميل ${nameOf(id)}: تعذّر الوصول إلى ملفاته`,
  },
});

export const tafsirDownloads = D.getState;
export const useTafsirDownloads = D.useDownloads;
export const subscribeTafsirDownloads = D.subscribe;
export const startTafsirDownload = D.start;
export const pauseTafsirDownload = D.pause;
export const verifyTafsirDownloads = D.verify;
export const canDownloadTafsir = supported;

// هل يُعرض التفسير ويُختار؟ المبني مع التطبيق دائمًا، وما يُحمَّل بزرّ بعد اكتمال تحميله
export const isTafsirReady = (id) => !!tafsirInfo(id) && (!isDownloadable(id) || D.isComplete(id));

// بيانات التفسير المحمَّل من ذاكرته: { verses } لكل آيات المصحف بترتيبها (فهرس quran.verses)
export async function readDownloadedTafsir(id) {
  const parts = await Promise.all(
    tafsirUrls(id).map(async (url) => {
      const res = await caches.match(url, { cacheName: tafsirCacheName(id) });
      if (!res) throw new Error(`ملف ناقص: ${url}`);
      return (await res.json()).verses;
    })
  );
  return { verses: parts.flat() };
}
