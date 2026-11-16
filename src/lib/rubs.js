// أرباع الأحزاب (٢٠٢٦-١١-١٣): ٦٠ حزبًا في كل حزب أربعة أرباع، وأول آية في كل ربع في quran.rubs
// (scripts/data/08-rubs.mjs). وفي نص المصحف علامة «۞» قبل أول كلمة في الربع، إلا ما بدأ بأول سورة
// فإطار اسمها هو العلامة.
//
// وأثمان ورش (٢٠٢٦-١١-١٦): مطبوع ورش مقسوم أثمانًا، ثمانية في كل حزب، وأول آية في كل ثمن في quran.athman
// (scripts/data/17-warsh-athman.mjs)، وفيه ۞ قبل أول كلمة في الثمن ولو في وسط آية، إلا ما بدأ بأول سورة.
// فـ«أقسام» المصحف (divisions) أثمانه إن كانت، وإلا أرباعه: بها الفهرس والتنبيه ووميض العلامة.
//
// التنبيه عند الوصول إلى صفحة فيها بداية قسم: رسالة قصيرة بنوعه، ووميض العلامة (أو إطار السورة)
// بلون التطبيق (MushafPage). ولا ترويسة للحزب ولا للربع (بقرار صاحب المشروع).
import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { readRubAlert } from './settings.js';

// نص التنبيه بحسب موضع الربع في حزبه (بطلب صاحب المشروع: هذه الأربع وحدها، بلا رقم الحزب)
export const RUB_MESSAGES = ['بداية الحزب', 'بداية ربع الحزب', 'بداية نصف الحزب', 'بداية ثلاثة أرباع الحزب'];
export const rubMessage = (i) => RUB_MESSAGES[i % 4];

export const hizbOf = (i) => Math.floor(i / 4) + 1;

