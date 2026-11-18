// الاستماع (الفصل ٦): مشغّل واحد للتطبيق كله، بعنصر صوت واحد.
//   • «تشغيل» فوري: بثّ مباشر آيةً آية بلا انتظار، كما في المصحف المطبوع — يحتاج اتصالًا
//     مستمرًا، وينقطع الصوت إن انقطع الاتصال (بقرار صاحب المشروع ٢٠٢٦-٠٩-٢٢، بعد أن تبيّن أن
//     تحميل المقدار كاملًا قبل التشغيل يؤخره كثيرًا خصوصًا لقرّاء ملف السورة)
//   • «تنزيل» منفصل واختياري: يُحمَّل صوت المقدار كاملًا (بشريط تقدّم)، وبعده يشغَّل من نسخة
//     محلية بلا حاجة لاتصال، ولو قُفل الجهاز أو قُطع الإنترنت — لأن التشغيل يستعمل تلقائيًا
//     أي ملف محمَّل سلفًا بدل بثّه من الشبكة
//   • كل قارئ ملف مستقل لكل آية (src/lib/reciters.js)
//   • قبل الآية الأولى من كل سورة (عدا الفاتحة والتوبة) تُقرأ البسملة: وهي آية الفاتحة الأولى
//     بصوت القارئ نفسه (ولقرّاء ورش ملف بسملة لكل سورة: basmalaFile في src/lib/reciters.js)
//   • قرّاء ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٣): في مصحف ورش لا يُقرأ إلا بقرّاء ورش، ولكل رواية قارئها
//     المختار (settings.reciter لحفص، settings.warshReciter لورش). والمقدار يُقرأ «مقاطع»: آيات الملف الواحد
//     معًا (verseFiles): آيتان في ملف واحد تُقرآن مرة وتُظلَّلان معًا (state.vs)، وآية في ملفين يُقرآن متتاليين
//   • التشغيل في الخلفية وأزرار شاشة القفل عبر Media Session
//   • القارئ المحمَّل على الجهاز (src/lib/offline.js): تُقرأ كل آية من ملفه المحفوظ إن وُجد، وإلا بُثّت
//   • مؤقّت التلاوة (٢٠٢٦-١١-١٦): تقف التلاوة بعد مدة بالدقائق، عند نهاية الآية الجارية — setTimer()
//   • داخل تطبيق أندرويد (٢٠٢٦-١١-١٨): يتلو مشغّل أندرويد نفسه لا عنصر الصوت (src/lib/nativeAudio.js)، والواجهة
//     هنا كما هي: play وretarget وpause وresume وstop وsetSettings وsetTimer ترسل إليه، وحالته تصل إلى state
import { useEffect, useState, useSyncExternalStore } from 'react';
import { basmalaFile, covers, DEFAULT_RECITER, reciterById, reciterFor, reciterTitle, riwayahOf, verseFiles } from './reciters.js';
import { isWarsh } from './riwayah.js';
import { hasOfflineFiles, isOfflineComplete, localAudioUrl } from './offline.js';
import { toArabicDigits } from '../data/quran.js';
import { adoptCmd, latestCmd, listenNative, nativeItems, send, useNativeAudio, verseTitle } from './nativeAudio.js';

const KEY = 'hq.listen';
// ١ (بدون تكرار) يُعرض بعبارته لا رقمه؛ فالقائمة العددية تبدأ من ٢ (بطلب صاحب المشروع)
export const REPEATS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50];
export const FOREVER = 0; // تكرار النطاق بلا نهاية (∞)

const DEFAULTS = { reciter: DEFAULT_RECITER.hafs, warshReciter: DEFAULT_RECITER.warsh, verseRepeat: 1, rangeRepeat: 1 };
// مفتاح القارئ المختار لرواية المصحف quran في الإعدادات
export const reciterKey = (q) => (isWarsh(q) ? 'warshReciter' : 'reciter');
// القارئ المختار لرواية المصحف quran
export const chosenReciter = (q, settings = state.settings) =>
  reciterFor(settings[reciterKey(q)], isWarsh(q) ? 'warsh' : 'hafs');

