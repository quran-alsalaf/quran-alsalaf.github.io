// ربط ترقيم ورش بحفص (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٢): جدول التقابل المبني (scripts/data/13-warsh-map.mjs)،
// ومحتوى المذكرات بترقيم ورش، والنقل بين الترقيمين في التطبيق (src/lib/verseMap.js)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { align, checkMap, mapKinds, skeleton, warshOfHafs } from '../../scripts/data/13-warsh-map.mjs';
import {
  hafsKey,
  hafsList,
  hafsOf,
  hafsRange,
  shownBookmarks,
  shownList,
  shownNotes,
  shownOf,
  shownRange,
} from '../../src/lib/verseMap.js';
import { memoIndex, noteShareText, shownTafsirText } from '../../src/lib/study.js';
import { weekMap } from '../../src/lib/weeks.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const H = { ...load('quran'), memos: load('memos') };
const W = { ...load('warsh/quran'), memos: load('warsh/memos') };
// رقم الآية في المصحف (من ٠) بالسورة ورقمها
const h = (s, a) => H.verses.findIndex((v) => v.s === s && v.a === a);
const w = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
// آيات حفص المقابلة لآية ورش، بالسورة ورقمها
const toHafs = (s, a) => hafsOf(W, w(s, a)).map((x) => `${H.verses[x].s}:${H.verses[x].a}`);
const toWarsh = (s, a) => shownOf(W, h(s, a)).map((x) => `${W.verses[x].s}:${W.verses[x].a}`);

describe('جدول التقابل', () => {
  it('لكل آية من آيات ورش الـ٦٢١٤ مقابل، وكل آية من آيات حفص الـ٦٢٣٦ مغطاة، متتابعًا وفي سورتها', () => {
    expect(W.verses).toHaveLength(6214);
    expect(H.verses).toHaveLength(6236);
    expect(W.hafs).toHaveLength(6214);
    expect(checkMap(H, W, W.hafs)).toEqual([]);
    const back = warshOfHafs(W.hafs, H.verses.length);
    expect(back.every((ws) => ws.length >= 1)).toBe(true);
  });

  it('عدد آيات كل سورة في ورش = عددها في حفص بعد الضمّ والقسمة', () => {
    for (let s = 1; s <= 114; s++) {
      const ws = W.verses.map((_, i) => i).filter((i) => W.verses[i].s === s);
      const hs = new Set(ws.flatMap((i) => hafsOf(W, i)));
      expect(hs.size, `السورة ${s}`).toBe(H.suras[s - 1].count);
    }
  });

  it('الفاتحة: البسملة مضمومة إلى أول آية في ورش، و﴿صراط الذين أنعمت عليهم﴾ آية في ورش', () => {
    expect(toHafs(1, 1)).toEqual(['1:1', '1:2']);
    expect(hafsKey(W, w(1, 1))).toBe(h(1, 2)); // بها تُحفظ العلامة والملاحظة: الآية التي فيها «الحمد لله»
    expect(toHafs(1, 2)).toEqual(['1:3']);
    expect(toHafs(1, 6)).toEqual(['1:7']);
    expect(toHafs(1, 7)).toEqual(['1:7']);
    expect(toWarsh(1, 1)).toEqual(['1:1']);
    expect(toWarsh(1, 7)).toEqual(['1:6', '1:7']);
  });

  it('مواضع معروفة: «الم» أول البقرة، وآية الكرسي، وطه، والموضع المتداخل في هود', () => {
    // الكوفي يعدّ «الم» آية، والمدني لا يعدّها
    expect(toHafs(2, 1)).toEqual(['2:1', '2:2']);
    expect(toHafs(2, 2)).toEqual(['2:3']);
    expect(hafsKey(W, w(2, 1))).toBe(h(2, 1));
    // المدني يعدّ ﴿الحي القيوم﴾ آية
    expect(toWarsh(2, 255)).toEqual(['2:253', '2:254']);
    expect(toHafs(2, 255)).toEqual(['2:256']);
    expect(toHafs(20, 1)).toEqual(['20:1', '20:2']);
    // هود: ورش ٨١ جزء من حفص ٨٢، وورش ٨٢ بقيتها مع حفص ٨٣
    expect(toHafs(11, 81)).toEqual(['11:82']);
    expect(toHafs(11, 82)).toEqual(['11:82', '11:83']);
    expect(toWarsh(11, 82)).toEqual(['11:81', '11:82']);
    // وآخر المصحف آية بآية
    expect(toHafs(114, 6)).toEqual(['114:6']);
  });

  it('أنواع المواضع: آية بآية أكثرها، وقليل منها يُضمّ أو يُقسم', () => {
    const k = mapKinds(W.hafs, H.verses.length);
    expect(k.same).toBeGreaterThan(6000);
    expect(k.merged.length).toBeGreaterThan(50);
    expect(k.split.length).toBeGreaterThan(40);
    expect(k.same + k.merged.length).toBeLessThanOrEqual(6214);
  });

  it('المحاذاة: هيكل الكلمة بلا تشكيل ولا ألف، فاختلاف الرسم لا يمنع التقابل', () => {
    expect(skeleton('اِ۬لْعَٰلَمِينَ')).toBe(skeleton('ٱلۡعَٰلَمِينَ'));
    expect(skeleton('مُومِنٗا')).toBe(skeleton('مُؤۡمِنٗا'));
    expect(skeleton('۞')).toBe('');
    const a = ['الف', 'باء', 'جيم', 'دال'].map((s) => ({ s }));
    const b = ['الف', 'جيم', 'دال'].map((s) => ({ s }));
    expect([...align(a, b).match]).toEqual([0, -1, 1, 2]);
  });
});