// اسم الربع في فهرس الأرباع: «الحزب ٣» لأوله، ثم «ربع الحزب ٣» و«نصف …» و«ثلاثة أرباع …»
const PARTS = ['الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];
export const rubName = (i) => `${PARTS[i % 4]} ${toArabicDigits(hizbOf(i))}`;

// ---------- أقسام المصحف: أثمان ورش، أو أرباع حفص ----------
export const RUB = '۞';
const EMPTY = [];
export const divisions = (quran) => quran?.athman ?? quran?.rubs ?? EMPTY;
export const isAthman = (quran) => Array.isArray(quran?.athman);
export const perHizb = (quran) => (isAthman(quran) ? 8 : 4);

// الثمن في حزبه: الحزب، ثم أسماء الكسور بلا تكرار (في هامش المطبوع «ثمن» للأثمان الأربعة بين الأرباع)
const THUMN_PARTS = ['الحزب', 'ثمن الحزب', 'ربع الحزب', 'ثلاثة أثمان الحزب', 'نصف الحزب', 'خمسة أثمان الحزب', 'ثلاثة أرباع الحزب', 'سبعة أثمان الحزب'];
export const thumnName = (i) => `${THUMN_PARTS[i % 8]} ${toArabicDigits(Math.floor(i / 8) + 1)}`;
// نص التنبيه: رسائل الأرباع نفسها، و«بداية ثمن الحزب» للأثمان بينها (بلا رقم الحزب كالأرباع)
export const THUMN_MESSAGE = 'بداية ثمن الحزب';
export const thumnMessage = (i) => (i % 2 ? THUMN_MESSAGE : RUB_MESSAGES[(i % 8) / 2]);

export const divisionName = (quran, i) => (isAthman(quran) ? thumnName(i) : rubName(i));
export const divisionMessage = (quran, i) => (isAthman(quran) ? thumnMessage(i) : rubMessage(i));

const cache = new WeakMap();
// رقم القسم لكل آية يبدأ بها قسم (ربع، أو ثمن في ورش): آية → رقمه (من ٠)
export function rubStarts(quran) {
  let m = cache.get(quran);
  if (!m) {
    m = new Map(divisions(quran).map((v, i) => [v, i]));
    cache.set(quran, m);
  }
  return m;
}

// الأقسام التي تبدأ في الصفحة، بترتيبها
export function rubsOnPage(quran, page) {
  return divisions(quran).map((v, i) => (quran.verses[v].p === page ? i : -1)).filter((i) => i >= 0);
}

// أول كلمات القسم كما في فهارس المصاحف (بالرسم الإملائي). والثمن الذي يبدأ في وسط آية (ورش) من كلمته بعد ۞:
// كلمات النص الإملائي بعدد كلمات الآية قبل العلامة
export function rubOpening(quran, i, words = 4) {
  const verse = quran.verses[divisions(quran)[i]];
  const from = Math.max(0, verse.t.indexOf(RUB));
  return verse.e.split(/\s+/).slice(from, from + words).join(' ');
}

// رموز علامة القسم في سطر من أسطر الآيات (MushafPage): ترتيبها في glyphs.k. في حفص ۞ أول حرف في رمز أول كلمة
// في الربع، فهو أول رمز لآيته إن بدأت في السطر. وفي ورش ۞ رمز مستقل ولو في وسط آية: يُعرف بمقابلة كلمات السطر
// برموزه واحدًا بواحد، وإن لم تتقابل (كلمتان برمز واحد في السطر) فبقاعدة حفص (والثمن فيها أول آيته)
export function rubGlyphs(quran, line, glyphs) {
  const starts = rubStarts(quran);
  const out = new Set();
  if (!starts.size || !line.g) return out;
  const toks = line.g.flatMap(([v, from, to]) => Array.from({ length: to - from + 1 }, (_, k) => [v, from + k]));
  if (quran.riwayah === 'warsh' && toks.length === glyphs.k.length) {
    toks.forEach(([v, k], i) => starts.has(v) && quran.verses[v].t[k] === RUB && out.add(i));
    return out;
  }
  const beginsHere = new Set(line.g.filter(([, from]) => from === 0).map(([v]) => v));
  const seen = new Set();
  glyphs.k.forEach(([v], i) => {
    if (seen.has(v)) return;
    seen.add(v);
    if (starts.has(v) && beginsHere.has(v) && quran.verses[v].t[0] === RUB) out.add(i);
  });
  return out;
}

// أول آية في كل جزء من الثلاثين
export function juzStarts(quran) {
  const out = [];
  quran.verses.forEach((v, i) => {
    if (out.length < v.j) out.push(i);
  });
  return out;
}

// مهلة احتياطية لزوال الوميض إن لم يُرسم (كتعذّر خط الصفحة)
const FALLBACK_MS = 12000;

/*
  التنبيه عند الوصول إلى صفحة فيها بداية قسم (ربع، أو ثمن في ورش). pages: الصفحات الظاهرة الآن (صفحة أو صفحتان).
  يُنبَّه بما ظهر حديثًا منها فقط، لا بما كان ظاهرًا قبل (كتبديل العرض بين صفحة وصفحتين).
  ولا تنبيه عند أول ظهور بعد تعطيله (enabled = false، كأول فتح للتطبيق ووضع القراءة)، إلا أن يُطلب
  (initial، كصفحة الورد: فتحها انتقال إلى أول الورد). ولا تنبيه إن ألغاه المستخدم من الإعدادات
  (readRubAlert)، وما ظهر وهو ملغى لا يُنبَّه به إن فُعِّل بعدُ.
  يرجع { verses: [أول آية في كل قسم يومض]، n } أو null.
*/
export function useRubAlert({ quran, pages, enabled = true, initial = false, onToast }) {
  const [flash, setFlash] = useState(null);
  const prev = useRef(null);
  const key = pages.join(',');

  useEffect(() => {
    if (!quran || !enabled) {
      prev.current = null;
      return;
    }
    const before = prev.current ?? (initial ? [] : pages);
    prev.current = pages;
    if (!readRubAlert()) return;
    const fresh = pages.filter((p) => !before.includes(p));
    const found = fresh.flatMap((p) => rubsOnPage(quran, p));
    if (!found.length) return;
    onToast?.(divisionMessage(quran, found[0]));
    setFlash({ verses: found.map((i) => divisions(quran)[i]), n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quran, key, enabled]);

  // يزول بنهاية تلاشي الوميض (MushafPage.css)، وإلا بعد مهلة احتياطية
  useEffect(() => {
    if (!flash) return undefined;
    const end = () => setFlash((f) => (f === flash ? null : f));
    const onEnd = (e) => e.animationName.startsWith('rub-flash') && end();
    document.addEventListener('animationend', onEnd);
    const timer = setTimeout(end, FALLBACK_MS);
    return () => {
      document.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
    };
  }, [flash]);

  return flash;
}
