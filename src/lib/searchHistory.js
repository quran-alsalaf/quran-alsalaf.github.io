// سجل البحث الرئيسي (الفصل ٨، بطلب صاحب المشروع ٢٠٢٦-٠٩-٢٤): بدل نص إرشادي في صفحة البحث
// الفارغة، تُحفظ آخر عمليات البحث الناجحة (التي انتهت بنقلة إلى موضع)، فتُعرض قائمةً يُعاد
// بها البحث بضغطة واحدة.
const KEY = 'hq.searchHistory';
const MAX = 20;

export function readSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addSearchHistory(text) {
  const q = text.trim();
  if (!q) return;
  const list = [q, ...readSearchHistory().filter((x) => x !== q)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // التخزين غير متاح (تصفح خاص): يسري السجل في هذه الجلسة وحدها
  }
}

export function removeSearchHistory(text) {
  const list = readSearchHistory().filter((x) => x !== text);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // كالأعلى
  }
}