function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// ---------- الحالة المعلنة لواجهة التطبيق ----------
// status: 'idle' | 'loading' | 'playing' | 'paused' — v: الآية الجاري تلاوتها (أول آيات المقطع)، vs: آيات المقطع كلها
// n: يُزاد عند بدء كل مقطع (آية أو بسملة أو إعادتها)، فيُعرف به بدء الآية التالية ولو كانت هي نفسها
// download: null أو { active, done, fileIndex, fileCount, pct } — تقدّم التنزيل المنفصل
// timer: null أو { minutes, left: ما بقي (ملي ثانية) عند آخر تجميد، endsAt: موعد انتهائه ما دام يعدّ (وإلا null) } — مؤقّت التلاوة
// notice: { text, n } رسالة إعلامية للواجهة (انتهاء المؤقّت)
let state = { status: 'idle', v: null, vs: null, n: 0, settings: readSettings(), error: null, download: null, preview: null, timer: null, notice: null };
const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  if ('status' in patch) syncTimer();
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePlayer = () => useSyncExternalStore(subscribe, () => state);
// الحالة الحالية خارج React (للاختبارات)
export const playerState = () => state;

// ---------- المحرّك ----------
let audio = null;
let quran = null;
let list = []; // آيات النطاق (أرقامها في المصحف)
let queue = []; // مقاطع النطاق: [{ vs: آيات المقطع، files: روابط ملفاته بالترتيب }]
let pos = 0; // موضع المقطع الجاري في النطاق
let verseRep = 0; // كم مرة قُرئت الآية الجارية
let rangeRep = 0; // كم مرة قُرئ النطاق
let continuous = false; // استماع بلا مقدار: من الصفحة الظاهرة متتابعًا إلى آخر المصحف، بلا تكرار للمقدار
let seg = null; // الملف الجاري: { unit, part } (الملف part من المقطع) أو { unit, basmala: رابطها }
let gen = 0; // يُزاد عند كل تشغيل أو إيقاف جديد، فيُهمل ما تأخر من طلبات تشغيل سابقة
let dlToken = 0; // يُزاد عند كل تنزيل أو إلغاء، مستقل عن gen، فلا يقطع أحدهما الآخر

// ---------- ذاكرة الملفات المنزَّلة (رابط الشبكة ⇐ رابط محلي) ----------
// تُستعمل تلقائيًا في التشغيل إن وُجدت (فيعمل بلا اتصال)، وتبقى طوال الجلسة وحدها لا أكثر.
const blobUrls = new Map();
const MAX_CACHED_FILES = 24;
function cacheBlob(url, blob) {
  if (blobUrls.size >= MAX_CACHED_FILES) {
    const oldest = blobUrls.keys().next().value;
    URL.revokeObjectURL(blobUrls.get(oldest));
    blobUrls.delete(oldest);
  }
  blobUrls.set(url, URL.createObjectURL(blob));
}
const resolveUrl = (remote) => blobUrls.get(remote) || remote;

const reciter = () => chosenReciter(quran);
// مقاطع الآيات verses بالقارئ r: آيات متتالية يبدأ ملف ثانيتها بآخر ملف الأولى تُضمّ في مقطع واحد.
// vs آيات المقطع من verses، وshown ما يُظلَّل: هي ومعها ما جاورها خارج verses وصوته كله في ملفات المقطع
// (تشغيل الملك ٩ وحدها يُسمع معها ١٠ لأنهما في ملف واحد، فتُظلَّلان معًا)
export function unitsOf(q, r, verses) {
  const units = [];
  for (const v of verses) {
    const files = verseFiles(r, q, v);
    const last = units.at(-1);
    if (last && last.vs.at(-1) === v - 1 && files[0] === last.files.at(-1)) {
      last.vs.push(v);
      last.files.push(...files.slice(1));
    } else units.push({ vs: [v], files: [...files] });
  }
  const inside = new Set(verses);
  const only = (v, f) => q.verses[v] && !inside.has(v) && (() => {
    const fs = verseFiles(r, q, v);
    return fs.length === 1 && fs[0] === f;
  })();
  for (const u of units) {
    const shown = [...u.vs];
    while (only(shown[0] - 1, u.files[0]) && q.verses[shown[0] - 1].s === q.verses[shown[0]].s) shown.unshift(shown[0] - 1);
    while (only(shown.at(-1) + 1, u.files.at(-1)) && q.verses[shown.at(-1) + 1].s === q.verses[shown.at(-1)].s) shown.push(shown.at(-1) + 1);
    u.shown = shown;
  }
  return units;
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('ended', () => segmentDone());
  audio.addEventListener('playing', () => state.status !== 'idle' && set({ status: 'playing' }));
  audio.addEventListener('waiting', () => state.status === 'playing' && set({ status: 'loading' }));
  audio.addEventListener('error', () => {
    if (state.status === 'idle' || !audio.getAttribute('src')) return;
    stop();
    set({ error: { text: 'تعذّر تشغيل الصوت. الاستماع يحتاج اتصالًا بالإنترنت (إلا ما نُزِّل مسبقًا).', n: Date.now() } });
  });
  setupMediaSession();
  return audio;
}

