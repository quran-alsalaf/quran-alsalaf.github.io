// التسميع بالكشف (٢٠٢٦-١١-١٦، «القائمة الثالثة» البند ٣): تُخفى كلمات آيات الصفحة وتبقى رؤوس الآيات
// (علامة نهاية كل آية برقمها)، ثم تُكشف بالترتيب من أول الصفحة: كلمتين كلمتين أو بقية الآية الجارية.
//
// حال الكشف: { رقم الصفحة: عدد الكلمات المكشوفة من أولها }. فالمكشوف دائمًا أول الصفحة متصلًا، وما بعده مخفي.
// و«الكلمة» رمز من خط الصفحة (src/lib/qcfFonts.js)، لا كلمة من نص الآية: الرمز هو ما يُرسم ويُخفى.
// ورؤوس الآيات ليست كلمات: لا تُعدّ ولا تُخفى أبدًا.
import { createBookmark, placeBookmark, readBookmarks } from './userdata.js';
import { hafsKey, hafsOf } from './verseMap.js';

// كلمات الصفحة بالترتيب: لكل كلمة رقم آيتها. وتُحسب مرة لكل صفحة من كل مصحف
const wordsCache = new WeakMap();
export function pageWords(quran, page) {
  let byPage = wordsCache.get(quran);
  if (!byPage) wordsCache.set(quran, (byPage = new Map()));
  let words = byPage.get(page);
  if (words) return words;
  words = [];
  const lines = quran.pages[page - 1] ?? [];
  const glyphs = quran.qcf.pages[page - 1] ?? [];
  lines.forEach((line, i) => {
    if (!line.g) return;
    for (const [v, , wi] of lineGlyphs(quran, line, glyphs[i])) if (wi != null) words.push(v);
  });
  byPage.set(page, words);
  return words;
}

// رموز سطر من أسطر الآيات: [آية، رمزها، ترتيب الكلمة في الصفحة أو null لرأس الآية]. ورأس الآية آخر رمز
// لآيته في السطر الذي تنتهي فيه (كما يرسمه MushafPage). ويُعطى أول ترتيب في السطر (start) ليُكمل العدّ عليه
export function lineGlyphs(quran, line, glyphs, start = 0) {
  const ends = new Set(line.g.filter(([v, , to]) => to === quran.verses[v].t.length - 1).map(([v]) => v));
  const last = new Map();
  glyphs.k.forEach(([v], i) => last.set(v, i));
  let n = start;
  return glyphs.k.map(([v, code], i) => [v, code, ends.has(v) && last.get(v) === i ? null : n++]);
}

const shownCount = (state, page) => state?.[page] ?? 0;

// التسميع على آيات معيّنة (ختمة الحفظ، ٢٠٢٦-١١-١٦: ورد اليوم والمراجعتان): scope مجموعة آياتها، فلا يُخفى
// ولا يُعدّ إلا كلماتها، وبقية آيات الصفحة ظاهرة كما هي. وبلا scope فالكلمات كلها (وضع التسميع العام)
export const scopedWords = (quran, page, scope) => {
  const words = pageWords(quran, page);
  return scope ? words.filter((v) => scope.has(v)) : words;
};

// الكشف التالي في الصفحات الظاهرة (صفحة، أو صفحتا الزوج يمنى ثم يسرى): في أول صفحة لم تُكشف كلها،
// من أول كلمة مخفية حتى max كلمة لا يتجاوز آيتها (Infinity: بقية الآية). والآية الممتدة إلى الصفحة
// التالية تنتهي هنا بآخر الصفحة. النتيجة: الحال الجديدة، أو null إن كانت الصفحات كلها مكشوفة
export function reveal(quran, pages, state, max, scope = null) {
  for (const p of pages) {
    const words = scopedWords(quran, p, scope);
    const n = shownCount(state, p);
    if (n >= words.length) continue;
    const v = words[n];
    let j = n;
    while (j < words.length && words[j] === v && j - n < max) j++;
    return { ...state, [p]: j };
  }
  return null;
}

// هل كُشفت كلمات الصفحات كلها (في نطاق scope)؟
export const allRevealed = (quran, pages, state, scope = null) =>
  pages.every((p) => shownCount(state, p) >= scopedWords(quran, p, scope).length);

// لمس كلمة مكشوفة (ترتيبها wi في صفحتها page): تُخفى هي وما بعدها في الصفحات الظاهرة. فإن كانت في
// اليمنى من الزوج أُخفيت اليسرى كلها معها. ولمس كلمة مخفية لا يغيّر شيئًا (النتيجة null)
export function hideFrom(state, pages, page, wi) {
  if (wi >= shownCount(state, page)) return null;
  const next = { ...state, [page]: wi };
  for (const p of pages) if (p > page) next[p] = 0;
  return next;
}

// آيات الصفحات الظاهرة التي كُشف منها شيء، الأحدث كشفًا أولًا (الآية الجارية ثم ما قبلها)
export function revealedVerses(quran, pages, state, scope = null) {
  const seen = [];
  for (const p of pages) {
    const words = scopedWords(quran, p, scope).slice(0, shownCount(state, p));
    for (const v of words) if (seen.at(-1) !== v) seen.push(v);
  }
  return [...new Set(seen.reverse())];
}

// ---------- علامة «أخطائي» ----------
export const MISTAKES_NAME = 'أخطائي';
export const mistakesBookmark = (list = readBookmarks()) => list.find((b) => b.name === MISTAKES_NAME) ?? null;

// أهي آية المصحف المعروض v في «أخطائي»؟ (العلامات بترقيم حفص، فتُقابل في ورش بآيات حفص المقابلة)
export function inMistakes(quran, v, list = readBookmarks()) {
  const b = mistakesBookmark(list);
  if (!b) return false;
  const keys = new Set(hafsOf(quran, v));
  return b.verses.some((x) => keys.has(x.v));
}

// تسجيل الآية في «أخطائي»، وتُنشأ العلامة (متعددة) إن لم تكن. النتيجة: 'added' | 'already'
export function addMistake(quran, v) {
  const list = readBookmarks();
  if (inMistakes(quran, v, list)) return 'already';
  const b = mistakesBookmark(list);
  if (b) {
    // كانت متنقّلة (أنشأها المستخدم بيده بهذا الاسم): تبقى كما هي، فتنتقل إلى الآية
    placeBookmark(b.id, hafsKey(quran, v));
  } else createBookmark({ name: MISTAKES_NAME, multi: true }, hafsKey(quran, v));
  return 'added';
}
