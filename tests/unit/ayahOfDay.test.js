// ويدجت «آية اليوم» (تطبيق أندرويد، الجلسة ٣ ج ٢): القائمة المعتمدة وترتيبها، وآية كل يوم، ونصوص المصحفين ومراجعها،
// وتطابق البيانات المبنية مع التطبيق، والفتح من الويدجت، والإرسال إلى أندرويد — src/lib/ayahOfDay.js وsrc/lib/widgets.js
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AYAH_EPOCH, AYAH_TOPICS, AYAT_OF_DAY } from '../../src/data/ayahOfDay.js';
import * as A from '../../src/lib/ayahOfDay.js';
import * as W from '../../src/lib/widgets.js';

const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const HAFS = load('public/data/quran.json');
const WARSH = load('public/data/warsh/quran.json');
const entries = A.ayahEntries(HAFS, WARSH);
const at = (s, a) => HAFS.verses.findIndex((v) => v.s === s && v.a === a);
const find = (s, a) => entries[AYAT_OF_DAY.findIndex(([x, y]) => x === s && y === a)];

describe('القائمة المعتمدة (٢٠٢٦-١١-٢١)', () => {
  it('٤٧ آية بلا تكرار، بعدد كل موضوع كما اعتُمد', () => {
    expect(AYAT_OF_DAY).toHaveLength(47);
    expect(new Set(AYAT_OF_DAY.map(([s, a]) => `${s}:${a}`)).size).toBe(47);
    const count = {};
    for (const [, , , t] of AYAT_OF_DAY) count[t] = (count[t] ?? 0) + 1;
    expect(count).toEqual({ rajaa: 5, tawakkul: 4, dhikr: 3, sabr: 6, duaa: 8, tawheed: 5, taqwa: 5, istighfar: 2, quran: 4, shukr: 2, akhlaq: 3 });
    expect(Object.keys(count).sort()).toEqual(Object.keys(AYAH_TOPICS).sort());
  });

  it('لا تتتابع آيتان من موضوع واحد، ولا الأخيرة والأولى حين تعود الدورة', () => {
    AYAT_OF_DAY.forEach(([, , , t], i) => {
      expect(t).not.toBe(AYAT_OF_DAY[(i + 1) % AYAT_OF_DAY.length][3]);
    });
  });

  it('بالترتيب المعتمد: الزمر ٥٣ أولًا، وآية الكرسي الرابعة عشرة، والعنكبوت ٦٩ آخرًا', () => {
    expect(AYAT_OF_DAY[0].slice(0, 3)).toEqual([39, 53, 53]);
    expect(AYAT_OF_DAY[13].slice(0, 3)).toEqual([2, 255, 255]);
    expect(AYAT_OF_DAY.at(-1).slice(0, 3)).toEqual([29, 69, 69]);
  });
});

describe('آية كل يوم', () => {
  it('اليوم الثابت أول القائمة، ثم بالترتيب (كـ AyahDays في أندرويد)', () => {
    expect(A.ayahIndex(AYAH_EPOCH)).toBe(0);
    expect(A.ayahIndex('2026-11-22')).toBe(1);
    expect(A.ayahIndex('2026-12-01')).toBe(10);
  });

  it('تعود الدورة بعد آخرها، وقبل اليوم الثابت بالعكس', () => {
    expect(A.ayahIndex('2027-01-06')).toBe(46);
    expect(A.ayahIndex('2027-01-07')).toBe(0);
    expect(A.ayahIndex('2026-11-20')).toBe(46);
  });

  it('على حدود السنة والشهر وتغيّر التوقيت الصيفي يوم بيوم', () => {
    for (const [a, b] of [
      ['2026-12-31', '2027-01-01'],
      ['2028-02-28', '2028-02-29'],
      ['2027-03-27', '2027-03-28'],
    ]) {
      expect((A.ayahIndex(b) - A.ayahIndex(a) + 47) % 47).toBe(1);
    }
  });
});

