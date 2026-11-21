// ويدجت «ختمتي اليوم» (تطبيق أندرويد، الجلسة ٣ ج ١): حال كل يوم من الأيام المرسلة — سطر الورد وشريطه وعلامة
// إتمامه، وخطوات الحفظ وما أُتمّ منها، وبلا ختمة — والإرسال إلى أندرويد وحده — src/lib/widgets.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as H from '../../src/lib/hifz.js';
import * as K from '../../src/lib/khatma.js';
import * as W from '../../src/lib/widgets.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const Q = { ...load('quran'), qcf: load('qcf4') };
const at = (s, a) => Q.verses.findIndex((v) => v.s === s && v.a === a);
const LAST = Q.verses.length - 1;
const now = (h = 10, day = '2026-11-21') => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, 0);
};

beforeEach(() => localStorage.clear());

describe('بلا ختمة', () => {
  it('لا أيام، فيظهر «ابدأ ختمة»', () => {
    expect(W.widgetDays({ wird: null, hifz: null, quran: Q, now: now() })).toEqual([]);
  });
});

describe('ختمة الورد', () => {
  it('ثلاثون يومًا من اليوم، بسطر الورد الحالي وشريط ما أُنجز', () => {
    const k = K.startWird('days', 30, '2026-11-21');
    const days = W.widgetDays({ wird: k, hifz: null, quran: Q, now: now() });
    expect(days).toHaveLength(W.WIDGET_DAYS);
    expect(days[0]).toEqual({ day: '2026-11-21', wird: { line: 'الورد ١ من ٣٠ · من ص ١ إلى ٢٠', percent: 0, done: false }, hifz: null });
    expect(days.at(-1).day).toBe('2026-12-20');
    // الورد يتبع الإنجاز لا التاريخ: من لم يقرأ يبقى عليه الورد نفسه
    expect(new Set(days.map((d) => d.wird.line)).size).toBe(1);
  });

  it('أتمّ ورد اليوم: اليوم بالورد الذي أتمّه وعلامته، والغد بالورد التالي', () => {
    K.startWird('days', 30, '2026-11-21');
    K.completeWird('2026-11-21');
    const days = W.widgetDays({ wird: K.readWird(), hifz: null, quran: Q, now: now(22) });
    expect(days[0].wird).toEqual({ line: 'الورد ١ من ٣٠ · من ص ١ إلى ٢٠', percent: 3, done: true });
    expect(days[1].wird).toEqual({ line: 'الورد ٢ من ٣٠ · من ص ٢١ إلى ٤٠', percent: 3, done: false });
  });

  it('ورد من صفحة واحدة: «ص ٥»', () => {
    const k = K.startWird('pages', 1, '2026-11-21');
    expect(W.wirdDay(k, '2026-11-21').line).toBe('الورد ١ من ٦٠٤ · ص ١');
  });

  it('خُتمت: «أتممت الختمة» بلا شريط', () => {
    const k = { ...K.startWird('days', 30, '2026-11-21'), finished: '2026-11-21' };
    expect(W.wirdDay(k, '2026-11-22')).toEqual({ finished: true, line: 'أتممت الختمة، تقبل الله منك' });
  });
});

