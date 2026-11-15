// مصحف ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ١): بياناته المبنية (scripts/data/12-warsh.mjs)، وتبديل الرواية
// (src/lib/riwayah.js)، وما يعمل عليه من منطق التطبيق: الحجم والأسطر الموسّطة، والبحث، والنسخ
import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { plain, splitWords } from '../../scripts/data/12-warsh.mjs';
import { pageLayout } from '../../src/lib/layout.js';
import { buildSearchIndex, search } from '../../src/lib/search.js';
import { copyVerse, pageVerses, verseLabel } from '../../src/lib/study.js';
import { isWarsh, readRiwayah, RIWAYAT, setRiwayah } from '../../src/lib/riwayah.js';
import { pageInfo } from '../../src/data/quran.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const W = load('warsh/quran');
const H = { ...load('quran'), qcf: load('qcf4') };
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
const textLines = (p) => W.pages[p - 1].map((l, i) => [l, W.qcf.pages[p - 1][i]]).filter(([l]) => l.g);

describe('بيانات مصحف ورش', () => {
  it('٦٠٤ صفحات بأسطر المطبوع (٨ في الأوليين و١٥ في غيرهما)، و٦٢١٤ آية بعدّ المدني الأول', () => {
    expect(W.riwayah).toBe('warsh');
    expect(W.pages).toHaveLength(604);
    W.pages.forEach((lines, i) => expect(lines.length).toBe(i < 2 ? 8 : 15));
    expect(W.verses).toHaveLength(6214);
    expect(W.suras).toHaveLength(114);
    expect(W.suras.reduce((n, s) => n + s.count, 0)).toBe(6214);
    // من فروق العدّ بين ورش وحفص
    expect(W.suras[0].count).toBe(7);
    expect(W.suras[1].count).toBe(285);
    expect(W.suras[35].count).toBe(82);
    expect(W.suras[111].count).toBe(4);
  });

  it('السور والأجزاء تبدأ في الصفحات نفسها التي في مصحف حفص، فالتبديل يبقى على الصفحة نفسها', () => {
    expect(W.suras.map((s) => s.page)).toEqual(H.suras.map((s) => s.page));
    const juz = (q) => q.verses.reduce((out, v) => (out.length < v.j ? [...out, v.p] : out), []);
    expect(juz(W)).toEqual(juz(H));
    // وترويسة كل صفحة (السورة والجزء) هي هي
    for (const p of [1, 2, 3, 50, 262, 502, 591, 604]) {
      const [a, b] = [pageInfo(W, p), pageInfo(H, p)];
      expect([a.juz, a.suras.map((s) => s.n)]).toEqual([b.juz, b.suras.map((s) => s.n)]);
    }
  });

  it('١١٤ عنوان سورة و١١٣ بسملة (للفاتحة بسملة غير معدودة آية، ولا بسملة للتوبة)', () => {
    const all = W.pages.flat();
    expect(all.filter((l) => l.h)).toHaveLength(114);
    const b = all.filter((l) => l.b).map((l) => l.b);
    expect(b).toHaveLength(113);
    expect(b).toContain(1);
    expect(b).not.toContain(9);
    expect(W.qcf.basmalaText).toMatch(/^بِسْمِ/);
  });

  it('كل آية كلماتها متتابعة في أسطرها، وآخر كلمة فيها رقمها، وصفحتها أول صفحة تظهر فيها', () => {
    const seen = W.verses.map(() => []);
    W.pages.forEach((lines, p) =>
      lines.forEach((l) => {
        for (const [v, from, to] of l.g ?? []) {
          seen[v].push([from, to]);
          if (seen[v].length === 1) expect(W.verses[v].p).toBe(p + 1);
        }
      })
    );
    W.verses.forEach((v, i) => {
      let next = 0;
      for (const [from, to] of seen[i]) {
        expect(from).toBe(next);
        next = to + 1;
      }
      expect(next).toBe(v.t.length);
      expect(v.t.at(-1)).toBe(ar(v.a));
    });
  });

  it('رموز كل سطر من آيات السطر نفسه وبترتيبها، ونهاية كل آية في سطرها رمز', () => {
    for (let p = 1; p <= 604; p++) {
      for (const [l, q] of textLines(p)) {
        const lineVerses = l.g.map(([v]) => v);
        const glyphVerses = [...new Set(q.k.map(([v]) => v))];
        expect(glyphVerses).toEqual(lineVerses);
        for (const [, code] of q.k) expect(code.length).toBeGreaterThan(0);
      }
    }
  });

  it('أسطر الخطّاط الكاملة في كل صفحة متساوية العرض (فلو انزاح رمز إلى غير سطره لظهر)', () => {
    for (let p = 3; p <= 604; p++) {
      const ws = textLines(p).map(([, q]) => q.w);
      const max = Math.max(...ws);
      const full = ws.filter((w) => w >= 0.93 * max).sort((a, b) => a - b);
      const mid = full[Math.floor(full.length / 2)];
      expect(max / mid, `صفحة ${p}`).toBeLessThan(1.04);
      expect((max - full[0]) / max, `صفحة ${p}`).toBeLessThan(0.06);
      expect(max).toBeLessThanOrEqual(W.qcf.widest);
    }
  });

  it('لكل صفحة خطّها، ولبسملة ورش خطّها', () => {
    for (let p = 1; p <= 604; p++) expect(existsSync(`public/fonts/qcf4-warsh/p${p}.woff2`), `صفحة ${p}`).toBe(true);
    expect(existsSync('public/fonts/warsh-basmala.woff2')).toBe(true);
  });

  it('مواضع من المطبوع: أول الحجر (٢٦٢)، والنحل ١٢٣ (رقمها ملتصق بكلمتها في ملف الوورد)', () => {
    const [first] = textLines(262)[0][0].g;
    expect(W.verses[first[0]]).toMatchObject({ s: 15, a: 1, p: 262 });
    const nahl = W.verses.find((v) => v.s === 16 && v.a === 123);
    expect(nahl.t.at(-2)).toMatch(/لْمُشْرِكِينَ/);
    expect(nahl.t.at(-1)).toBe('١٢٣');
  });
});

