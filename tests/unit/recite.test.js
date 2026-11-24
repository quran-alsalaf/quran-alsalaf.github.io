// التسميع بالكشف (٢٠٢٦-١١-١٦): كلمات الصفحة ورؤوس آياتها، والكشف كلمةً كلمةً (أو كلمتين) أو بقية الآية، والإخفاء من
// كلمة ملموسة، وآيات «أخطائي» وتسجيلها — src/lib/recite.js
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MISTAKES_NAME,
  addMistake,
  hideFrom,
  inMistakes,
  lineGlyphs,
  mistakesBookmark,
  pageWords,
  reveal,
  revealedVerses,
} from '../../src/lib/recite.js';
import { createBookmark, readBookmarks } from '../../src/lib/userdata.js';
import { hafsOf } from '../../src/lib/verseMap.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const H = { ...load('quran'), qcf: load('qcf4') };
const W = load('warsh/quran');
const h = (s, a) => H.verses.findIndex((v) => v.s === s && v.a === a);

// عدد رموز الصفحة كلها، ورؤوس الآيات فيها (الآيات المنتهية فيها)
const glyphCount = (q, p) => q.qcf.pages[p - 1].reduce((n, l) => n + (l ? l.k.length : 0), 0);
const endsOn = (q, p) =>
  new Set(q.pages[p - 1].flatMap((l) => (l.g ?? []).filter(([v, , to]) => to === q.verses[v].t.length - 1).map(([v]) => v))).size;
// عدد كلمات الآية v في الصفحة p
const wordsOf = (q, p, v) => pageWords(q, p).filter((x) => x === v).length;

beforeEach(() => localStorage.clear());

describe('كلمات الصفحة ورؤوس آياتها', () => {
  it('كل رمز في الصفحة كلمة أو رأس آية، ورؤوس الآيات بعدد الآيات المنتهية فيها (حفص وورش، في كل الصفحات)', () => {
    for (const q of [H, W]) {
      for (let p = 1; p <= 604; p++) {
        expect(pageWords(q, p).length + endsOn(q, p)).toBe(glyphCount(q, p));
      }
    }
  });

  it('الكلمات بترتيب الآيات، ورأس الآية آخر رموزها في سطر نهايتها', () => {
    const words = pageWords(H, 50);
    expect([...words].sort((a, b) => a - b)).toEqual(words);
    const i = H.pages[49].findIndex((l) => l.g);
    const line = H.pages[49][i];
    const out = lineGlyphs(H, line, H.qcf.pages[49][i]);
    const [v, , to] = line.g[0];
    if (to === H.verses[v].t.length - 1) expect(out.filter(([x, , wi]) => x === v && wi == null)).toHaveLength(1);
    // الترتيب متصل من بداية السطر المعطاة
    const order = lineGlyphs(H, line, H.qcf.pages[49][i], 7).map(([, , wi]) => wi).filter((x) => x != null);
    expect(order[0]).toBe(7);
    expect(order).toEqual(order.map((_, k) => 7 + k));
  });

  it('بسملة الفاتحة آية في حفص فتُخفى، وفي ورش ليست من الآيات فلا تُعدّ', () => {
    expect(pageWords(H, 1)[0]).toBe(h(1, 1));
    expect(wordsOf(H, 1, h(1, 1))).toBe(4);
    expect(W.verses[pageWords(W, 1)[0]].t[0]).toMatch(/حَمْدُ/);
  });
});

describe('الكشف', () => {
  it('كلمتين كلمتين لا تتجاوز نهاية الآية: إن بقيت كلمة واحدة كُشفت وحدها، ثم تبدأ الآية التالية', () => {
    // الفاتحة: البسملة ٤ كلمات، والحمد ٤، والرحمن الرحيم ٢، ومالك يوم الدين ٣
    let s = {};
    const steps = [];
    for (let k = 0; k < 6; k++) {
      s = reveal(H, [1], s, 2);
      steps.push(s[1]);
    }
    expect(steps).toEqual([2, 4, 6, 8, 10, 12]);
    s = reveal(H, [1], s, 2);
    expect(s[1]).toBe(13); // «الدين» وحدها آخر «مالك يوم الدين»
    s = reveal(H, [1], s, 2);
    expect(pageWords(H, 1)[s[1] - 1]).toBe(h(1, 5));
  });

  it('«كشف كلمة» (max = 1): كلمة واحدة في كل مرة، وتتابعها يعبر الآيات حتى آخر الصفحة ثم يقف (null)', () => {
    const total = pageWords(H, 1).length;
    let s = {};
    for (let k = 1; k <= total; k++) {
      s = reveal(H, [1], s, 1);
      expect(s[1]).toBe(k);
    }
    // عبر الآيات: البسملة ٤ كلمات ثم الحمد، فالخامسة أول آية الحمد
    expect(pageWords(H, 1)[4]).toBe(h(1, 2));
    expect(reveal(H, [1], s, 1)).toBeNull();
    // وفي الزوج: بعد آخر اليمنى أول كلمة من اليسرى
    const right = pageWords(H, 3).length;
    expect(reveal(H, [3, 4], { 3: right }, 1)).toEqual({ 3: right, 4: 1 });
  });

  it('«كشف الآية» يكشف بقية الآية الجارية وحدها', () => {
    let s = reveal(H, [1], {}, Infinity);
    expect(s[1]).toBe(4);
    s = reveal(H, [1], { 1: 5 }, Infinity);
    expect(s[1]).toBe(8);
  });

  it('الآية الممتدة إلى الصفحة التالية (في ورش أربع صفحات كذلك) ينتهي كشفها بآخر صفحتها، وتكمل في التالية', () => {
    let p = 1;
    while (pageWords(W, p + 1)[0] !== pageWords(W, p).at(-1)) p++;
    const words = pageWords(W, p);
    const cross = words.at(-1);
    const s = reveal(W, [p], { [p]: words.indexOf(cross) }, Infinity);
    expect(s[p]).toBe(words.length);
    const next = reveal(W, [p, p + 1], s, Infinity);
    expect(next[p + 1]).toBe(wordsOf(W, p + 1, cross));
    expect(next[p + 1]).toBeGreaterThan(0);
  });

  it('في عرض الصفحتين: اليمنى أولًا حتى تكتمل، ثم اليسرى؛ وبعد الصفحتين لا كشف (null)', () => {
    const right = pageWords(H, 3).length;
    let s = reveal(H, [3, 4], {}, Infinity);
    expect(s).toEqual({ 3: wordsOf(H, 3, pageWords(H, 3)[0]) });
    s = { 3: right };
    s = reveal(H, [3, 4], s, 2);
    expect(s[3]).toBe(right);
    expect(s[4]).toBeGreaterThan(0);
    expect(reveal(H, [3, 4], { 3: right, 4: pageWords(H, 4).length }, 2)).toBeNull();
    expect(reveal(H, [1], { 1: pageWords(H, 1).length }, Infinity)).toBeNull();
  });

  it('حال كل صفحة مستقلة: الكشف في صفحة لا يغيّر ما كُشف في غيرها', () => {
    const s = reveal(H, [10], { 9: 5 }, 2);
    expect(s).toEqual({ 9: 5, 10: 2 });
  });
});

