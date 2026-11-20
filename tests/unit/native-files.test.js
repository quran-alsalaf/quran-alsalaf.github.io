// حفظ الصوت على الجهاز داخل تطبيق أندرويد (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠): تحميل القارئ لكامل القرآن يقوم به أندرويد
// (إضافة QuranDownloads)، و«تنزيل» المقدار يُحفظ في ملفات الجهاز. هنا الإضافة محاكاة تسجّل الأوامر وتُرسل الأحداث باليد
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  calls: [],
  listeners: {},
  state: { items: {}, active: null, queue: [] },
  startResult: 'started',
  saveResult: 'ok',
  missing: 0,
  mb: 1234,
  onSave: null,
}));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = {
    addListener: (name, fn) => {
      (fake.listeners[name] ??= []).push(fn);
      return Promise.resolve({
        remove() {
          fake.listeners[name] = fake.listeners[name].filter((f) => f !== fn);
        },
      });
    },
    getState: () => Promise.resolve(fake.state),
    start: (args) => {
      fake.calls.push({ method: 'start', ...args });
      return Promise.resolve({ result: fake.startResult });
    },
    pause: (args) => {
      fake.calls.push({ method: 'pause', ...args });
      return Promise.resolve();
    },
    saveFiles: async (args) => {
      fake.calls.push({ method: 'saveFiles', ...args });
      if (fake.onSave) await fake.onSave(args);
      return { result: fake.saveResult };
    },
    cancelFiles: () => {
      fake.calls.push({ method: 'cancelFiles' });
      return Promise.resolve();
    },
    missing: (args) => {
      fake.calls.push({ method: 'missing', ...args });
      return Promise.resolve({ count: fake.missing });
    },
    freeSpace: () => Promise.resolve({ mb: fake.mb }),
    // مشغّل التلاوة (QuranAudio): لا يُختبر هنا
    loadRange: () => Promise.resolve(),
  };
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
});
vi.mock('@capacitor/app', () => ({ App: { addListener: () => Promise.resolve({ remove() {} }) } }));

const fire = (name, data) => (fake.listeners[name] ?? []).forEach((fn) => fn(data));
const flush = () => new Promise((r) => setTimeout(r, 0));
const last = (method) => fake.calls.filter((c) => c.method === method).at(-1);

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

let O;
let P;
beforeEach(async () => {
  localStorage.clear();
  Object.assign(fake, { calls: [], listeners: {}, state: { items: {}, active: null, queue: [] }, startResult: 'started', saveResult: 'ok', missing: 0, mb: 1234, onSave: null });
  vi.resetModules();
  O = await import('../../src/lib/offline.js');
  P = await import('../../src/lib/player.js');
});

describe('تحميل القارئ لكامل القرآن داخل التطبيق', () => {
  it('يرسل إلى أندرويد روابط ملفات القارئ كلها واسمه، فيحمّلها هو', async () => {
    expect(O.supported()).toBe(true);
    expect(O.nativeSaving()).toBe(true);
    expect(await O.startDownload('husary')).toBe('started');
    const call = last('start');
    expect(call.id).toBe('husary');
    expect(call.name).toBe('محمود خليل الحصري');
    expect(call.urls).toHaveLength(6236);
    expect(call.urls[0]).toMatch(/001001\.mp3$/);
    // لا شيء في ذاكرة المتصفح
    expect(O.hasOfflineFiles('husary')).toBe(false);
  });

  it('الحالة من أندرويد: التقدّم، والانتظار، وانتظار الاتصال، والاكتمال', async () => {
    O.verifyDownloads();
    await flush();
    fire('state', { items: { husary: { status: 'downloading', count: 100, total: 6236 }, afs: { status: 'queued', count: 0, total: 6236 } }, active: 'husary', queue: ['afs'] });
    expect(O.offlineState().active).toBe('husary');
    expect(O.offlineState().items.afs.status).toBe('queued');
    expect(O.offlineState().queue).toEqual(['afs']);
    fire('state', { items: { husary: { status: 'downloading', count: 120, total: 6236, waiting: true } }, active: 'husary', queue: [] });
    expect(O.offlineState().items.husary.waiting).toBe(true);
    expect(O.isOfflineComplete('husary')).toBe(false);
    fire('state', { items: { husary: { status: 'done', count: 6236, total: 6236 } }, active: null, queue: [] });
    expect(O.isOfflineComplete('husary')).toBe(true);
  });

  it('الحالة المحفوظة تُقرأ من أندرويد عند الفتح، لا من ذاكرة المتصفح', async () => {
    localStorage.setItem('hq.offline', JSON.stringify({ husary: { status: 'done', count: 6236, total: 6236 } }));
    fake.state = { items: { afs: { status: 'done', count: 6236, total: 6236 } }, active: null, queue: [] };
    vi.resetModules();
    O = await import('../../src/lib/offline.js');
    await O.verifyDownloads();
    expect(O.isOfflineComplete('afs')).toBe(true);
    expect(O.isOfflineComplete('husary')).toBe(false);
  });

  it('قارئ ثانٍ أثناء تحميل غيره ينتظر دوره، والإيقاف بالمعرّف', async () => {
    fake.startResult = 'queued';
    expect(await O.startDownload('afs')).toBe('queued');
    await O.pauseDownload('afs');
    expect(last('pause')).toMatchObject({ id: 'afs' });
  });

  it('رسالة عند انتهاء تحميل قارئ، أينما كان المستخدم', async () => {
    const got = [];
    O.onOfflineNotice((t) => got.push(t));
    O.verifyDownloads();
    await flush();
    fire('notice', { id: 'husary', result: 'done' });
    fire('notice', { id: 'husary', result: 'nospace' });
    fire('notice', { id: 'husary', result: 'timeout' });
    expect(got[0]).toBe('اكتمل تحميل تلاوة محمود خليل الحصري — تعمل الآن بلا إنترنت');
    expect(got[1]).toContain('لا تكفي المساحة');
    expect(got[2]).toContain('أكمله بزرّ الاستئناف');
  });

  it('المساحة المتاحة من الجهاز نفسه', async () => {
    expect(await O.freeSpaceMB()).toBe(1234);
  });
});

