// أثمان مصحف ورش (٢٠٢٦-١١-١٦، scripts/data/17-warsh-athman.mjs وsrc/lib/rubs.js): البيانات على مطبوع المجمع،
// وأسماؤها ورسائل التنبيه بها، وأول كلماتها في الفهرس، ورموز علامتها في أسطر الصفحات، والمراجعة البعيدة بأرباعها
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  THUMN_MESSAGE,
  divisionMessage,
  divisionName,
  divisions,
  isAthman,
  perHizb,
  rubGlyphs,
  rubOpening,
  rubStarts,
  rubsOnPage,
  thumnMessage,
  thumnName,
} from '../../src/lib/rubs.js';
import { farUnits } from '../../src/lib/hifz.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const W = load('warsh/quran');
const H = { ...load('quran'), qcf: load('qcf4') };
const at = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const key = (v) => `${W.verses[v].s}:${W.verses[v].a}`;

describe('بيانات أثمان ورش', () => {
  it('٤٨٠ ثمنًا متتابعة أولها الفاتحة، وفي كل جزء ١٦ ثمنًا أولها أول الجزء', () => {
    expect(W.athman).toHaveLength(480);
    expect(W.athman[0]).toBe(0);
    W.athman.forEach((v, i) => i && expect(v).toBeGreaterThan(W.athman[i - 1]));
    for (let j = 1; j <= 30; j++) {
      const inJuz = W.athman.filter((v) => W.verses[v].j === j);
      expect(inJuz).toHaveLength(16);
      expect(inJuz[0]).toBe(W.verses.findIndex((x) => x.j === j));
    }
  });

  it('كل علامة ۞ أول ثمن (٤٣٥، منها ١٢ في وسط آية)، وما بلا علامة أول سورة (٤٥ مع الفاتحة)', () => {
    const set = new Set(W.athman);
    const marked = W.verses.map((x, v) => (x.t.includes('۞') ? v : -1)).filter((v) => v >= 0);
    expect(marked).toHaveLength(435);
    expect(marked.filter((v) => !set.has(v)).map(key)).toEqual([]);
    expect(marked.filter((v) => W.verses[v].t[0] !== '۞').map(key)).toEqual([
      '2:84', '2:195', '2:233', '3:80', '4:19', '4:91', '4:156', '5:34', '33:37', '59:2', '65:6', '72:23',
    ]);
    const unmarked = W.athman.filter((v) => !W.verses[v].t.includes('۞'));
    expect(unmarked).toHaveLength(45);
    expect(unmarked.filter((v) => W.verses[v].a !== 1).map(key)).toEqual([]);
  });

  it('أوائل السور المحتملة في جزء عمّ على هامش المطبوع: التكوير والانفطار والأعلى والبلد والليل والشرح والبيّنة وقريش', () => {
    const suras = W.athman.filter((v) => W.verses[v].j === 30 && W.verses[v].a === 1).map((v) => W.verses[v].s);
    expect(suras).toEqual([78, 79, 81, 82, 87, 90, 92, 94, 98, 106]);
    for (const s of [80, 83, 84, 85, 86, 88, 89, 91, 93, 95, 96, 97, 99, 100, 101, 105, 107, 114]) {
      expect(W.athman).not.toContain(at(s, 1));
    }
  });

  it('على مطبوع المجمع في الموضعين اللذين يخالفه فيهما المصحف المغربي: البقرة ٢٢٦ والأعراف ٢٠٠', () => {
    expect(W.athman).toContain(at(2, 226));
    expect(W.athman).not.toContain(at(2, 225));
    expect(W.athman).toContain(at(7, 200));
    expect(W.athman).not.toContain(at(7, 199));
    // أمثلة: أول ثمن بعد الفاتحة «۞ مثلهم كمثل الذي استوقد» (البقرة ١٦ بعدّ المدني)، والحزب ٦٠ «سبح»
    expect(W.athman[1]).toBe(at(2, 16));
    expect(W.athman[472]).toBe(at(87, 1));
    expect(W.athman[479]).toBe(at(106, 1));
  });

  it('أرباع ورش كل ثمنين (٢٤٠)، وحفص بلا أثمان', () => {
    expect(W.rubs).toEqual(W.athman.filter((_, i) => i % 2 === 0));
    expect(W.rubs).toHaveLength(240);
    expect(H.athman).toBeUndefined();
  });
});

