// المواصفة تنصّ على قفل الشاشة الرأسية دائمًا (الفصل ٢).
//
// ما يمكن ضمانه وما لا يمكن:
//  • عند تثبيت التطبيق على أندرويد، يفرض بيان التطبيق (orientation: portrait)
//    القفل فرضًا حقيقيًا — وهذا الطريق الموثوق.
//  • داخل المتصفح العادي لا يملك الويب فرض القفل إلا في وضع ملء الشاشة،
//    ويرفض iOS الواجهة أصلًا. فتُجرَّب المحاولة، وإن فشلت تتكفّل طبقة
//    .orientation-guard في global.css بعرض تنبيه مؤدَّب بدل تشويه التخطيط.

export function lockPortrait() {
  const orientation = window.screen?.orientation;
  if (!orientation?.lock) return false;

  try {
    const result = orientation.lock('portrait');
    // ترجع وعدًا يُرفض حين لا يُسمح بالقفل — يُبتلع الرفض بهدوء
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}
