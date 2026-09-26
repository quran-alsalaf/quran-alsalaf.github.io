// إدارة وضع العرض. حالتان لا ثالثة لهما: 'light' و'dark'.
//
// إعداد نظام الجهاز يُستشار مرة واحدة فقط — عند أول فتحة للتطبيق على
// الإطلاق — ثم يُحفظ الناتج فيصير اختيارًا مثبتًا. وبعدها لا يتغير الوضع
// إلا بيد المستخدم، ولو بدّل نظام جهازه بين الفاتح والداكن.
//
// وأول تطبيق للوضع يقع في سكربت داخل index.html قبل رسم الصفحة، منعًا
// للومضة. وما هنا يخدم حالة React والتبديل اليدوي.

const KEY = 'hq.theme';
export const THEMES = ['light', 'dark'];

// نسخة في الذاكرة تصون عمل التبديل في الجلسة إن منع المتصفح التخزين
// (كالتصفح الخاص)، فلا يرتدّ الوضع إلى سابقه عند كل تبديل
let current = null;

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readTheme() {
  if (current) return current;

  // السكربت في index.html أثبت الوضع على الجذر قبل الرسم، فهو المرجع الأول
  const fromDom = document.documentElement.getAttribute('data-theme');
  if (THEMES.includes(fromDom)) {
    current = fromDom;
    return current;
  }

  try {
    const stored = localStorage.getItem(KEY);
    if (THEMES.includes(stored)) {
      current = stored;
      return current;
    }
  } catch {
    // يُتجاهل، ويُلجأ إلى إعداد النظام أدناه
  }

  current = systemTheme();
  return current;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeColor();
}

export function saveTheme(theme) {
  if (!THEMES.includes(theme)) return;
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // يبقى الاختيار فعّالًا لهذه الجلسة ولو تعذّر الحفظ
  }
  applyTheme(theme);
}

export function toggleTheme() {
  const next = readTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  return next;
}

// يُلوّن شريط حالة الجهاز بلون خلفية التطبيق ليبدو متصلًا به لا مقطوعًا عنه
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  if (bg) meta.content = bg;
}

export function initTheme() {
  applyTheme(readTheme());
  // لا يُنصَت لتغيّر إعداد النظام بعد اليوم: استشارته وقعت مرة واحدة
  // عند أول فتحة، واختيار المستخدم بعدها هو المعتمد.
}