// ---------- التنزيل المنفصل (اختياري، للاستماع بلا إنترنت) ----------
// روابط ملفات الآيات المطلوبة (ملف مستقل لكل آية، ومثله للبسملة إن لزمت)
function resourcesFor(verses) {
  const r = reciter();
  const files = new Set(verses.flatMap((v) => verseFiles(r, quran, v)));
  for (const v of verses) {
    const b = basmalaFile(r, quran, v);
    if (b) files.add(b);
  }
  return [...files];
}

// يُنزّل ملفًا مع تبليغ نسبة تقدّمه (إن عُرف حجمه من الخادم)
async function fetchBlob(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body?.getReader || !total) {
    const blob = await res.blob();
    onProgress(null);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(Math.min(99, Math.round((loaded / total) * 100)));
  }
  return new Blob(chunks, { type: 'audio/mpeg' });
}

// ينزّل صوت verses بالقارئ الحالي، ليُشغَّل لاحقًا بلا إنترنت. النتيجة:
// 'unsupported' (القارئ لا يشمل هذا الموضع) · 'failed' (تعذّر التنزيل) · 'cancelled' · 'ok'
export async function downloadRange(q, verses) {
  quran = q;
  const r = reciter();
  if (!covers(r, suraList(verses))) return 'unsupported';
  const myToken = ++dlToken;
  const files = resourcesFor(verses);
  set({ download: { active: true, done: false, fileIndex: 0, fileCount: files.length, pct: null } });
  for (let i = 0; i < files.length; i++) {
    if (myToken !== dlToken) return 'cancelled';
    const url = files[i];
    if (blobUrls.has(url)) continue;
    set({ download: { active: true, done: false, fileIndex: i + 1, fileCount: files.length, pct: 0 } });
    try {
      // eslint-disable-next-line no-await-in-loop
      const blob = await fetchBlob(url, (pct) => {
        if (myToken === dlToken) set({ download: { active: true, done: false, fileIndex: i + 1, fileCount: files.length, pct } });
      });
      if (myToken !== dlToken) return 'cancelled';
      cacheBlob(url, blob);
    } catch {
      set({ download: null });
      return 'failed';
    }
  }
  set({ download: { active: false, done: true, fileIndex: files.length, fileCount: files.length, pct: 100 } });
  return 'ok';
}

export function cancelDownload() {
  dlToken++;
  set({ download: null });
}

// هل مقدار verses منزَّل كاملًا بالقارئ الحالي؟ (لعرض «تم التنزيل» بدل زرّه)
export function isDownloaded(q, verses) {
  quran = q;
  const r = reciter();
  if (!covers(r, suraList(verses))) return false;
  // القارئ محمَّل كاملًا على الجهاز: كل مقدار يعمل بلا إنترنت
  if (isOfflineComplete(r.id)) return true;
  return resourcesFor(verses).every((f) => blobUrls.has(f));
}

// يبدأ الاستماع لآيات verses فورًا: من ملف منزَّل إن وُجد، وإلا بثًّا مباشرًا. النتيجة:
// 'unsupported' (القارئ المختار لا يشمل تسجيلُه موضعها، كما في downloadRange) · 'playing'
// cont: استماع متتابع بلا مقدار (verses من أول الصفحة الظاهرة إلى آخر المصحف): لا يُكرَّر، ويقف في آخره
export function play(q, verses, cont = false) {
  quran = q;
  const r = reciter();
  if (!covers(r, suraList(verses))) return 'unsupported';
  ++gen;
  list = verses;
  queue = unitsOf(q, r, verses);
  continuous = cont;
  pos = 0;
  verseRep = 0;
  rangeRep = 0;
  if (useNativeAudio()) {
    set({ error: null, status: 'loading', v: queue[0].vs[0], vs: queue[0].shown });
    nativeLoad('start', 0, { withBasmala: true, timerLeft: state.timer ? timerLeft() : null });
    return 'playing';
  }
  set({ error: null });
  startVerse(true);
  return 'playing';
}