describe('نصوص المصحفين', () => {
  it('آية حفص بنصها ورسمها وعلامة نهايتها، وتحتها اسم السورة ورقمها', () => {
    const e = find(15, 49);
    const h = at(15, 49);
    expect(e.h).toEqual([h, h]);
    expect(e.hafs.text).toBe(HAFS.verses[h].t.join(' '));
    expect(e.hafs.ref).toBe('سورة الحجر · ٤٩');
    expect(e.e).toBe(HAFS.verses[h].e);
  });

  it('المتتاليات معًا بعلامة كل آية: «سورة الشرح · ٥–٦»', () => {
    const e = find(94, 5);
    expect(e.h).toEqual([at(94, 5), at(94, 6)]);
    expect(e.hafs.text.split(' ')).toHaveLength(HAFS.verses[at(94, 5)].t.length + HAFS.verses[at(94, 6)].t.length);
    expect(e.hafs.ref).toBe('سورة الشرح · ٥–٦');
    expect(e.warsh.ref).toBe('سورة الشرح · ٥–٦');
  });

  it('في ورش برسمه وترقيمه: آية الكرسي آيتان (٢٥٣–٢٥٤)', () => {
    const e = find(2, 255);
    expect(e.warsh.ref).toBe('سورة البقرة · ٢٥٣–٢٥٤');
    const w = (a) => WARSH.verses.find((v) => v.s === 2 && v.a === a).t.join(' ');
    expect(e.warsh.text).toBe(`${w(253)} ${w(254)}`);
    expect(e.warsh.text.endsWith('٢٥٤')).toBe(true);
    // الرعد ٢٨ في حفص هي ٢٩ في ورش
    expect(find(13, 28).warsh.ref).toBe('سورة الرعد · ٢٩');
  });

  it('وآية حفص التي هي بعض آية ورش: تُعرض آية ورش كاملة (البقرة ٢٠١ ← ١٩٩)', () => {
    const e = find(2, 201);
    expect(e.warsh.ref).toBe('سورة البقرة · ١٩٩');
    expect(e.warsh.text).toBe(WARSH.verses.find((v) => v.s === 2 && v.a === 199).t.join(' '));
  });

  it('كل آية لها نص في المصحفين، ومقابلها في ورش من سورتها', () => {
    expect(entries).toHaveLength(47);
    for (const e of entries) {
      expect(e.hafs.text.length).toBeGreaterThan(10);
      expect(e.warsh.text.length).toBeGreaterThan(10);
      expect(e.hafs.ref).toMatch(/^سورة .+ · [٠-٩]+(–[٠-٩]+)?$/);
      expect(e.warsh.ref).toMatch(/^سورة .+ · [٠-٩]+(–[٠-٩]+)?$/);
    }
  });

  it('آية غير موجودة توقف البناء', () => {
    expect(() => A.ayahEntries(HAFS, WARSH, [[1, 8, 8, 'quran']])).toThrow();
  });
});

describe('البيانات المبنية مع التطبيق', () => {
  it('res/raw/ayah_of_day.json مطابق للقائمة والمصحفين (وإلا: node --no-warnings scripts/data/18-ayah-of-day.mjs)', () => {
    const built = load('android/app/src/main/res/raw/ayah_of_day.json');
    expect(built).toEqual({ epoch: AYAH_EPOCH, entries });
  });
});

describe('الفتح من الويدجت', () => {
  it('«ayah:رقم» ← رقم آية حفص، وغيره لا شيء', () => {
    expect(A.parseAyahOpen('ayah:6094')).toBe(6094);
    expect(A.parseAyahOpen('ayah:0')).toBe(0);
    expect(A.parseAyahOpen('wird')).toBeNull();
    expect(A.parseAyahOpen('ayah:')).toBeNull();
    expect(A.parseAyahOpen(undefined)).toBeNull();
  });
});

describe('الإرسال إلى أندرويد', () => {
  it('في الموقع لا يُرسل شيء', () => {
    expect(() => W.syncAyahWidget({ riwayah: 'warsh' })).not.toThrow();
  });

  it('الألوان والرواية (وما لم تُختر: حفص)، ولا يعيد إرسال الحال نفسها', async () => {
    const calls = [];
    vi.resetModules();
    vi.doMock('@capacitor/core', async (orig) => {
      const real = await orig();
      const plugin = { setAyah: (args) => (calls.push(args), Promise.resolve()) };
      return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
    });
    const N = await import('../../src/lib/widgets.js');
    const theme = { bg: '#FFFFFF', ink: '#323235', accent: '#0A6FAD', accentText: '#0A6FAD', dark: false };

    N.syncAyahWidget({ riwayah: null, theme });
    expect(calls).toEqual([{ data: { theme, riwayah: 'hafs' } }]);
    N.syncAyahWidget({ riwayah: 'hafs', theme });
    expect(calls).toHaveLength(1);

    N.syncAyahWidget({ riwayah: 'warsh', theme });
    expect(calls.at(-1).data.riwayah).toBe('warsh');
    N.syncAyahWidget({ riwayah: 'warsh', theme: { ...theme, bg: '#16181D', dark: true } });
    expect(calls).toHaveLength(3);
    vi.doUnmock('@capacitor/core');
  });
});
