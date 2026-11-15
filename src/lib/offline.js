// تحميل صوت قارئ لكامل القرآن (٢٠٢٦-١١-١٤): يُحفظ على الجهاز حفظًا دائمًا (Cache Storage)، فيعمل
// الاستماع بصوته بلا إنترنت ولو أُغلق التطبيق وفُتح من جديد — بخلاف «تنزيل للاستماع بلا إنترنت» في
// نافذة الاستماع (src/lib/player.js) الذي يبقى في الذاكرة طوال الجلسة وحدها.
//   • لكل قارئ ذاكرة مستقلة باسم reciter-audio-<id>، فيها ملف كل آية (٦٢٣٦ ملفًّا) بمفتاح رابطه في الشبكة.
//     وملف الفاتحة ١:١ منها هو البسملة نفسها قبل أول كل سورة. ولقارئ ورش ملفاته وملفات البسملة (allFiles).
//   • قارئ واحد يُحمَّل في كل مرة. والتحميل يجري في الخلفية ولو أُغلقت صفحة اختيار القارئ.
//   • الإيقاف والاستئناف وانقطاع الاتصال والتخزين الدائم: محرّك التحميل المشترك (src/lib/downloader.js).
//   • لا حذف لصوت قارئ محمَّل (٢٠٢٦-١١-١٥، بطلب صاحب المشروع؛ كان الضغط على ✓ يحذفه).
//   • التشغيل (player.js) يقرأ من هنا كل آية موجودة لقارئها — ولو كان تحميله ناقصًا — ويبثّ الباقي.
// الحالة المحفوظة (localStorage «hq.offline»): { [id]: { status: 'paused' | 'done', count, total } }
import { allFiles, reciterById, reciterTitle } from './reciters.js';
import { createDownloader, freeSpaceMB, onDownloadNotice, supported } from './downloader.js';

const CACHE_PREFIX = 'reciter-audio-';

// عدد آيات كل سورة بترقيم حفص (المجموع ٦٢٣٦)
export { HAFS_COUNTS as AYAH_COUNTS } from './reciters.js';

export const cacheName = (id) => CACHE_PREFIX + id;
export { supported, freeSpaceMB };

// روابط ملفات القارئ كلها بترتيب المصحف (بلا السور التي لا يشملها تسجيله إن وُجدت)، ومنها البسملة؛
// ولقرّاء ورش ملفاتهم كما يُقرأ بها مصحف ورش (allFiles في src/lib/reciters.js)
export const reciterUrls = (r) => allFiles(r);

const nameOf = (id) => reciterTitle(reciterById(id));
const D = createDownloader({
  metaKey: 'hq.offline',
  cacheName,
  urlsOf: (id) => reciterUrls(reciterById(id)),
  messages: {
    done: (id) => `اكتمل تحميل تلاوة ${nameOf(id)} — تعمل الآن بلا إنترنت`,
    nospace: (id) => `توقّف تحميل ${nameOf(id)}: لا تكفي المساحة المتاحة على الجهاز`,
    offline: (id) => `توقّف تحميل ${nameOf(id)} لانقطاع الاتصال، ويُستأنف وحده إذا رجع`,
    failed: (id) => `توقّف تحميل ${nameOf(id)}: تعذّر الوصول إلى ملفات الصوت`,
  },
});

// items: { [id]: { status: 'downloading' | 'paused' | 'done', count, total } } · active: القارئ الجاري تحميله
export const offlineState = D.getState;
export const useOffline = D.useDownloads;
// رسائل التحميل (القرّاء والتفاسير معًا) — يعرضها التطبيق رسالةً عابرة أينما كان
export const onOfflineNotice = onDownloadNotice;
// هل للقارئ ملفات محفوظة (كاملة أو بعضها)؟ — فيبحث المشغّل عن الآية فيها قبل بثّها
export const hasOfflineFiles = D.hasFiles;
// هل حُمِّل القارئ كاملًا؟
export const isOfflineComplete = D.isComplete;
// يبدأ تحميل القارئ id أو يستأنفه (النتائج في src/lib/downloader.js)
export const startDownload = D.start;
// إيقاف مؤقت: يبقى ما حُمِّل، ويُستأنف لاحقًا من حيث وقف
export const pauseDownload = D.pause;
// قارئ سُجِّل محمَّلًا ومسح المتصفح ملفاته يُعاد إلى «لم يُحمَّل»
export const verifyDownloads = D.verify;

// ---------- القراءة للتشغيل ----------
// رابط محلي لملف الآية من ذاكرة القارئ إن وُجد فيها، وإلا null (فيُبثّ من الشبكة).
// تُبقى آخر بضعة روابط محلية وحدها، ويُحرَّر ما قبلها
const localUrls = new Map(); // رابط الشبكة ⇐ { id, url }
const MAX_LOCAL = 6;
export async function localAudioUrl(id, remote) {
  if (!hasOfflineFiles(id) || !supported()) return null;
  const hit = localUrls.get(remote);
  if (hit) return hit.url;
  try {
    const res = await caches.match(remote, { cacheName: cacheName(id) });
    if (!res) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }));
    if (localUrls.size >= MAX_LOCAL) {
      const [k, v] = localUrls.entries().next().value;
      URL.revokeObjectURL(v.url);
      localUrls.delete(k);
    }
    localUrls.set(remote, { id, url });
    return url;
  } catch {
    return null;
  }
}