describe('«تنزيل» المقدار داخل التطبيق', () => {
  it('يحفظ ملفات المقدار في الجهاز، ويعرض تقدّمه، ثم «تم تنزيله»', async () => {
    const seen = [];
    fake.onSave = async () => {
      fire('files', { saved: 0, total: 2 });
      seen.push(P.playerState().download);
      fire('files', { saved: 1, total: 2 });
      seen.push(P.playerState().download);
    };
    const result = await P.downloadRange(q, [idx(1, 7), idx(2, 1)]);
    expect(result).toBe('ok');
    const urls = last('saveFiles').urls;
    // آيتا المقدار وبسملة البقرة بصوت القارئ
    expect(urls).toEqual([
      'https://everyayah.com/data/Saood_ash-Shuraym_128kbps/001007.mp3',
      'https://everyayah.com/data/Saood_ash-Shuraym_128kbps/002001.mp3',
      'https://everyayah.com/data/Saood_ash-Shuraym_128kbps/001001.mp3',
    ]);
    expect(seen[0]).toMatchObject({ active: true, fileIndex: 1, fileCount: 2 });
    expect(seen[1]).toMatchObject({ active: true, fileIndex: 2, fileCount: 2 });
    expect(P.playerState().download).toMatchObject({ active: false, done: true });
    // لا يبقى مستمع بعد الانتهاء
    expect(fake.listeners.files).toHaveLength(0);
  });

  it('ضيق المساحة وتعذّر التنزيل', async () => {
    fake.saveResult = 'nospace';
    expect(await P.downloadRange(q, [idx(1, 1)])).toBe('nospace');
    expect(P.playerState().download).toBe(null);
    fake.saveResult = 'failed';
    expect(await P.downloadRange(q, [idx(1, 1)])).toBe('failed');
  });

  it('الإلغاء يوقف الحفظ في أندرويد', async () => {
    let release;
    fake.onSave = () => new Promise((r) => (release = r));
    const pending = P.downloadRange(q, [idx(1, 1)]);
    await flush();
    P.cancelDownload();
    expect(last('cancelFiles')).toBeTruthy();
    fake.saveResult = 'cancelled';
    release();
    expect(await pending).toBe('cancelled');
    expect(P.playerState().download).toBe(null);
  });

  it('«تم تنزيله» إذا كانت ملفات المقدار كلها محفوظة على الجهاز (يُسأل أندرويد)', async () => {
    fake.missing = 1;
    expect(await P.isDownloaded(q, [idx(1, 1)])).toBe(false);
    expect(last('missing').urls).toEqual(['https://everyayah.com/data/Saood_ash-Shuraym_128kbps/001001.mp3']);
    fake.missing = 0;
    expect(await P.isDownloaded(q, [idx(1, 1)])).toBe(true);
  });

  it('القارئ المحمَّل كاملًا: كل مقدار منزَّل بلا سؤال', async () => {
    O.verifyDownloads();
    await flush();
    fire('state', { items: { shuraym: { status: 'done', count: 6236, total: 6236 } }, active: null, queue: [] });
    fake.calls = [];
    expect(await P.isDownloaded(q, [idx(1, 1)])).toBe(true);
    expect(last('missing')).toBeUndefined();
  });
});
