// شكل الصفحة (٢٠٢٦-١١-١٩): «بسيطة» كما كانت (الافتراضي)، أو «مزخرفة» بإطار حول كل صفحة من الجهات الأربع،
// يتلوّن بدرجات من لون التطبيق تلقائيًّا (بقرار صاحب المشروع: شكل واحد لكل الألوان) — src/components/PageFrame.jsx.
// يُختار من الإعدادات ← «المصحف»، ويسري في كل مكان تُعرض فيه الصفحة كاملة (المصحف، وورد الختمة، وختمة الحفظ،
// ووضع التسميع)، لا في وضع القراءة بالتمرير ولا في صفحات المحتوى.
import { useEffect, useState } from 'react';

const KEY = 'hq.pageStyle';
const EVENT = 'hq-page-style';

export const PAGE_STYLES = [
  { id: 'plain', name: 'بسيطة' },
  { id: 'framed', name: 'مزخرفة' },
];

// 'plain' | 'framed'
export function readPageStyle() {
  try {
    const s = localStorage.getItem(KEY);
    return PAGE_STYLES.some((x) => x.id === s) ? s : 'plain';
  } catch {
    return 'plain';
  }
}

export function setPageStyle(s) {
  if (!PAGE_STYLES.some((x) => x.id === s)) return;
  try {
    localStorage.setItem(KEY, s);
  } catch {
    // بلا تخزين: يسري في هذه الجلسة وحدها
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
}

// شكل الصفحة المختار، ويتبع تغييره من الإعدادات
export function usePageStyle() {
  const [s, setS] = useState(readPageStyle);
  useEffect(() => {
    const on = (e) => setS(e.detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return s;
}