describe('النقل بين الترقيمين', () => {
  it('في حفص لا يتغير شيء', () => {
    expect(hafsOf(H, 10)).toEqual([10]);
    expect(hafsKey(H, 10)).toBe(10);
    expect(shownOf(H, 10)).toEqual([10]);
    expect(shownRange(H, [3, 9])).toEqual([3, 9]);
    expect(hafsRange(H, [3])).toEqual([3]);
    const notes = { 1: 'x' };
    expect(shownNotes(H, notes)).toBe(notes);
    const marks = [{ id: 1, verses: [{ v: 1, at: 1 }] }];
    expect(shownBookmarks(H, marks)).toBe(marks);
    expect(shownList(H, [5, 2])).toEqual([5, 2]);
  });

  it('المقدار: يُحفظ بترقيم حفص من أول ما يقابل البداية إلى آخر ما يقابل النهاية، ويُعرض بترقيم ورش', () => {
    expect(hafsRange(W, [w(1, 1), w(1, 7)])).toEqual([h(1, 1), h(1, 7)]);
    expect(hafsRange(W, [w(2, 1)])).toEqual([h(2, 1)]);
    expect(shownRange(W, [h(1, 1), h(1, 7)])).toEqual([w(1, 1), w(1, 7)]);
    expect(shownRange(W, [h(2, 255), h(2, 255)])).toEqual([w(2, 253), w(2, 254)]);
    expect(shownRange(W, null)).toBe(null);
  });

  it('الملاحظات والعلامات بترقيم حفص تظهر على كل ما يقابلها في ورش', () => {
    const notes = { [h(1, 7)]: 'على الآية السابعة', [h(2, 2)]: { text: '', verse: true } };
    const shown = shownNotes(W, notes);
    expect(Object.keys(shown).map(Number).sort((a, b) => a - b)).toEqual([w(1, 6), w(1, 7), w(2, 1)]);
    expect(shownNotes(W, notes)).toBe(shown); // تُحسب مرة لكل ملاحظات
    const list = [
      { id: 1, name: 'أ', color: '#000000', multi: true, verses: [{ v: h(2, 1), at: 1 }, { v: h(2, 2), at: 5 }, { v: h(2, 255), at: 3 }] },
    ];
    const [b] = shownBookmarks(W, list);
    // البقرة ١–٢ في حفص آية واحدة في ورش: تُذكر مرة بآخر الوقتين
    expect(b.verses).toEqual([
      { v: w(2, 1), at: 5 },
      { v: w(2, 253), at: 3 },
      { v: w(2, 254), at: 3 },
    ]);
    expect(list[0].verses).toHaveLength(3); // المحفوظ لا يتغير
  });

  it('قوائم الآيات بين الترقيمين', () => {
    expect(hafsList(W, [w(1, 1), w(1, 6), w(1, 7)])).toEqual([h(1, 1), h(1, 2), h(1, 7)]);
    expect(shownList(W, [h(1, 7), h(1, 1)])).toEqual([w(1, 1), w(1, 6), w(1, 7)]);
  });
});

