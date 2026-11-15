// مصادر التفسير بترتيب قائمة الاختيار. name: في زرّ الاختيار، title: اسم الكتاب أسفل التفسير وفي النسخ.
//   • بلا bytes: مبني مع التطبيق (public/data/tafsir-{id}.json)، يحفظه عامل الخدمة مسبقًا فيعمل بلا إنترنت.
//   • بـbytes (٢٠٢٦-١١-١٥): يُحمَّل بزرّ في قائمة التفاسير، ولا يُختار قبل اكتمال تحميله
//     (src/lib/tafsirDownload.js). ملفاته: public/data/tafsir/{id}/{السورة}.json، وbytes مجموع أحجامها
//     (يكتبه سكربت التفسير في scripts/data، ويطابقه tests/unit/tafsir-download.test.js).
// shared: نص يظهر عند آية لم يُفرد لها المفسّر كلامًا (يفسّر الآيات مجموعاتٍ).
export const TAFSIR_SOURCES = [
  { id: 'muyassar', name: 'الميسّر', title: 'التفسير الميسّر' },
  { id: 'mukhtasar', name: 'المختصر', title: 'المختصر في تفسير القرآن الكريم' },
  {
    id: 'saadi',
    name: 'السعدي',
    title: 'تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)',
    bytes: 6153337,
    shared: 'لم يُفرد السعدي لهذه الآية كلامًا، وتفسيرها داخل في كلامه على الآيات التي حولها.',
  },
  {
    id: 'baghawy',
    name: 'البغوي',
    title: 'معالم التنزيل في تفسير القرآن (تفسير البغوي)',
    bytes: 7489513,
    shared: 'لم يُفرد البغوي لهذه الآية كلامًا، وتفسيرها داخل في كلامه على الآيات التي حولها.',
  },
];

export const tafsirInfo = (id) => TAFSIR_SOURCES.find((s) => s.id === id);
// هل يُحمَّل بزرّ؟
export const isDownloadable = (id) => !!tafsirInfo(id)?.bytes;
