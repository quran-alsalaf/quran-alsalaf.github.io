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

// نموذج الزخرفة (مؤقت حتى يختار صاحب المشروع واحدًا من الأربعة، src/components/PageFrame.jsx)
const DESIGN_KEY = 'hq.frameDesign';
const DESIGN_EVENT = 'hq-frame-design';
export const FRAME_DESIGN_IDS = ['a', 'b', 'c', 'd'];

export function readFrameDesign() {
  try {
    const d = localStorage.getItem(DESIGN_KEY);
    return FRAME_DESIGN_IDS.includes(d) ? d : 'b';
  } catch {
    return 'b';
  }
}

export function setFrameDesign(d) {
  if (!FRAME_DESIGN_IDS.includes(d)) return;
  try {
    localStorage.setItem(DESIGN_KEY, d);
  } catch {
    // بلا تخزين: يسري في هذه الجلسة وحدها
  }
  window.dispatchEvent(new CustomEvent(DESIGN_EVENT, { detail: d }));
}

export function useFrameDesign() {
  const [d, setD] = useState(readFrameDesign);
  useEffect(() => {
    const on = (e) => setD(e.detail);
    window.addEventListener(DESIGN_EVENT, on);
    return () => window.removeEventListener(DESIGN_EVENT, on);
  }, []);
  return d;
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