// تعديل المقدار أثناء التشغيل (عند إغلاق نافذة الاستماع بعد تعديله): إن بقيت الآية الجارية داخل
// المقدار الجديد أكمل منها بلا انقطاع وانتهى عند نهايته الجديدة، بعدّاد التكرار نفسه؛ وإلا بدأ من
// أول آية فيه بعدّاد تكرار جديد. النتيجة كـplay()، أو 'continued' إن أكمل من حيث هو
export function retarget(q, verses, cont = false) {
  if (state.status === 'idle') return 'idle';
  // في التطبيق: الآية الجارية من حالة المشغّل الأصلي (فقد تُفتح الصفحة من جديد والتلاوة جارية)
  const current = useNativeAudio() ? state.v : queue[pos].vs[0];
  if (!verses.includes(current)) return play(q, verses, cont);
  quran = q;
  const r = reciter();
  if (!covers(r, suraList(verses))) {
    stop();
    return 'unsupported';
  }
  const units = unitsOf(q, r, verses);
  const at = units.findIndex((u) => u.vs.includes(current));
  list = verses;
  queue = units;
  continuous = cont;
  pos = at;
  if (useNativeAudio()) nativeLoad('continue', at);
  return 'continued';
}

// ---------- مؤقّت التلاوة (٢٠٢٦-١١-١٦) ----------
// يُختار من نافذة الاستماع بالدقائق. يعدّ ما دامت التلاوة تعمل (أو تتحمّل)، ويتجمّد في الإيقاف المؤقت،
// ولا يبدأ قبل التشغيل. وإذا انتهى الوقت أكملت الآية الجارية ثم وقفت التلاوة — يُفحص عند نهاية كل
// آية، فيصح ولو قُفلت الشاشة (المؤقّتات العادية تتأخر في الخلفية، ونهاية الآية تصل دائمًا).
// وبعد أن يوقفها يرجع إلى «بلا مؤقت»، وكذا الإيقاف التام وانتهاء التلاوة
export const TIMER_OPTIONS = [15, 30, 45, 60, 90];
export const TIMER_MAX = 360;
const counting = () => state.status === 'playing' || state.status === 'loading';

// يبدأ العدّ أو يجمّده بحسب حالة التشغيل (يُستدعى عند كل تغيّر في status)
function syncTimer() {
  const t = state.timer;
  if (!t) return;
  const now = Date.now();
  if (counting() && t.endsAt == null) state = { ...state, timer: { ...t, endsAt: now + t.left } };
  else if (!counting() && t.endsAt != null) state = { ...state, timer: { ...t, left: Math.max(0, t.endsAt - now), endsAt: null } };
}

// ما بقي من المؤقّت بالملي ثانية (null بلا مؤقّت)
export function timerLeft(t = state.timer, now = Date.now()) {
  if (!t) return null;
  return Math.max(0, t.endsAt != null ? t.endsAt - now : t.left);
}

// يضبط المؤقّت بالدقائق (أو يلغيه بـnull). أثناء التشغيل يبدأ العدّ من الآن، وقبله ينتظر التشغيل
export function setTimer(minutes) {
  if (!minutes) {
    set({ timer: null });
    if (useNativeAudio() && state.status !== 'idle') send('setTimer', { left: null });
    return;
  }
  const left = minutes * 60000;
  set({ timer: { minutes, left, endsAt: counting() ? Date.now() + left : null } });
  if (useNativeAudio() && state.status !== 'idle') send('setTimer', { left });
}

