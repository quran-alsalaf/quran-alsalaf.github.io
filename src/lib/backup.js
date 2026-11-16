// النسخة الاحتياطية والاستعادة (٢٠٢٦-١١-١٦): بيانات المستخدم كلها في ملف واحد صغير، تُستعاد منه على
// أي جهاز — وبه تُنقل بيانات الموقع إلى التطبيق الأصلي لاحقًا (مخزنه غير مخزن المتصفح).
//
// • ما هنا «تجهيز المحتوى» وحده: بناء الملف، وقراءته والتحقق منه، وملخّصه، والاستبدال. أما «تسليم الملف
//   للجهاز» (المشاركة أو التنزيل، واختيار الملف) ففي src/lib/backupFile.js، وهو وحده ما يُستبدل في Capacitor.
// • الاستعادة استبدال كامل (بقرار صاحب المشروع): تُمحى بيانات المفاتيح أدناه كلها، ثم يُكتب ما في الملف.
// • لا يدخل الملف: الأصوات والتفاسير المحمَّلة (حجمها كبير، وتُحمَّل من جديد بزرّها)، وسجل البحث،
//   والتبويب المفتوح في القائمة، وتاريخ آخر نسخة (خاص بكل جهاز).
// • التفسير المختار إن لم يكن محمَّلًا على الجهاز الجديد يُعرض مكانه الميسّر تلقائيًّا (readTafsirSource).
//
// شكل الملف: { app, version, created, data: { 'hq.…': قيمته } } — والقيمة كما في localStorage، محلولةً
// من JSON إن كانت JSON (فيُقرأ الملف بالعين)، وإلا نصًّا كما هي.
// version: رقم شكل الملف. إن أُضيفت بيانات جديدة (ختمة التدبر، التسميع…) زِد مفاتيحها في BACKUP_KEYS،
// ولا يُرفع الرقم إلا إذا تغيّر شكل قديم؛ وحينها تُحوَّل النسخ القديمة هنا قبل الاستبدال، فتبقى كلها مقروءة.
import { countText, DAYS, KHATMAS } from './count.js';
import { dayKey, daysBetween, formatDates } from './khatma.js';
import { RIWAYAT } from './riwayah.js';
import { FIRST_PAGE, LAST_PAGE } from './position.js';

export const BACKUP_APP = 'quran-alsalaf';
export const BACKUP_VERSION = 1;
export const LAST_BACKUP_KEY = 'hq.lastBackup';

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const isRange = (x) => x === null || (Array.isArray(x) && x.length >= 1 && x.length <= 2 && x.every(Number.isInteger));
const isOneOf = (...list) => (x) => list.includes(x);
const isText = (x) => typeof x === 'string' && x.length > 0 && x.length < 64;

// المفاتيح المحفوظة، ولكلٍّ فحص لقيمته: ملف فيه قيمة لا تجتاز فحصها يُعدّ تالفًا فلا يُستعاد منه شيء
export const BACKUP_KEYS = {
  'hq.notes': isObject, // الملاحظات
  'hq.bookmarks': Array.isArray, // العلامات المرجعية
  'hq.khatmas': Array.isArray, // الختمات
  'hq.khatmasDone': isObject, // عدد الختمات المتمة
  'hq.range': isRange, // مقدار الاستماع
  'hq.contentRange': isRange, // مقدار صفحات المحتوى
  'hq.page': (x) => Number.isInteger(x) && x >= FIRST_PAGE && x <= LAST_PAGE, // موضع القراءة
  'hq.riwayah': isOneOf(...RIWAYAT.map((r) => r.id)),
  'hq.bg': isText, // خلفية القراءة
  'hq.accent': isText, // لون التطبيق
  'hq.weeks': isOneOf('on', 'off'), // تمييز مقررات الأسابيع
  'hq.rubAlert': isOneOf('on', 'off'), // التنبيه ببداية الربع
  'hq.readSpeed': (x) => typeof x === 'number' && Number.isFinite(x), // سرعة وضع القراءة
  'hq.tafsir': isText, // التفسير المختار
  'hq.listen': isObject, // إعدادات الاستماع (القارئ لكل رواية، والتكرار)
};

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// قيمة المفتاح كما تُكتب في الملف: JSON محلولًا، أو النص كما هو
function decode(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
const encode = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

// محتوى النسخة من بيانات هذا الجهاز
export function buildBackup(now = new Date()) {
  const store = storage();
  const data = {};
  for (const key of Object.keys(BACKUP_KEYS)) {
    const raw = store?.getItem(key);
    if (raw != null) data[key] = decode(raw);
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, created: now.toISOString(), data };
}

export const backupText = (backup) => JSON.stringify(backup, null, 1);
// اسم الملف بحروف لاتينية: Chromium يرفض الاسم العربي في التنزيل فيسمّيه «download»
export const backupFileName = (now = new Date()) => `quran-alsalaf-backup-${dayKey(now)}.json`;

/*
  قراءة ملف نسخة والتحقق منه. النتيجة واحدة من:
    { ok: true, backup }
    { ok: false, error: 'invalid' } — ليس ملف نسخة من هذا التطبيق، أو تالف
    { ok: false, error: 'newer' }   — من إصدار أحدث للتطبيق لا يعرف هذا شكله
  والمفاتيح التي لا يعرفها هذا الإصدار تُترك (لا تمنع الاستعادة).
*/
export function parseBackup(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!isObject(file) || file.app !== BACKUP_APP || !Number.isInteger(file.version) || file.version < 1 || !isObject(file.data)) {
    return { ok: false, error: 'invalid' };
  }
  if (file.version > BACKUP_VERSION) return { ok: false, error: 'newer' };
  const created = new Date(file.created);
  if (Number.isNaN(created.getTime())) return { ok: false, error: 'invalid' };
  const data = {};
  for (const [key, check] of Object.entries(BACKUP_KEYS)) {
    if (!(key in file.data)) continue;
    if (!check(file.data[key])) return { ok: false, error: 'invalid' };
    data[key] = file.data[key];
  }
  return { ok: true, backup: { app: BACKUP_APP, version: file.version, created: file.created, data } };
}