describe('الإخفاء من كلمة ملموسة', () => {
  it('تُخفى الكلمة الملموسة وما بعدها، ولمس كلمة مخفية لا يغيّر شيئًا', () => {
    expect(hideFrom({ 1: 10 }, [1], 1, 3)).toEqual({ 1: 3 });
    expect(hideFrom({ 1: 10 }, [1], 1, 0)).toEqual({ 1: 0 });
    expect(hideFrom({ 1: 10 }, [1], 1, 10)).toBeNull();
    expect(hideFrom({}, [1], 1, 0)).toBeNull();
  });

  it('في الزوج: لمس اليمنى يُخفي اليسرى كلها، ولمس اليسرى لا يمسّ اليمنى، ولا تُمسّ صفحات أخرى', () => {
    expect(hideFrom({ 3: 50, 4: 20, 7: 9 }, [3, 4], 3, 12)).toEqual({ 3: 12, 4: 0, 7: 9 });
    expect(hideFrom({ 3: 50, 4: 20 }, [3, 4], 4, 5)).toEqual({ 3: 50, 4: 5 });
  });
});

describe('آيات «أخطائي»', () => {
  it('الآيات المكشوفة في الصفحات الظاهرة، الأحدث أولًا، وآية بين صفحتين مرة واحدة', () => {
    expect(revealedVerses(H, [1], {})).toEqual([]);
    expect(revealedVerses(H, [1], { 1: 9 })).toEqual([h(1, 3), h(1, 2), h(1, 1)]);
    const p = 4;
    const lastRight = pageWords(H, 3).at(-1);
    const s = { 3: pageWords(H, 3).length, 4: 1 };
    const list = revealedVerses(H, [3, p], s);
    expect(list[0]).toBe(pageWords(H, 4)[0]);
    expect(new Set(list).size).toBe(list.length);
    expect(list).toContain(lastRight);
  });

  it('أول تسجيل يُنشئ علامة «أخطائي» متعددة بالآية، ثم تُضاف إليها الآيات، والمسجّلة لا تتكرر', () => {
    expect(mistakesBookmark()).toBeNull();
    expect(addMistake(H, 7)).toBe('added');
    let b = mistakesBookmark();
    expect(b).toMatchObject({ name: MISTAKES_NAME, multi: true });
    expect(b.verses.map((x) => x.v)).toEqual([7]);
    expect(addMistake(H, 20)).toBe('added');
    expect(addMistake(H, 7)).toBe('already');
    b = mistakesBookmark();
    expect(b.verses.map((x) => x.v)).toEqual([7, 20]);
    expect(inMistakes(H, 20)).toBe(true);
    expect(inMistakes(H, 21)).toBe(false);
    expect(readBookmarks()).toHaveLength(1);
  });

  it('علامة «أخطائي» أنشأها المستخدم بيده تُستعمل نفسها ولا تُنشأ ثانية', () => {
    createBookmark({ name: 'حفظي', multi: true });
    createBookmark({ name: MISTAKES_NAME, multi: true, color: '#c0392b' }, 3);
    addMistake(H, 9);
    const list = readBookmarks();
    expect(list.filter((b) => b.name === MISTAKES_NAME)).toHaveLength(1);
    expect(mistakesBookmark().verses.map((x) => x.v)).toEqual([3, 9]);
    expect(mistakesBookmark().color).toBe('#c0392b');
  });

  it('في ورش تُحفظ بترقيم حفص كبقية العلامات، وتُعرف المسجّلة بما يقابلها', () => {
    const v = W.verses.findIndex((x) => x.s === 2 && x.a === 10);
    expect(addMistake(W, v)).toBe('added');
    expect(hafsOf(W, v)).toContain(mistakesBookmark().verses[0].v);
    expect(inMistakes(W, v)).toBe(true);
    expect(addMistake(W, v)).toBe('already');
  });
});