// يقرأ عدد الدقائق الذي كتبه المستخدم (بالأرقام العربية أو الغربية): عدد صحيح ١–٣٦٠، وإلا null
export function parseMinutes(text) {
  const s = String(text ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= TIMER_MAX ? n : null;
}

// يعيد رسم المكوّن كل ثانية ما دام المؤقّت يعدّ (لعرض ما بقي منه)
export function useTimerTick() {
  const { timer } = usePlayer();
  const [, tick] = useState(0);
  const running = timer?.endsAt != null;
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return timer ? timerLeft(timer) : null;
}

// ما بقي من المؤقّت مختصرًا للعرض («٢٨ د»)، وبعد انتهاء الوقت تكمل الآية الجارية: «بعد الآية»
export const timerShort = (ms) => (ms > 0 ? `${toArabicDigits(Math.ceil(ms / 60000))} د` : 'بعد الآية');

const timerExpired = () => state.timer != null && timerLeft() <= 0;

const suraList = (verses) => [...new Set(verses.map((v) => quran.verses[v].s))];

// يقرأ المقطع الجاري (مسبوقًا بالبسملة إن كان أول سورته وهذه أول قراءة له)
function startVerse(withBasmala) {
  const unit = queue[pos];
  const basmala = withBasmala && verseRep === 0 && basmalaFile(reciter(), quran, unit.vs[0]);
  playSegment(basmala ? { unit, basmala } : { unit, part: 0 });
}

function playSegment(next) {
  const el = ensureAudio();
  const r = reciter();
  seg = next;
  set({ status: el.paused ? 'loading' : 'playing', v: next.unit.vs[0], vs: next.unit.shown, n: state.n + 1 });
  updateMetadata();
  const remote = next.basmala || next.unit.files[next.part];
  const local = resolveUrl(remote);
  // القارئ محمَّل على الجهاز (كله أو بعضه): يُقرأ ملف الآية المحفوظ إن وُجد، وإلا بُثّ
  if (local === remote && hasOfflineFiles(r.id)) {
    localAudioUrl(r.id, remote).then((url) => {
      if (seg !== next) return; // تغيّر المقطع أو توقف التشغيل أثناء البحث
      el.src = url || remote;
      if (state.status !== 'paused') el.play().catch(onPlayError);
    });
    return;
  }
  // ملف منزَّل مسبقًا فيُشغَّل مباشرة، وإلا فبثّ مباشر من الشبكة
  el.src = local;
  el.play().catch(onPlayError);
}

function onPlayError(e) {
  // إيقاف مقصود أثناء التحميل ليس خطأ
  if (e?.name === 'AbortError') return;
  if (e?.name === 'NotAllowedError') {
    set({ status: 'paused' });
    return;
  }
  stop();
  set({ error: { text: 'تعذّر تشغيل الصوت. الاستماع يحتاج اتصالًا بالإنترنت (إلا ما نُزِّل مسبقًا).', n: Date.now() } });
}

function segmentDone() {
  if (!seg || state.status === 'idle') return;
  const done = seg;
  seg = null; // لا يُحتسب المقطع منتهيًا مرتين
  // بعد البسملة: الآية نفسها
  if (done.basmala) return startVerse(false);
  // ملف المقطع التالي إن بقي له ملف (آية ورش في ملفين من ملفات حفص)
  if (done.part + 1 < done.unit.files.length) return playSegment({ unit: done.unit, part: done.part + 1 });
  // انتهى مؤقّت التلاوة: تقف بعد الآية الجارية (ولو بقي من تكرارها)
  if (timerExpired()) {
    stop();
    set({ notice: { text: 'انتهى مؤقّت التلاوة', n: Date.now() } });
    return;
  }
  const { verseRepeat, rangeRepeat } = state.settings;
  // تكرار الآية: يُقفز إلى أولها من جديد
  if (++verseRep < verseRepeat) return startVerse(false);
  verseRep = 0;
  if (++pos >= queue.length) {
    if (continuous) return stop();
    pos = 0;
    if (rangeRepeat !== FOREVER && ++rangeRep >= rangeRepeat) return stop();
  }
  startVerse(true);
}

export function pause() {
  if (useNativeAudio()) {
    if (state.status === 'idle') return;
    set({ status: 'paused' });
    send('pause');
    return;
  }
  if (!audio || state.status === 'idle') return;
  audio.pause();
  set({ status: 'paused' });
}

export function resume() {
  if (useNativeAudio()) {
    if (state.status === 'paused') send('resume');
    return;
  }
  if (!audio || state.status !== 'paused') return;
  audio.play().catch(onPlayError);
}

export function stop() {
  gen++;
  seg = null;
  // الإيقاف التام وانتهاء التلاوة يلغيان المؤقّت (لا قبل التشغيل: المؤقّت المختار حينها ينتظر «تشغيل»)
  if (state.status !== 'idle') state = { ...state, timer: null };
  if (useNativeAudio()) {
    set({ status: 'idle', v: null, vs: null });
    send('stop');
    return;
  }
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  set({ status: 'idle', v: null, vs: null });
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
}

// الانتقال إلى الآية السابقة أو التالية في النطاق (من أزرار شاشة القفل)
export function skip(d) {
  if (state.status === 'idle') return;
  if (useNativeAudio()) {
    send('skip', { d });
    return;
  }
  pos = (pos + d + queue.length) % queue.length;
  verseRep = 0;
  seg = null;
  startVerse(true);
}

// حفظ الإعدادات. وتغيير القارئ أثناء التشغيل يعيد الآية الجارية بصوت القارئ الجديد
export function setSettings(patch) {
  const settings = { ...state.settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // التخزين غير متاح: تسري الإعدادات في هذه الجلسة وحدها
  }
  set({ settings });
  const native = useNativeAudio();
  if (quran && list.length && patch[reciterKey(quran)] && state.status !== 'idle') {
    const r = reciter();
    if (!covers(r, suraList(list))) {
      stop();
      return false;
    }
    // نفس الموضع بصوت القارئ الجديد: البسملة إن كانت هي الجارية، وإلا أول الآية الجارية
    const inBasmala = native ? !!nativeSeg?.basmala : !!seg?.basmala;
    const v = native ? state.v : queue[pos].vs[0];
    queue = unitsOf(quran, r, list);
    pos = Math.max(0, queue.findIndex((u) => u.vs.includes(v)));
    seg = null;
    if (native) nativeLoad('restart', pos, { withBasmala: inBasmala });
    else startVerse(inBasmala);
  } else if (native && state.status !== 'idle' && ('verseRepeat' in patch || 'rangeRepeat' in patch)) {
    // تكرار الآية أو المقدار أثناء التلاوة: يسري من نهاية الجاري، كما في الموقع
    send('setOptions', { verseRepeat: settings.verseRepeat, rangeRepeat: settings.rangeRepeat });
  }
  return true;
}

// ---------- المشغّل الأصلي داخل التطبيق (src/lib/nativeAudio.js) ----------
// يحمّل مقاطع المقدار الحالي (queue) في المشغّل الأصلي بإعدادات الاستماع، من المقطع at
function nativeLoad(mode, at, extra = {}) {
  const r = reciter();
  const { verseRepeat, rangeRepeat } = state.settings;
  send('loadRange', { mode, items: nativeItems(quran, r, queue), pos: at, verseRepeat, rangeRepeat, continuous, artist: reciterTitle(r), ...extra });
}

// آخر ملف بلّغ به المشغّل: { segment، basmala } (null والمشغّل متوقف)
let nativeSeg = null;
const PLAY_ERROR = 'تعذّر تشغيل الصوت. الاستماع يحتاج اتصالًا بالإنترنت (إلا ما نُزِّل مسبقًا).';

// حالة المشغّل الأصلي ⇐ حالة الواجهة. وما سبق آخر أوامر الصفحة يُهمل (رقم cmd)
export function applyNativeState(e) {
  if (!e || !e.status) return;
  if (e.cmd != null && e.cmd < latestCmd()) return;
  if (e.cmd != null) adoptCmd(e.cmd);
  if (e.status === 'idle') {
    nativeSeg = null;
    const patch = { status: 'idle', v: null, vs: null };
    if (state.status !== 'idle') patch.timer = null;
    if (e.reason === 'timer') patch.notice = { text: 'انتهى مؤقّت التلاوة', n: Date.now() };
    if (e.reason === 'error') patch.error = { text: PLAY_ERROR, n: Date.now() };
    if (state.status === 'idle' && !patch.notice && !patch.error) return;
    set(patch);
    return;
  }
  const patch = { status: e.status };
  // ملف جديد (آية أو بسملة أو إعادتها): كبدء المقطع في الموقع، فيُظلَّل ويقلّب المصحف إليه
  if (!nativeSeg || nativeSeg.segment !== e.segment) Object.assign(patch, { v: e.v, vs: e.shown, n: state.n + 1 });
  nativeSeg = { segment: e.segment, basmala: !!e.basmala };
  // مؤقّت التلاوة: ما بقي منه عند المشغّل هو المعتمد
  if (e.timerLeft == null) patch.timer = null;
  else {
    const minutes = state.timer?.minutes ?? Math.max(1, Math.ceil(e.timerLeft / 60000));
    patch.timer = { minutes, left: e.timerLeft, endsAt: e.counting ? Date.now() + e.timerLeft : null };
  }
  set(patch);
}

if (useNativeAudio()) listenNative(applyNativeState);

// ---------- Media Session: التشغيل في الخلفية وأزرار شاشة القفل ----------
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const on = (action, fn) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      // الإجراء غير مدعوم في هذا المتصفح
    }
  };
  on('play', resume);
  on('pause', pause);
  on('stop', stop);
  on('previoustrack', () => skip(-1));
  on('nexttrack', () => skip(1));
}

