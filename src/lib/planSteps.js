/*
  خطوات نموذج إنشاء الختمة (تنسيق تبويب الختمة، الجزء ٢، ٢٠٢٦-١١-٢٠ بقرار صاحب المشروع):
  سؤال في كل شاشة، و«التالي» و«رجوع»، وفي آخره ملخص كل سطر فيه يفتح خطوته. و«تعديل الخطة» شاشة واحدة كما كان.
  • خطوة «نوع الختمة» لا تكون إلا بلا ختمة (ومع ختمة قائمة يُعرف النوع: من كل نوع واحدة).
  • خطوة «التذكير» داخل تطبيق أندرويد وحده (في الموقع لا تذكير).
  • من الملخص: الخطوة تعود إليه، إلا خطوة غيّرت ما بعدها (reset) فبعدها تلك الخطوة ثم الملخص: «الاتجاه» يعيد
    البداية والنهاية، و«طريقة التحديد» تعيد العدد.
*/

export const WIRD_STEPS = ['type', 'mode', 'count', 'reminder', 'summary'];
export const HIFZ_STEPS = ['type', 'dir', 'range', 'lines', 'near', 'far', 'reminder', 'summary'];

// خطوات نوع من الختمة بحسب ما يظهر منها
export function planSteps(kind, { withType = true, withReminder = true } = {}) {
  const all = kind === 'hifz' ? HIFZ_STEPS : WIRD_STEPS;
  return all.filter((s) => (s !== 'type' || withType) && (s !== 'reminder' || withReminder));
}

// بعد «التالي» (أو «العودة إلى الملخص»): الخطوة التالية، وهل ما زال الرجوع إلى الملخص
export function nextStep(steps, id, { fromSummary = false, reset = false } = {}) {
  const i = steps.indexOf(id);
  const after = steps[Math.min(i + 1, steps.length - 1)];
  if (fromSummary) return reset && after !== 'summary' ? { step: after, fromSummary: true } : { step: 'summary', fromSummary: false };
  return { step: after, fromSummary: false };
}

// «رجوع»: الخطوة السابقة، أو null في الأولى (إلغاء الإنشاء)
export function prevStep(steps, id) {
  const i = steps.indexOf(id);
  return i > 0 ? steps[i - 1] : null;
}

// زرّ الخطوة: «التالي»، أو «العودة إلى الملخص» لمن جاء منه (إلا خطوة غيّرت ما بعدها)
export function nextLabel(steps, id, opts = {}) {
  return nextStep(steps, id, opts).step === 'summary' && opts.fromSummary ? 'العودة إلى الملخص' : 'التالي';
}
