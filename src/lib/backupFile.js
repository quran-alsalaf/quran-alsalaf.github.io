// تسليم ملف النسخة الاحتياطية للجهاز (٢٠٢٦-١١-١٦) — الجزء الوحيد من النسخة الاحتياطية الخاص بالمتصفح.
// وفي التطبيق الأصلي (Capacitor، ٢٠٢٦-١١-١٨) يُكتب الملف في ذاكرة التطبيق ثم يُشارك بقائمة أندرويد
// (src/lib/native.js ← shareFile)، فالـ WebView لا يتيح navigator.share ولا تنزيل الملفات؛ ويبقى تجهيز
// المحتوى (src/lib/backup.js) كما هو. أما اختيار الملف عند الاستعادة فبحقل ملف عادي
// في الواجهة (SettingsSheet)، ويعمل في الاثنين.
import { isNative, shareFile } from './native.js';

// أجهزة اللمس (الجوال واللوحي): المشاركة بقائمة الجهاز (واتساب، الملفات…). وفي اللابتوب تنزيل مباشر،
// ولو أتاح المتصفح المشاركة
const touchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/*
  يسلّم النص ملفًّا باسم name. النتيجة:
    'shared'     — شاركه المستخدم من قائمة المشاركة
    'cancelled'  — أغلق قائمة المشاركة بلا اختيار (لا تُعدّ نسخة)
    'downloaded' — نُزِّل الملف
*/
export async function deliverBackup(text, name) {
  if (isNative()) return shareFile(text, name);
  const type = 'application/json';
  if (touchDevice() && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([text], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
        // رُفضت المشاركة لسبب آخر: يُنزَّل الملف بدلها
      }
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