function updateMetadata() {
  if (!('mediaSession' in navigator) || !quran || !seg) return;
  const r = reciter();
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: verseTitle(quran, seg.unit.vs[0]),
      artist: reciterTitle(r),
      album: 'قرآن السلف',
      artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {
    // MediaMetadata غير مدعوم
  }
}

// ---------- معاينة صوت القارئ (٢٠٢٦-١١-١٣) ----------
// من قائمة اختيار القارئ: تُسمِع «الحمد لله رب العالمين» (الفاتحة ٢) بصوت القارئ، بعنصر صوت مستقل عن
// التلاوة، فلا تغيّر القارئ المختار ولا المقدار ولا الإعدادات. ومعاينة واحدة في كل مرة.
// إن كانت التلاوة شغّالة توقفت مؤقتًا أثناءها، ثم تُكمل من حيث وقفت عند انتهاء المعاينة أو إيقافها.
// state.preview: null أو { id, status: 'loading' | 'playing' }
export const PREVIEW_AYAH = { s: 1, a: 2 };
// مقطع المعاينة مبني مع التطبيق (public/audio/preview، scripts/data/09-previews.mjs) ويخزّنه عامل الخدمة
// مسبقًا، فتعمل المعاينة بلا إنترنت (٢٠٢٦-١١-١٤)؛ لا يُطلب من موقع الصوت
// ولقرّاء ورش: public/audio/preview/warsh/<id>.mp3 (الفاتحة ١ في ورش، scripts/data/14-warsh-reciters.mjs)
export const previewUrl = (r) =>
  riwayahOf(r) === 'warsh'
    ? `${import.meta.env.BASE_URL}audio/preview/warsh/${r.id}.mp3`
    : `${import.meta.env.BASE_URL}audio/preview/${r.folder}/001002.mp3`;
