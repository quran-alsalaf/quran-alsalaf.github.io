// المشغّل الأصلي داخل تطبيق أندرويد (٢٠٢٦-١١-١٨): src/lib/player.js يرسل الأوامر إلى إضافة QuranAudio بدل عنصر
// الصوت، وحالة المشغّل تصل إلى الواجهة. هنا الإضافة محاكاة: تسجّل الأوامر، وتُرسل الحالة باليد
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ calls: [], listener: null, state: { status: 'idle' }, appListeners: [] }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = new Proxy(
    {},
    {
      get: (_, method) => {
        if (method === 'then') return undefined;
        if (method === 'addListener') return (name, fn) => {
          fake.listener = fn;
          return Promise.resolve({ remove() {} });
        };
        if (method === 'getState') return () => Promise.resolve(fake.state);
        return (args) => {
          fake.calls.push({ method, ...args });
          return Promise.resolve();
        };
      },
    }
  );
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
});
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name, fn) => {
      fake.appListeners.push({ name, fn });
      return Promise.resolve({ remove() {} });
    },
  },
}));

class FakeAudio extends EventTarget {
  constructor() {
    super();
    FakeAudio.count = (FakeAudio.count ?? 0) + 1;
    FakeAudio.last = this;
    this.paused = true;
    this.attrs = {};
  }
  set src(v) {
    this.attrs.src = v;
  }
  get src() {
    return this.attrs.src;
  }
  getAttribute(n) {
    return this.attrs[n] ?? null;
  }
  removeAttribute(n) {
    delete this.attrs[n];
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
}

function miniQuran() {
  const verses = [];
  const add = (s, n, p) => {
    for (let a = 1; a <= n; a++) verses.push({ s, a, p });
  };
  add(1, 7, 1);
  add(2, 5, 2);
  const suras = Array.from({ length: 114 }, (_, i) => ({ n: i + 1, name: `س${i + 1}` }));
  return { verses, suras };
}
const q = miniQuran();
const idx = (s, a) => q.verses.findIndex((v) => v.s === s && v.a === a);
const flush = () => new Promise((r) => setTimeout(r, 0));

let P;
beforeEach(async () => {
  localStorage.clear();
  fake.calls = [];
  fake.listener = null;
  fake.state = { status: 'idle' };
  fake.appListeners = [];
  FakeAudio.count = 0;
  globalThis.Audio = FakeAudio;
  window.Audio = FakeAudio;
  vi.resetModules();
  P = await import('../../src/lib/player.js');
  await flush();
});
afterEach(() => vi.useRealTimers());

const last = (method) => fake.calls.filter((c) => c.method === method).at(-1);
const lastCmd = () => fake.calls.at(-1).cmd;
// حالة من المشغّل برقم آخر أمر
const emit = (s) => fake.listener({ cmd: lastCmd(), ...s });
const st = () => P.playerState();

describe('الأوامر إلى المشغّل الأصلي', () => {
  it('«تشغيل» يرسل المقدار مقاطعَ بالإعدادات، ولا يُنشئ عنصر صوت', () => {
    P.setSettings({ verseRepeat: 3, rangeRepeat: P.FOREVER });
    expect(P.play(q, [idx(1, 7), idx(2, 1)])).toBe('playing');
    const load = last('loadRange');
    expect(load).toMatchObject({ mode: 'start', pos: 0, verseRepeat: 3, rangeRepeat: 0, continuous: false, withBasmala: true, timerLeft: null });
    expect(load.artist).toBe('سعود الشريم');
    expect(load.items).toHaveLength(2);
    expect(load.items[0]).toEqual({
      f: ['https://everyayah.com/data/Saood_ash-Shuraym_128kbps/001007.mp3'],
      b: null,
      t: 'سورة س1 — الآية ٧',
      v: idx(1, 7),
      s: [idx(1, 7)],
    });
    // أول البقرة: بسملتها من ملف الفاتحة ١ بصوت القارئ
    expect(load.items[1].b).toBe('https://everyayah.com/data/Saood_ash-Shuraym_128kbps/001001.mp3');
    expect(load.items[1].t).toBe('سورة س2 — الآية ١');
    expect(FakeAudio.count).toBe(0);
    expect(st()).toMatchObject({ status: 'loading', v: idx(1, 7) });
  });

  it('لكل أمر رقم متزايد', () => {
    P.play(q, [idx(1, 1)]);
    P.pause();
    P.resume();
    const cmds = fake.calls.map((c) => c.cmd);
    expect(cmds).toEqual([...cmds].sort((a, b) => a - b));
    expect(new Set(cmds).size).toBe(cmds.length);
  });

  it('الإيقاف المؤقت والاستئناف والإيقاف التام', () => {
    P.play(q, [idx(1, 1), idx(1, 2)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    P.pause();
    expect(last('pause')).toBeTruthy();
    expect(st().status).toBe('paused');
    P.resume();
    expect(last('resume')).toBeTruthy();
    P.stop();
    expect(last('stop')).toBeTruthy();
    expect(st()).toMatchObject({ status: 'idle', v: null, vs: null });
  });

  it('تعديل المقدار أثناء التلاوة: الآية الجارية داخله ⇐ يكمل منها، وخارجه ⇐ يبدأ من أوله', () => {
    P.play(q, [idx(1, 1), idx(1, 2), idx(1, 3)]);
    emit({ status: 'playing', segment: 2, pos: 1, v: idx(1, 2), shown: [idx(1, 2)] });
    expect(P.retarget(q, [idx(1, 2), idx(1, 3), idx(1, 4)])).toBe('continued');
    expect(last('loadRange')).toMatchObject({ mode: 'continue', pos: 0 });
    expect(last('loadRange').items).toHaveLength(3);
    emit({ status: 'playing', segment: 2, pos: 0, v: idx(1, 2), shown: [idx(1, 2)] });
    expect(P.retarget(q, [idx(1, 5), idx(1, 6)])).toBe('playing');
    expect(last('loadRange')).toMatchObject({ mode: 'start', pos: 0 });
  });

  it('تغيير القارئ أثناء التلاوة: الآية نفسها بصوته، والبسملة إن كانت هي الجارية', () => {
    P.play(q, [idx(2, 1), idx(2, 2)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(2, 1), shown: [idx(2, 1)], basmala: true });
    P.setSettings({ reciter: 'husary' });
    const load = last('loadRange');
    expect(load).toMatchObject({ mode: 'restart', pos: 0, withBasmala: true });
    expect(load.items[0].f[0]).toMatch(/Husary_128kbps\/002001\.mp3$/);
    emit({ status: 'playing', segment: 3, pos: 1, v: idx(2, 2), shown: [idx(2, 2)], basmala: false });
    P.setSettings({ reciter: 'muaiqly' });
    expect(last('loadRange')).toMatchObject({ mode: 'restart', pos: 1, withBasmala: false });
  });

  it('تغيير التكرار أثناء التلاوة يُرسل إليه، وقبلها لا يُرسل شيء', () => {
    P.setSettings({ verseRepeat: 2 });
    expect(fake.calls).toHaveLength(0);
    P.play(q, [idx(1, 1)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    P.setSettings({ rangeRepeat: 5 });
    expect(last('setOptions')).toMatchObject({ verseRepeat: 2, rangeRepeat: 5 });
  });

  it('السابق والتالي', () => {
    P.play(q, [idx(1, 1), idx(1, 2)]);
    P.skip(1);
    expect(last('skip')).toMatchObject({ d: 1 });
  });
});

describe('حالة المشغّل الأصلي في الواجهة', () => {
  it('بدء كل ملف يظلّل آياته ويُعلم بالتقليب (n)، وتغيّر الحالة وحده لا يعدّ بدءًا', () => {
    P.play(q, [idx(1, 1), idx(1, 2)]);
    const n0 = st().n;
    emit({ status: 'loading', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    expect(st()).toMatchObject({ status: 'loading', v: idx(1, 1), vs: [idx(1, 1)], n: n0 + 1 });
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    expect(st()).toMatchObject({ status: 'playing', n: n0 + 1 });
    emit({ status: 'playing', segment: 2, pos: 1, v: idx(1, 2), shown: [idx(1, 2)] });
    expect(st()).toMatchObject({ v: idx(1, 2), n: n0 + 2 });
    // تكرار الآية نفسها ملف جديد
    emit({ status: 'playing', segment: 3, pos: 1, v: idx(1, 2), shown: [idx(1, 2)] });
    expect(st().n).toBe(n0 + 3);
  });

  it('تُهمل حالة سبقت آخر أوامر الصفحة', () => {
    P.play(q, [idx(1, 1)]);
    const old = lastCmd();
    P.pause();
    fake.listener({ cmd: old, status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    expect(st().status).toBe('paused');
  });

  it('انتهاء المؤقّت عند المشغّل: الرسالة، ويرجع إلى «بلا مؤقت»', () => {
    // الساعة ثابتة: بين ضبط المؤقّت وإرساله قد تمرّ ميلي ثانية فيخرج ٨٩٩٩٩٩ (فشل متقطّع في GitHub، ٢٠٢٦-١١-٢٣)
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-23T10:00:00') });
    P.setTimer(15);
    P.play(q, [idx(1, 1)]);
    expect(last('loadRange').timerLeft).toBe(15 * 60000);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)], timerLeft: 600000, counting: true });
    expect(st().timer).toMatchObject({ minutes: 15, left: 600000 });
    expect(P.timerLeft()).toBeGreaterThan(590000);
    emit({ status: 'idle', reason: 'timer' });
    expect(st()).toMatchObject({ status: 'idle', timer: null });
    expect(st().notice.text).toBe('انتهى مؤقّت التلاوة');
  });

  it('ضبط المؤقّت أو إلغاؤه أثناء التلاوة يُرسل إليه', () => {
    P.play(q, [idx(1, 1)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    P.setTimer(30);
    expect(last('setTimer')).toMatchObject({ left: 30 * 60000 });
    P.setTimer(null);
    expect(last('setTimer')).toMatchObject({ left: null });
  });

  it('خطأ التشغيل يظهر برسالته', () => {
    P.play(q, [idx(1, 1)]);
    emit({ status: 'idle', reason: 'error' });
    expect(st().error.text).toMatch(/تعذّر تشغيل الصوت/);
  });

  it('«إنهاء» من الإشعار يُرجع الواجهة إلى التوقف', () => {
    P.play(q, [idx(1, 1)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    emit({ status: 'idle', reason: 'stopped' });
    expect(st()).toMatchObject({ status: 'idle', v: null, vs: null });
  });

  it('فتح الصفحة والتلاوة جارية (بعد إغلاق التطبيق): تأخذ حالة المشغّل وتكمل أرقام الأوامر بعده', async () => {
    fake.state = { status: 'playing', cmd: 40, segment: 9, pos: 3, v: idx(1, 4), shown: [idx(1, 4)] };
    vi.resetModules();
    P = await import('../../src/lib/player.js');
    await flush();
    expect(st()).toMatchObject({ status: 'playing', v: idx(1, 4) });
    P.pause();
    expect(last('pause').cmd).toBeGreaterThan(40);
    // والرجوع إلى التطبيق من الخلفية يعيد قراءة حالته
    expect(fake.appListeners.map((l) => l.name)).toContain('resume');
  });

  it('معاينة القارئ توقف التلاوة مؤقتًا ثم تستأنفها', () => {
    P.play(q, [idx(1, 1)]);
    emit({ status: 'playing', segment: 1, pos: 0, v: idx(1, 1), shown: [idx(1, 1)] });
    P.previewReciter('muaiqly');
    expect(last('pause')).toBeTruthy();
    expect(st().status).toBe('paused');
    FakeAudio.last.dispatchEvent(new Event('ended'));
    expect(last('resume')).toBeTruthy();
  });
});
