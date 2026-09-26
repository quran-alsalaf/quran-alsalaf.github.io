// خطوط صفحات المجمع (الإصدار الرابع): لكل صفحة خطّها، وكل كلمة فيه رمز واحد مرسوم
// بيد الخطّاط. تُنزَّل الصفحة عند أول فتح لها ويحفظها عامل الخدمة، فتعمل بعدها بلا إنترنت.
// ولا تُنزَّل الـ٦٠٤ كلها عند التثبيت (نحو ٤٨ ميغابايت).
import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL;
const loading = new Map(); // صفحة → وعد التحميل
const ready = new Set();
let styleEl = null;

export const pageFontClass = (page) => `qp-${page}`;

// ألوان الخط: لوحتاه الأحاديتان المضمّنتان فيه كما هما (٣ للنهار، ٤ لليل)، ولا يبقى
// فيهما ملوّنًا إلا زخرفة علامة الآية. والموضع ١٤ يرسم مربعات صغيرة حول بعض العلامات
// في أواخر الكلمات فيُخفى. ولا يُفرض لون واحد على كل المواضع: فالموضع ١٢ تعبئة دائرة
// الآية، فيطمس رقمها.
function addRules(page) {
  styleEl ??= document.head.appendChild(document.createElement('style'));
  const family = `QCF4P${page}`;
  styleEl.append(`
@font-palette-values --qcf${page}l { font-family: '${family}'; base-palette: 3; override-colors: 14 transparent; }
@font-palette-values --qcf${page}d { font-family: '${family}'; base-palette: 4; override-colors: 14 transparent; }
.qp-${page} { font-family: '${family}'; font-palette: --qcf${page}l; }
:root[data-theme='dark'] .qp-${page} { font-palette: --qcf${page}d; }
`);
}

export function loadPageFont(page) {
  let pending = loading.get(page);
  if (!pending) {
    const face = new FontFace(`QCF4P${page}`, `url(${BASE}fonts/qcf4/p${page}.woff2)`, { display: 'block' });
    pending = face
      .load()
      .then(() => {
        document.fonts.add(face);
        addRules(page);
        ready.add(page);
      })
      .catch((err) => {
        loading.delete(page); // تُتاح إعادة المحاولة عند عودة الاتصال
        throw err;
      });
    loading.set(page, pending);
  }
  return pending;
}

// تنزيل مسبق لخطوط الصفحات المجاورة، ليكون القلب إليها فوريًّا
export function prefetchPageFonts(pages) {
  for (const p of pages) if (p >= 1 && p <= 604 && !ready.has(p)) loadPageFont(p).catch(() => {});
}

// حال خط الصفحة: 'ready' | 'loading' | 'failed' (لا اتصال والصفحة لم تُنزَّل من قبل).
// وإن فشل أُعيدت المحاولة تلقائيًّا متى عاد الاتصال.
export function usePageFont(page) {
  const [state, setState] = useState(() => (ready.has(page) ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready.has(page)) {
      setState('ready');
      return undefined;
    }
    let alive = true;
    setState('loading');
    loadPageFont(page).then(
      () => alive && setState('ready'),
      () => alive && setState('failed')
    );
    return () => {
      alive = false;
    };
  }, [page, attempt]);

  useEffect(() => {
    if (state !== 'failed') return undefined;
    const retry = () => setAttempt((a) => a + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [state]);

  return state;
}
