// مشغّل التلاوة الأصلي (الجلسة ٢ من التطبيق الأصلي، ٢٠٢٦-١١-١٨): داخل تطبيق أندرويد لا تُتلى الآيات بعنصر
// صوت في الصفحة، بل بمشغّل أندرويد نفسه (android/app/src/main/java/com/quranalsalaf/app/audio/)، فتستمر
// والشاشة مقفلة والتطبيق مغلق، بإشعار وأزرار في شاشة القفل، وتحترم أصوات التطبيقات الأخرى.
//
// الصفحة ترسل المقدار مقاطعَ (nativeItems) وإعدادات الاستماع، والمشغّل يقرأ ويكرّر ويقف وحده (ترتيبه نقلٌ
// حرفيّ لمشغّل الموقع: Sequencer.java، ويُختبر الاثنان على الحالات نفسها tests/fixtures/sequence.json)،
// ويبلّغ الصفحة بحدث «state» بالآية الجارية وحالته، فتظلّلها وتقلّب إليها كما في الموقع (src/lib/player.js).
//
// شكل الأوامر عام لا يخصّ أندرويد، فيُكتب مشغّل الآيفون لاحقًا على الشكل نفسه (إضافة QuranAudio).
//   loadRange({ mode, items, pos, verseRepeat, rangeRepeat, continuous, withBasmala, timerLeft, artist })
//     mode: 'start' من أول المقدار · 'continue' يكمل الجاري بمقدار جديد · 'restart' يعيد المقطع pos (تغيير القارئ)
//   pause() · resume() · stop() · skip({ d }) · setOptions({ verseRepeat, rangeRepeat }) · setTimer({ left })
//   getState() ← { status, cmd, segment, pos, v, shown, basmala, timerLeft, counting, reason }
//   ولكل أمر رقم cmd متزايد يُعاد في الحالة، فتُهمل الصفحة حالة سبقت آخر أوامرها
import { registerPlugin } from '@capacitor/core';
import { isNative } from './native.js';
import { basmalaFile } from './reciters.js';
import { toArabicDigits } from '../data/quran.js';

// هل تُتلى الآيات بالمشغّل الأصلي؟ (داخل التطبيق وحده؛ والموقع بعنصر الصوت كما كان)
export const useNativeAudio = () => isNative();

// عنوان الآية v في الإشعار وشاشة القفل
export const verseTitle = (q, v) => `سورة ${q.suras[q.verses[v].s - 1].name} — الآية ${toArabicDigits(q.verses[v].a)}`;

// مقاطع المقدار (unitsOf في src/lib/player.js) بالشكل الذي يرسَل إلى المشغّل:
// f ملفات المقطع بالترتيب، b بسملته (أو null)، t عنوانه، v أول آياته، s ما يُظلَّل منها
export const nativeItems = (q, r, units) =>
  units.map((u) => ({ f: u.files, b: basmalaFile(r, q, u.vs[0]) || null, t: verseTitle(q, u.vs[0]), v: u.vs[0], s: u.shown }));

let plugin = null;
const QuranAudio = () => (plugin ??= registerPlugin('QuranAudio'));

let cmdSeq = 0;
// رقم آخر أمر أُرسل
export const latestCmd = () => cmdSeq;
// الصفحة فُتحت من جديد والتلاوة جارية (بعد إغلاق التطبيق): يُكمل العدّ من رقم المشغّل
export function adoptCmd(cmd) {
  if (cmd > cmdSeq) cmdSeq = cmd;
}

// يرسل أمرًا إلى المشغّل برقمه
export function send(method, args = {}) {
  const cmd = ++cmdSeq;
  return Promise.resolve(QuranAudio()[method]({ ...args, cmd })).catch(() => {});
}

// يستقبل حالة المشغّل: عند كل تغيّر، وعند فتح الصفحة، وعند الرجوع إلى التطبيق من الخلفية
export function listenNative(apply) {
  const p = QuranAudio();
  p.addListener('state', apply);
  const sync = () =>
    Promise.resolve(p.getState())
      .then((s) => s && apply(s))
      .catch(() => {});
  sync();
  import('@capacitor/app')
    .then(({ App }) => App.addListener('resume', sync))
    .catch(() => {});
}