describe('الأقسام: أثمان ورش وأرباع حفص', () => {
  it('أقسام المصحف وعددها في الحزب', () => {
    expect(isAthman(W)).toBe(true);
    expect(isAthman(H)).toBe(false);
    expect(divisions(W)).toBe(W.athman);
    expect(divisions(H)).toBe(H.rubs);
    expect(perHizb(W)).toBe(8);
    expect(perHizb(H)).toBe(4);
    expect(divisions({ verses: [] })).toEqual([]);
  });

  it('أسماء الأثمان في الفهرس بلا تكرار، برقم الحزب', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 479].map(thumnName)).toEqual([
      'الحزب ١',
      'ثمن الحزب ١',
      'ربع الحزب ١',
      'ثلاثة أثمان الحزب ١',
      'نصف الحزب ١',
      'خمسة أثمان الحزب ١',
      'ثلاثة أرباع الحزب ١',
      'سبعة أثمان الحزب ١',
      'الحزب ٢',
      'سبعة أثمان الحزب ٦٠',
    ]);
    expect(divisionName(W, 2)).toBe('ربع الحزب ١');
    expect(divisionName(H, 2)).toBe('نصف الحزب ١');
  });

  it('رسائل التنبيه: رسائل الأرباع، و«بداية ثمن الحزب» لما بينها', () => {
    expect(THUMN_MESSAGE).toBe('بداية ثمن الحزب');
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(thumnMessage)).toEqual([
      'بداية الحزب',
      'بداية ثمن الحزب',
      'بداية ربع الحزب',
      'بداية ثمن الحزب',
      'بداية نصف الحزب',
      'بداية ثمن الحزب',
      'بداية ثلاثة أرباع الحزب',
      'بداية ثمن الحزب',
      'بداية الحزب',
    ]);
    expect(divisionMessage(W, 2)).toBe('بداية ربع الحزب');
    expect(divisionMessage(H, 2)).toBe('بداية نصف الحزب');
  });

  it('أول كلمات الثمن بالرسم الإملائي، ومن بعد ۞ إن بدأ في وسط آية', () => {
    const i = (s, a) => W.athman.indexOf(at(s, a));
    expect(rubOpening(W, i(2, 84))).toBe('وإن ياتوكم أسرى تفدوهم');
    expect(rubOpening(W, i(72, 23))).toBe('ومن يعص الله ورسوله');
    expect(rubOpening(W, i(2, 226))).toBe('والمطلقت يتربصن بأنفسهن ثلثة');
    expect(rubOpening(W, i(81, 1))).toBe('إذا الشمس كورت');
    // وحفص كما كان
    expect(rubOpening(H, 1)).toBe('إن الله لا يستحيي');
  });

  it('الأثمان في الصفحات: مجموعها ٤٨٠، وصفحة التكوير فيها ثمن واحد هو أولها', () => {
    let n = 0;
    for (let p = 1; p <= 604; p++) n += rubsOnPage(W, p).length;
    expect(n).toBe(480);
    expect(rubsOnPage(W, 586).map((i) => W.athman[i])).toEqual([at(81, 1)]);
    expect(rubStarts(W).size).toBe(480);
  });
});

describe('رمز علامة ۞ في أسطر الصفحات', () => {
  const marksOf = (Q) => {
    const found = [];
    Q.pages.forEach((lines, p) =>
      lines.forEach((line, li) => {
        if (!line.g) return;
        const glyphs = Q.qcf.pages[p][li];
        for (const i of rubGlyphs(Q, line, glyphs)) found.push([glyphs.k[i][0], glyphs.k[i][1]]);
      })
    );
    return found;
  };

  it('ورش: ٤٣٥ رمزًا لعلامات الأثمان، كل منها العلامة وحدها، ومنها التي في وسط آية', () => {
    const found = marksOf(W);
    expect(found).toHaveLength(435);
    expect(found.filter(([, code]) => code.length !== 1)).toEqual([]);
    expect(new Set(found.map(([v]) => v)).size).toBe(435);
    expect(found.map(([v]) => v)).toContain(at(2, 84));
    expect(found.map(([v]) => v)).toContain(at(72, 23));
  });

  it('حفص كما كان: ١٩٩ علامة، كل منها أول رمز في أول كلمة ربعها', () => {
    const found = marksOf(H);
    expect(found).toHaveLength(199);
    found.forEach(([v]) => expect(H.verses[v].t[0]).toBe('۞'));
  });
});

describe('المراجعة البعيدة في ختمة الحفظ بأرباع ورش وأحزابه', () => {
  it('٢٤٠ ربعًا و٦٠ حزبًا متصلة إلى آخر المصحف', () => {
    const rubs = farUnits(W, 'rub');
    expect(rubs).toHaveLength(240);
    expect(rubs[0][0]).toBe(0);
    expect(rubs[1][2]).toBe('ربع الحزب ١');
    expect(rubs[239][1]).toBe(W.verses.length - 1);
    const hizbs = farUnits(W, 'hizb');
    expect(hizbs).toHaveLength(60);
    expect(hizbs[59]).toEqual([at(87, 1), W.verses.length - 1, 'الحزب ٦٠']);
  });
});
