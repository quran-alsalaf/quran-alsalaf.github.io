// إعدادات المستخدم التي تُحفظ على جهازه وتبقى بين الفتحات.
// (صفحة الإعدادات نفسها في القائمة الجانبية — المرحلة السابعة؛ هذا أساسها.)

const WEEKS_KEY = 'hq.weeks';

// تمييز مقررات الأسابيع في المصحف بالتناوب: ملغى افتراضيًّا، ويُفعّله المستخدم من الإعدادات
// (بقرار صاحب المشروع). يُطبَّق سمةً على الجذر (data-weeks)، فيظهر اللون أو يختفي فورًا
// بلا إعادة رسم للصفحات.
export function readWeeksTint() {
  try {
    return localStorage.getItem(WEEKS_KEY) === 'on';
  } catch {
    return false;
  }
}

export function applyWeeksTint(on = readWeeksTint()) {
  document.documentElement.setAttribute('data-weeks', on ? 'on' : 'off');
}

export function setWeeksTint(on) {
  try {
    localStorage.setItem(WEEKS_KEY, on ? 'on' : 'off');
  } catch {
    // التخزين غير متاح (تصفح خاص): يسري الاختيار في هذه الجلسة وحدها
  }
  applyWeeksTint(on);
}

// حجم خط عناصر الواجهة: خط واحد ثابت لا يتحكم به المستخدم (بقرار صاحب المشروع ٢٠٢٦-٠٩-٢٥،
// يُلغي ميزة اختيار الحجم). --ui-scale يبقى ثابتًا على ١ في src/styles/tokens.css.

// ---------- الدليل التعريفي (الفصل ١١): يظهر تلقائيًّا في أول فتحتين فقط ----------
const ONBOARDING_KEY = 'hq.onboardingSeen';

export function shouldAutoShowOnboarding() {
  try {
    const seen = parseInt(localStorage.getItem(ONBOARDING_KEY) || '0', 10);
    return seen < 2;
  } catch {
    return false;
  }
}

export function markOnboardingSeen() {
  try {
    const seen = parseInt(localStorage.getItem(ONBOARDING_KEY) || '0', 10);
    localStorage.setItem(ONBOARDING_KEY, String(seen + 1));
  } catch {
    // لا يلزم أكثر من عدم الإزعاج المتكرر؛ يُتجاهل إن تعذّر الحفظ
  }
}