let previewEl = null;
let previewToken = 0;
let resumeAfterPreview = false;
let previewFail = null;

function ensurePreviewEl() {
  if (previewEl) return previewEl;
  previewEl = new Audio();
  previewEl.preload = 'auto';
  previewEl.addEventListener('ended', () => endPreview());
  previewEl.addEventListener('playing', () => state.preview && set({ preview: { ...state.preview, status: 'playing' } }));
  // (إنهاء المعاينة يصفّر state.preview قبل أن يصل أي حدث من تفريغ العنصر، فلا يُعدّ خطأ)
  previewEl.addEventListener('error', () => state.preview && failPreview());
  return previewEl;
}

function failPreview() {
  const fail = previewFail;
  endPreview();
  fail?.();
}

// يبدأ معاينة القارئ id (ويوقف أي معاينة قبلها). onFail: يُستدعى إن تعذّر التشغيل
export function previewReciter(id, onFail) {
  const el = ensurePreviewEl();
  const token = ++previewToken;
  previewFail = onFail;
  // التلاوة الجارية تتوقف مؤقتًا، وتُستأنف بعد المعاينة (لا إن كان المستخدم قد أوقفها بنفسه)
  if (!state.preview && (audio || useNativeAudio()) && (state.status === 'playing' || state.status === 'loading')) {
    resumeAfterPreview = true;
    pause();
  }
  set({ preview: { id, status: 'loading' } });
  el.src = previewUrl(reciterById(id));
  el.play().catch((e) => {
    if (token !== previewToken || e?.name === 'AbortError') return;
    failPreview();
  });
}

// يوقف المعاينة (إن وُجدت) ويستأنف التلاوة إن أوقفتها المعاينة
export function stopPreview() {
  if (!state.preview && !resumeAfterPreview) return;
  endPreview();
}

function endPreview() {
  previewToken++;
  previewFail = null;
  if (previewEl) {
    previewEl.pause();
    previewEl.removeAttribute('src');
    previewEl.load();
  }
  set({ preview: null });
  if (resumeAfterPreview) {
    resumeAfterPreview = false;
    if (state.status === 'paused') resume();
  }
}
