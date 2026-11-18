// يجهّز ملفات الويب لتطبيق أندرويد (Capacitor، ٢٠٢٦-١١-١٨): نسخة من البناء (dist) في native-web، وهو
// المجلد الذي ينسخه «npx cap sync» داخل التطبيق (capacitor.config.json ← webDir). يعمل بعد «vite build»:
//   npm run android   (البناء، ثم هذا السكربت، ثم المزامنة مع مشروع أندرويد)
//
// ما يُحذف من النسخة، ولا يمسّ الموقع شيئًا:
//   • عامل الخدمة وملفاته وتسجيله (sw.js، workbox-*، registerSW.js، sw-recover.js، الـ manifest): ملفات
//     التطبيق كلها داخله من أول تثبيت، فلا حاجة إلى ذاكرة عامل الخدمة، وهو لا يعمل في Capacitor أصلًا
//   • التفاسير التي تُحمَّل بزرّ (data/tafsir، نحو ٥٦ ميغا): تبقى بالتحميل كما في الموقع، ويُحمِّلها التطبيق من
//     الموقع المنشور (src/lib/tafsirDownload.js ← SITE_URL)، فلا يكبر حجم التطبيق بها
//   • صفحة المعاينة الداخلية (preview): أداة لصاحب المشروع لا جزء من التطبيق
import { cp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// هل يُنسخ هذا المسار (نسبيًّا إلى dist، بشرطة مائلة أمامية)؟
export function keepInNative(rel) {
  const p = rel.replace(/\\/g, '/');
  if (p === 'sw.js' || p === 'registerSW.js' || p === 'sw-recover.js' || p === 'manifest.webmanifest') return false;
  if (/^workbox-[^/]*\.js$/.test(p)) return false;
  if (p === 'preview' || p.startsWith('preview/')) return false;
  if (p === 'data/tafsir' || p.startsWith('data/tafsir/')) return false;
  return true;
}

// صفحة التطبيق بلا تسجيل عامل الخدمة ولا رابط الـ manifest
export function nativeIndexHtml(html) {
  return html
    .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
    .replace(/<link rel="manifest"[^>]*>/, '');
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const SRC = `${root}dist`;
  const OUT = `${root}native-web`;
  await readdir(SRC).catch(() => {
    throw new Error('لا يوجد بناء: شغّل «npm run build» أولًا');
  });
  await rm(OUT, { recursive: true, force: true });
  await cp(SRC, OUT, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(SRC.length).replace(/^[\\/]/, '');
      return rel === '' || keepInNative(rel);
    },
  });
  const index = `${OUT}/index.html`;
  await writeFile(index, nativeIndexHtml(await readFile(index, 'utf8')));
  console.log('✓ ملفات التطبيق جاهزة في native-web');
}

if (import.meta.url.startsWith('file:') && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
