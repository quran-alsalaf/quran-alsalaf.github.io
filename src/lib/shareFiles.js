// مشاركة صور المحتوى وحفظها (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١).
//   • المشاركة: قائمة مشاركة الجهاز بالصور ومعها سطر «من تطبيق قرآن السلف» ورابطه (يظهر تحتها في واتساب
//     وتليجرام). داخل التطبيق بقائمة أندرويد (@capacitor/share)، وفي الموقع بمشاركة المتصفح إن أتاحت الصور؛
//     وحيث لا مشاركة (أكثر الحواسيب) تُنزَّل الصور ملفات.
//   • الحفظ: داخل التطبيق في معرض الجوال (مجلد «قرآن السلف» في الصور) بإضافة QuranGallery
//     (android/app/src/main/java/com/quranalsalaf/app/gallery/QuranGalleryPlugin.java)، وفي الموقع تنزيلًا.
import { registerPlugin } from '@capacitor/core';
import { isCancel, isNative } from './native.js';

let plugin = null;
const P = () => (plugin ??= registerPlugin('QuranGallery'));

// أسماء الملفات: quran-alsalaf-الآية-١.png …
export const imageNames = (base, n) => Array.from({ length: n }, (_, i) => `${base}${n > 1 ? `-${i + 1}` : ''}.png`);

function blobBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// تنزيل الصور ملفات (الموقع)
function download(blobs, names) {
  blobs.forEach((b, i) => {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = names[i];
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

// المشاركة ⇐ 'shared' · 'cancelled' (أُغلقت القائمة بلا اختيار) · 'downloaded' (لا مشاركة: نُزّلت) · 'failed'
export async function shareImages(blobs, names, text) {
  if (isNative()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
      const files = [];
      for (let i = 0; i < blobs.length; i++) {
        const { uri } = await Filesystem.writeFile({
          path: `share/${names[i]}`,
          data: await blobBase64(blobs[i]),
          directory: Directory.Cache,
          recursive: true,
        });
        files.push(uri);
      }
      await Share.share({ files, text });
      return 'shared';
    } catch (err) {
      return isCancel(err) ? 'cancelled' : 'failed';
    }
  }
  const files = blobs.map((b, i) => new File([b], names[i], { type: 'image/png' }));
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // رُفضت لسبب آخر: تُنزَّل بدلها
    }
  }
  try {
    download(blobs, names);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

// الحفظ ⇐ 'saved' (في معرض الجوال) · 'downloaded' (الموقع) · 'denied' (رُفض إذن الحفظ) · 'failed'
export async function saveImages(blobs, names) {
  if (isNative()) {
    try {
      const images = [];
      for (let i = 0; i < blobs.length; i++) images.push({ name: names[i], data: await blobBase64(blobs[i]) });
      const { result } = await P().save({ images });
      return result === 'denied' ? 'denied' : 'saved';
    } catch {
      return 'failed';
    }
  }
  try {
    download(blobs, names);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

// رسائل النتائج
export const SHARE_MESSAGES = {
  downloaded: 'نُزّلت الصور',
  failed: 'تعذّرت المشاركة',
};
export const SAVE_MESSAGES = {
  saved: 'حُفظت الصور في معرض الجوال',
  downloaded: 'نُزّلت الصور',
  denied: 'لم يُسمح للتطبيق بحفظ الصور',
  failed: 'تعذّر حفظ الصور',
};