describe('قراءة ملف الوورد', () => {
  it('الكلمات بفاصل المسافة التي لا تنكسر، والرقم الملتصق بكلمته يُفصل', () => {
    expect(splitWords('رَّحِيمٞۖ ٧ وَالْخَيْلَ')).toEqual(['رَّحِيمٞۖ', '٧', 'وَالْخَيْلَ']);
    expect(splitWords('اَ۬لْمُشْرِكِينَۖ١٢٣ ')).toEqual(['اَ۬لْمُشْرِكِينَۖ', '١٢٣']);
    expect(splitWords('۞ لَّيْسَ')).toEqual(['۞', 'لَّيْسَ']);
  });

  it('النص الإملائي للبحث بلا تشكيل ولا علامات وقف', () => {
    expect(plain(['اِ۬لْحَمْدُ', 'لِلهِ', 'رَبِّ'])).toBe('الحمد لله رب');
    expect(plain(['فِے'])).toBe('في');
  });
});

describe('ما يعمل على مصحف ورش', () => {
  it('الحجم من أعرض سطر في ورش، والأسطر الموسّطة لكل مصحف على حدة', () => {
    const area = { w: 384, h: 814 };
    const w = pageLayout(W, 3, area);
    const h = pageLayout(H, 3, area);
    expect(w.fontSize * W.qcf.widest).toBeLessThanOrEqual(area.w);
    expect(w.fontSize).toBeLessThan(h.fontSize);
    // الأسطر الموسّطة: آخر الفاتحة في حفص وورش مختلفة الأسطر، فلا تختلط
    expect(pageLayout(W, 1, area).shortLines).not.toBe(pageLayout(H, 1, area).shortLines);
    // آخر سطر في الحجر قبل النحل (٢٦٧): ليس في الصفحة سطر موسّط إلا ما قصر حقًّا
    for (const i of pageLayout(W, 50, area).shortLines) expect(W.qcf.pages[49][i].w).toBeLessThan(0.93 * W.qcf.widest);
  });

  it('البحث في نص ورش وبترقيمه', () => {
    const index = buildSearchIndex(W);
    const r = search(index, 'البقرة ٢٨٥');
    expect(r.refs?.map((x) => x.i).filter((i) => i != null)).toEqual([W.verses.findIndex((v) => v.s === 2 && v.a === 285)]);
    expect(search(index, 'البقرة ٢٨٦').refs?.filter((x) => x.i != null) ?? []).toHaveLength(0);
    // النتائج بترتيب المصحف، وفيها أول الإخلاص
    const hits = search(index, 'قل هو الله احد').verses.map((i) => `${W.verses[i].s}:${W.verses[i].a}`);
    expect(hits).toContain('112:1');
  });

  it('نسخ الآية بنص ورش وترقيمه، واسمها', () => {
    const v = W.verses.findIndex((x) => x.s === 1 && x.a === 1);
    const text = W.verses[v].t.slice(0, -1).join(' ');
    expect(plain([text])).toBe('الحمد لله رب العلمين');
    expect(copyVerse(W, v)).toBe(`﴿${text}﴾ [الفاتحة: ١]`);
    expect(verseLabel(W, [v])).toBe('الفاتحة ١');
    expect(pageVerses(W, 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('اختيار الرواية', () => {
  beforeEach(() => localStorage.clear());

  it('لا رواية قبل الاختيار، ثم تُحفظ، وتُبلَّغ بها الواجهة', () => {
    expect(readRiwayah()).toBeNull();
    const heard = [];
    const on = (e) => heard.push(e.detail);
    window.addEventListener('hq-riwayah', on);
    setRiwayah('warsh');
    expect(readRiwayah()).toBe('warsh');
    setRiwayah('hafs');
    expect(readRiwayah()).toBe('hafs');
    window.removeEventListener('hq-riwayah', on);
    expect(heard).toEqual(['warsh', 'hafs']);
    localStorage.setItem('hq.riwayah', 'qaloon');
    expect(readRiwayah()).toBeNull();
  });

  it('الروايتان باسميهما، ومصحف ورش يُعرف بحقله', () => {
    expect(RIWAYAT.map((r) => r.full)).toEqual(['حفص عن عاصم', 'ورش عن نافع']);
    expect(isWarsh(W)).toBe(true);
    expect(isWarsh(H)).toBe(false);
  });
});
