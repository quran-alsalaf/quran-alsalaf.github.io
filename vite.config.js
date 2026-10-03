import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// عند النشر على GitHub Pages يصير الرابط username.github.io/repo-name
// فيلزم أن يعرف التطبيق أنه يقع داخل مجلد فرعي. يُضبط وقت البناء
// بمتغيّر البيئة VITE_BASE، ويبقى "/" أثناء التطوير المحلي.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon-64.png',
        'fonts/uthmanic_hafs_v20.ttf',
      ],
      manifest: {
        name: 'قرآن السلف',
        short_name: 'قرآن السلف',
        description:
          'إنشاء: سامي أبصار الإسلام',
        lang: 'ar',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // خلفية الشاشة التي يعرضها النظام لحظة الإقلاع — كحلية لتتصل
        // بأيقونة التطبيق وبشاشة الافتتاح بلا وميض أبيض بينها
        background_color: '#1A0165',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // المواصفة تنصّ على تحميل كامل عند أول فتح ثم عمل تام بلا إنترنت،
        // فتُخزَّن كل أصول التطبيق مسبقًا. حدُّ الحجم مرفوع لأجل ملفات
        // بيانات المصحف والتفسير التي تُضاف في المرحلة الثانية.
        globPatterns: ['**/*.{js,css,html,woff2,ttf,png,svg,json,mp4}'],
        // خطوط الصفحات الـ٦٠٤ (نحو ٤٨ ميغابايت) لا تُنزَّل كلها عند التثبيت:
        // تُنزَّل كل صفحة عند أول فتح لها وتُحفظ (أدناه)، فتعمل بعدها بلا إنترنت
        globIgnores: ['fonts/qcf4/**'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/fonts\/qcf4\/p\d+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'qcf4-pages',
              expiration: { maxEntries: 650 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // الصوت لا يمرّ بعامل الخدمة أصلًا: يُبثّ من الشبكة مباشرة ولا يُخزَّن (الفصل ٦ من
          // المواصفة)، فيتولّى المتصفح طلبات القفز داخل ملف السورة بنفسه
        ],
      },
    }),
  ],
});
