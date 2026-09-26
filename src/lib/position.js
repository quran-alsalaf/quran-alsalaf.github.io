// آخر موضع قراءة — يُحفظ على الجهاز فقط، بلا حساب ولا خادم (الفصل ١).
// يُستعاد عند كل فتح بعد شاشة الافتتاح مباشرة (الفصل ١١).

const KEY = 'hq.page';

export const FIRST_PAGE = 1;
export const LAST_PAGE = 604;

export function readLastPage() {
  try {
    const n = parseInt(localStorage.getItem(KEY), 10);
    if (n >= FIRST_PAGE && n <= LAST_PAGE) return n;
  } catch {
    // قد يمنع المتصفح التخزين في وضع التصفح الخاص — يُبدأ من الصفحة الأولى
  }
  return FIRST_PAGE;
}

export function saveLastPage(page) {
  try {
    localStorage.setItem(KEY, String(page));
  } catch {
    // يبقى الموضع صحيحًا في هذه الجلسة ولو تعذّر حفظه
  }
}
