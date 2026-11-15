// خطوط صفحات المجمع (الإصدار الرابع): لكل صفحة خطّها، وكل كلمة فيه رمز واحد مرسوم
// بيد الخطّاط. تُنزَّل الصفحة عند أول فتح لها ويحفظها عامل الخدمة، فتعمل بعدها بلا إنترنت.
// ولا تُنزَّل الـ٦٠٤ كلها عند التثبيت (نحو ٤٨ ميغابايت).
//
// ولمصحف ورش (٢٠٢٦-١١-١٥) خطوط صفحاته (public/fonts/qcf4-warsh، تبنيها scripts/data/12-warsh.mjs)، بالطريقة
// نفسها. فكل دالة هنا تأخذ الرواية (quran.riwayah: 'warsh'، أو لا شيء لحفص)، ولكل رواية أسماء خطوطها وأصنافها.
// وخطوط ورش بلون واحد (بلا طبقات ألوان)، فتأخذ لون نص المصحف من الواجهة نفسها (color)، بلا قواعد ألوان هنا.
import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL;
const loading = new Map(); // «رواية:صفحة» → وعد التحميل
const ready = new Set(); // «رواية:صفحة»
const readyHafs = new Set(); // صفحات حفص المحمّلة (لقواعد ألوانها)
let styleEl = null;
let warshStyleEl = null;

const WARSH = 'warsh';
const keyOf = (page, r) => `${r === WARSH ? WARSH : 'hafs'}:${page}`;
export const pageFontClass = (page, r) => (r === WARSH ? `qw-${page}` : `qp-${page}`);
const familyOf = (page, r) => (r === WARSH ? `QCF4W${page}` : `QCF4P${page}`);
const urlOf = (page, r) => (r === WARSH ? `${BASE}fonts/qcf4-warsh/p${page}.woff2` : `${BASE}fonts/qcf4/p${page}.woff2`);

// ألوان الخط (٢٠٢٦-١١-١١): ألوانه مدمجة فيه (طبقات COLR بلوحات ثابتة: أسود للنهار وأبيض لليل)،
// فلا يؤثر فيه لون النص من الواجهة. فتُستبدل خانات لوحته كلها بـoverride-colors من اختيار المستخدم
// (تُحسب في سكربت index.html من src/data/appearance.json):
//   ٠–٩ و١٥  طبقات الكلمات                      ← لون نص المصحف
//   ١٣       رقم الآية وإطار العلامة الرفيع       ← لون نص المصحف (هما طبقة واحدة في الخط)
//   ١١       تاجا العلامة أعلاها وأسفلها          ← لون التطبيق (اللون الأساسي للزخرفة)
//   ١٢       تعبئة العلامة خلف الرقم              ← درجة من لون التطبيق ممزوجة بالخلفية
//   ١٠       نقطة صغيرة أعلى العلامة             ← درجة أغمق من لون التطبيق
//   ١٤       مربعات صغيرة حول بعض العلامات        ← تُخفى
// ولا تقبل override-colors متغيرات CSS، فتُكتب القواعد بالألوان نفسها وتُعاد كتابتها عند تغيير المظهر.
const TEXT_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 15];

function rulesFor(page, c) {
  const family = `QCF4P${page}`;
  const slots = [
    ...TEXT_SLOTS.map((i) => `${i} ${c.ink}`),
    `10 ${c.dot}`,
    `11 ${c.ornament}`,
    `12 ${c.fill}`,
    '14 transparent',
  ].join(', ');
  // لوحة ثانية كلها بلون التطبيق: تُلوَّن بها علامة الربع ۞ الأصلية عند الوصول إلى صفحتها (MushafPage)
  const accent = Array.from({ length: 16 }, (_, i) => `${i} ${c.ornament}`).join(', ');
  return `@font-palette-values --qcf${page} { font-family: '${family}'; override-colors: ${slots}; }
@font-palette-values --qcf${page}a { font-family: '${family}'; override-colors: ${accent}; }
.qp-${page} { font-family: '${family}'; font-palette: --qcf${page}; }
.qp-${page} .w__rub--flash { font-palette: --qcf${page}a; }
`;
}

function writeRules() {
  const c = window.hqAppearance?.current?.colors;
  if (!c) return;
  styleEl ??= document.head.appendChild(document.createElement('style'));
  styleEl.textContent = [...readyHafs].map((p) => rulesFor(p, c)).join('');
}

// تغيير الخلفية أو اللون من الإعدادات: تُعاد كتابة ألوان كل الصفحات المحمّلة
window.addEventListener('hq:appearance', writeRules);

// خطوط ورش: صنف كل صفحة باسم خطها وحده
function addWarshRule(page) {
  warshStyleEl ??= document.head.appendChild(document.createElement('style'));
  warshStyleEl.textContent += `.qw-${page} { font-family: '${familyOf(page, WARSH)}'; }\n`;
}

export function loadPageFont(page, r) {
  const key = keyOf(page, r);
  let pending = loading.get(key);
  if (!pending) {
    const face = new FontFace(familyOf(page, r), `url(${urlOf(page, r)})`, { display: 'block' });
    pending = face
      .load()
      .then(() => {
        document.fonts.add(face);
        ready.add(key);
        if (r === WARSH) addWarshRule(page);
        else {
          readyHafs.add(page);
          writeRules();
        }
      })
      .catch((err) => {
        loading.delete(key); // تُتاح إعادة المحاولة عند عودة الاتصال
        throw err;
      });
    loading.set(key, pending);
  }
  return pending;
}

// تنزيل مسبق لخطوط الصفحات المجاورة، ليكون القلب إليها فوريًّا
export function prefetchPageFonts(pages, r) {
  for (const p of pages) if (p >= 1 && p <= 604 && !ready.has(keyOf(p, r))) loadPageFont(p, r).catch(() => {});
}

// حال خط الصفحة: 'ready' | 'loading' | 'failed' (لا اتصال والصفحة لم تُنزَّل من قبل).
// وإن فشل أُعيدت المحاولة تلقائيًّا متى عاد الاتصال.
export function usePageFont(page, r) {
  const key = keyOf(page, r);
  const [state, setState] = useState(() => (ready.has(key) ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready.has(key)) {
      setState('ready');
      return undefined;
    }
    let alive = true;
    setState('loading');
    loadPageFont(page, r).then(
      () => alive && setState('ready'),
      () => alive && setState('failed')
    );
    return () => {
      alive = false;
    };
  }, [key, attempt]);

  useEffect(() => {
    if (state !== 'failed') return undefined;
    const retry = () => setAttempt((a) => a + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [state]);

  return state;
}