export const BACKUP_ERRORS = {
  invalid: 'تعذّرت قراءة الملف: ليس نسخة احتياطية من «قرآن السلف»، أو أنه تالف. لم يتغيّر شيء من بياناتك.',
  newer: 'هذه النسخة من إصدار أحدث للتطبيق. حدّث التطبيق ثم أعد المحاولة. لم يتغيّر شيء من بياناتك.',
};

const NOTES = { one: 'ملاحظة واحدة', two: ['ملاحظتان', 'ملاحظتين'], plural: 'ملاحظات', acc: 'ملاحظة' };
const BOOKMARKS = { one: 'علامة واحدة', two: ['علامتان', 'علامتين'], plural: 'علامات', acc: 'علامة' };
const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arabic = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);
// «لا ملاحظات» للصفر، وإلا العدد والمعدود مرفوعًا («ملاحظتان»، «٣ علامات»)
const amount = (n, forms) => (n === 0 ? `لا ${forms.plural}` : countText(n, forms, arabic, true));

// ملخّص ما في النسخة قبل تأكيد الاستعادة
export function summarizeBackup(backup) {
  const d = backup.data;
  const notes = Object.values(d['hq.notes'] ?? {}).filter((n) => (typeof n === 'string' ? n !== '' : n != null)).length;
  const bookmarks = (d['hq.bookmarks'] ?? []).filter(Boolean).length;
  const khatmas = (d['hq.khatmas'] ?? []).length;
  const riwayah = RIWAYAT.find((r) => r.id === d['hq.riwayah']);
  const dates = formatDates(dayKey(new Date(backup.created)));
  return {
    date: dates.gregorian,
    hijri: dates.hijri,
    riwayah: riwayah ? riwayah.full : null,
    counts: { notes, bookmarks, khatmas },
    lines: [amount(bookmarks, BOOKMARKS), amount(notes, NOTES), amount(khatmas, KHATMAS)],
  };
}

// الاستبدال الكامل: تُمحى المفاتيح المحفوظة كلها ثم يُكتب ما في النسخة. والصفحة تُعاد تحميلها بعده
// (في الواجهة) فيقرأ التطبيق كل شيء من جديد. النتيجة: نجح أم لا (التخزين غير متاح)
export function restoreBackup(backup) {
  const store = storage();
  if (!store) return false;
  try {
    for (const key of Object.keys(BACKUP_KEYS)) store.removeItem(key);
    for (const [key, value] of Object.entries(backup.data)) store.setItem(key, encode(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- آخر نسخة على هذا الجهاز ----------
export function readLastBackup() {
  const raw = storage()?.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  return Number.isNaN(new Date(raw).getTime()) ? null : raw;
}

export function markBackup(now = new Date()) {
  try {
    storage()?.setItem(LAST_BACKUP_KEY, now.toISOString());
  } catch {
    // التخزين غير متاح: لا يُعرف تاريخ آخر نسخة
  }
}

// «آخر نسخة: اليوم» · «أمس» · «قبل ٣ أيام» — أو «لم تحفظ نسخة بعد»
export function lastBackupText(iso = readLastBackup(), now = new Date()) {
  if (!iso) return 'لم تحفظ نسخة بعد';
  const n = Math.max(0, daysBetween(dayKey(new Date(iso)), dayKey(now)));
  if (n === 0) return 'آخر نسخة: اليوم';
  if (n === 1) return 'آخر نسخة: أمس';
  return `آخر نسخة: قبل ${countText(n, DAYS, arabic)}`;
}