describe('ختمة الحفظ', () => {
  // من مريم، وما قبلها محفوظ: فيها مراجعة بعيدة من أول يوم، والقريبة تبدأ بعد أول ورد
  const start = () => H.startHifz({ dir: 'forward', start: at(19, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-21');

  it('خطوات اليوم بترتيبها، ولا شيء منها مُتمّ', () => {
    const days = W.widgetDays({ wird: null, hifz: start(), quran: Q, now: now() });
    expect(days[0].hifz).toEqual({
      steps: [
        { name: 'المراجعة البعيدة', done: false },
        { name: 'حفظ الورد', done: false },
      ],
      done: false,
    });
  });

  it('ما أُتمّ اليوم بعلامته، والغد بخطواته كلها غير متمّة', () => {
    start();
    H.completeHifz(Q, '2026-11-21');
    const days = W.widgetDays({ wird: null, hifz: H.readHifz(), quran: Q, now: now(12) });
    expect(days[0].hifz.steps).toEqual([
      { name: 'المراجعة البعيدة', done: false },
      { name: 'المراجعة القريبة', done: false },
      { name: 'حفظ الورد', done: true },
    ]);
    expect(days[0].hifz.done).toBe(false);
    expect(days[1].hifz.steps.every((s) => !s.done)).toBe(true);
  });

  it('أتمّ الخطوات كلها: علامة الختمة', () => {
    start();
    H.completeReview(Q, 'far', '2026-11-21');
    H.completeHifz(Q, '2026-11-21');
    H.completeReview(Q, 'near', '2026-11-21');
    expect(W.hifzDay(Q, H.readHifz(), '2026-11-21').done).toBe(true);
  });

  it('الختمتان معًا في اليوم نفسه', () => {
    const wird = K.startWird('days', 30, '2026-11-21');
    const days = W.widgetDays({ wird, hifz: start(), quran: Q, now: now() });
    expect(days[0].wird.line).toBe('الورد ١ من ٣٠ · من ص ١ إلى ٢٠');
    expect(days[0].hifz.steps).toHaveLength(2);
  });

  it('خُتمت: «أتممت ختمة الحفظ»', () => {
    expect(W.hifzDay(Q, { ...start(), finished: '2026-11-21' }, '2026-11-21')).toEqual({ finished: true, line: 'أتممت ختمة الحفظ، تقبل الله منك' });
  });
});

describe('الألوان', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    delete document.documentElement.dataset.theme;
  });

  it('ألوان التطبيق الحالية، والافتراضية إن لم تُوضع', () => {
    expect(W.widgetTheme()).toEqual({ bg: '#F5EDDC', ink: '#2E2A24', accent: '#8A6110', accentText: '#8A6110', dark: false });
    const root = document.documentElement;
    root.style.setProperty('--bg', '#2B2B2E');
    root.style.setProperty('--ink', '#E8E6E1');
    root.style.setProperty('--accent', '#5CB4EE');
    root.style.setProperty('--accent-text', '#6ABBEF');
    root.dataset.theme = 'dark';
    expect(W.widgetTheme()).toEqual({ bg: '#2B2B2E', ink: '#E8E6E1', accent: '#5CB4EE', accentText: '#6ABBEF', dark: true });
  });
});

describe('في الموقع', () => {
  it('لا يُرسل شيء (لا ويدجت في المتصفح)', () => {
    expect(W.widgetsAvailable()).toBe(false);
    expect(() => W.syncWidgets({ wird: K.startWird('days', 30, '2026-11-21'), hifz: null, hafs: Q })).not.toThrow();
  });
});

describe('الإرسال إلى أندرويد', () => {
  it('يُرسل حال الأيام والألوان، ولا يعيد إرسال الحال نفسها، وينتظر مصحف حفص لختمة الحفظ', async () => {
    const calls = [];
    vi.resetModules();
    vi.doMock('@capacitor/core', async (orig) => {
      const real = await orig();
      const plugin = { setKhatma: (args) => (calls.push(args), Promise.resolve()) };
      return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
    });
    const N = await import('../../src/lib/widgets.js');
    const K2 = await import('../../src/lib/khatma.js');
    const H2 = await import('../../src/lib/hifz.js');
    const theme = { bg: '#FFFFFF', ink: '#323235', accent: '#0A6FAD', accentText: '#0A6FAD', dark: false };
    const wird = K2.startWird('days', 30, '2026-11-21');

    N.syncWidgets({ wird, hifz: null, hafs: null, now: now(), theme });
    expect(calls).toHaveLength(1);
    expect(calls[0].data.theme).toEqual(theme);
    expect(calls[0].data.days).toHaveLength(N.WIDGET_DAYS);
    expect(calls[0].data.days[0].wird.done).toBe(false);

    N.syncWidgets({ wird, hifz: null, hafs: null, now: now(), theme });
    expect(calls).toHaveLength(1);

    // تغيّر لون التطبيق: يُرسل من جديد
    N.syncWidgets({ wird, hifz: null, hafs: null, now: now(), theme: { ...theme, accent: '#2A7350' } });
    expect(calls).toHaveLength(2);

    // ختمة حفظ ومصحف حفص لم يُحمَّل بعد: ينتظره
    const hifz = H2.startHifz({ dir: 'forward', start: at(19, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-21');
    N.syncWidgets({ wird, hifz, hafs: null, now: now(), theme });
    expect(calls).toHaveLength(2);
    N.syncWidgets({ wird, hifz, hafs: Q, now: now(), theme });
    expect(calls).toHaveLength(3);
    expect(calls[2].data.days[0].hifz.steps[0].name).toBe('المراجعة البعيدة');

    // لا ختمة: أيام فارغة («ابدأ ختمة»)
    N.syncWidgets({ wird: null, hifz: null, hafs: Q, now: now(), theme });
    expect(calls.at(-1).data.days).toEqual([]);
    vi.doUnmock('@capacitor/core');
  });
});