describe('المحتوى في ورش', () => {
  const tafsir = { verses: H.verses.map((_, i) => `تفسير ${i}`) };

  it('التفسير: آية ورش تأخذ تفسير ما يقابلها، متتابعًا وبلا تكرار', () => {
    expect(shownTafsirText('mukhtasar', tafsir, W, w(1, 1))).toBe(`تفسير ${h(1, 1)}\nتفسير ${h(1, 2)}`);
    expect(shownTafsirText('mukhtasar', tafsir, W, w(1, 6))).toBe(`تفسير ${h(1, 7)}`);
    expect(shownTafsirText('mukhtasar', tafsir, W, w(1, 7))).toBe(`تفسير ${h(1, 7)}`);
    const same = { verses: H.verses.map(() => 'تفسير واحد') };
    expect(shownTafsirText('mukhtasar', same, W, w(2, 1))).toBe('تفسير واحد');
    // آية لم يُفرد لها المفسّر كلامًا: نص فارغ
    expect(shownTafsirText('saadi', { verses: [] }, W, w(1, 1))).toBe('');
    // وفي حفص كما هو
    expect(shownTafsirText('mukhtasar', tafsir, H, h(1, 1))).toBe(`تفسير ${h(1, 1)}`);
  });

  it('المذكرات بترقيم ورش: المعاني بكلمات ورش، والعمل والأقسام والمقررات على آياته', () => {
    expect(existsSync('public/data/warsh/memos.json')).toBe(true);
    const iw = memoIndex(W);
    const ih = memoIndex(H);
    // «الحمد لله» في ورش الآية ١، وفي حفص الآية ٢
    const words = iw.meaningsOf.get(w(1, 1)).map((x) => x.mushaf ?? x.word);
    expect(words).toContain('اِ۬لْحَمْدُ لِلهِ');
    expect(ih.meaningsOf.get(h(1, 2)).map((x) => x.word)).toContain('الحمد لله');
    // كل معنى بموضعه يطابق هيكل كلمته في حفص
    let placed = 0;
    for (const [v, , , , from, to] of W.memos.meanings) {
      if (from === undefined) continue;
      placed++;
      expect(v).toBeLessThan(W.verses.length);
      expect(to).toBeLessThan(W.verses[v].t.length - 1);
    }
    expect(placed / W.memos.meanings.length).toBeGreaterThan(0.99);
    expect(W.memos.meanings).toHaveLength(H.memos.meanings.length);
    // العمل والأقسام: كل ما كان في حفص في ورش، على آياته
    expect(W.memos.actions).toHaveLength(H.memos.actions.length);
    W.memos.actions.forEach((a, i) => expect(a.v).toEqual(shownList(W, H.memos.actions[i].v)));
    expect(iw.sectionOf.t[w(1, 1)]).toBe(ih.sectionOf.t[h(1, 2)]);
    // المقررات: العدد نفسه، والتظليل في ورش بالتناوب كحفص
    expect(W.memos.weeks).toHaveLength(H.memos.weeks.length);
    expect(weekMap(W).shaded(w(1, 1))).toBe(weekMap(H).shaded(h(1, 2)));
  });

  it('مشاركة الملاحظة على آية حفص تنقسم في ورش: الآيتان معًا', () => {
    const text = noteShareText(W, [w(1, 6), w(1, 7)], { text: 'تعليق', verse: true });
    expect(text.startsWith('﴿')).toBe(true);
    expect(text).toContain('[الفاتحة: ٦–٧]');
    expect(text).toContain('تعليق');
    expect(noteShareText(W, w(1, 6), { text: 'تعليق', verse: true })).toContain('[الفاتحة: ٦]');
  });

  it('خط نص ورش مبني', () => {
    expect(existsSync('public/fonts/warsh-text.woff2')).toBe(true);
  });
});
