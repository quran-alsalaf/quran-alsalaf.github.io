// التطبيق الأصلي (أندرويد، Capacitor): زرّ الرجوع، وملفات الويب المنسوخة للتطبيق، وما يختلف داخله عن الموقع
// (روابط التفاسير المحمَّلة، ومشاركة الملاحظة، وملف النسخة الاحتياطية)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capacitor.isNativePlatform يُتحكَّم فيه من الاختبار: false كالموقع، true كالتطبيق
const native = vi.hoisted(() => ({ on: false, shared: [], files: [], cancel: false }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => native.on } };
});
vi.mock('@capacitor/share', () => ({
  Share: {
    share: async (opts) => {
      if (native.cancel) throw new Error('Share canceled');
      native.shared.push(opts);
    },
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: async (opts) => {
      native.files.push(opts);
      return { uri: `file:///cache/${opts.path}` };
    },
  },
}));

const { createBackHandler, EXIT_WINDOW_MS, leaveBackMode, pushBackMode, SITE_URL } = await import('../../src/lib/native.js');
const { closeTopLayer } = await import('../../src/lib/layers.js');
const { keepInNative, nativeIndexHtml } = await import('../../scripts/native-web.mjs');
const { tafsirUrls } = await import('../../src/lib/tafsirDownload.js');
const { shareText } = await import('../../src/lib/userdata.js');
const { deliverBackup } = await import('../../src/lib/backupFile.js');

beforeEach(() => {
  native.on = false;
  native.shared = [];
  native.files = [];
  native.cancel = false;
});

describe('زرّ الرجوع في أندرويد', () => {
  function setup({ layers = 0, mode = false, chrome = false } = {}) {
    const state = { layers, mode, chrome, hints: 0, exits: 0, t: 0 };
    const back = createBackHandler({
      closeLayer: () => (state.layers > 0 ? (state.layers--, true) : false),
      leaveMode: () => (state.mode ? ((state.mode = false), true) : false),
      hideChrome: () => (state.chrome ? ((state.chrome = false), true) : false),
      hint: () => state.hints++,
      exit: () => state.exits++,
      now: () => state.t,
    });
    return { state, back };
  }

  it('يغلق الطبقات المفتوحة واحدة واحدة قبل أي شيء آخر', () => {
    const { state, back } = setup({ layers: 2, mode: true, chrome: true });
    expect(back()).toBe('layer');
    expect(back()).toBe('layer');
    expect(state.layers).toBe(0);
    expect(state.mode).toBe(true);
    expect(state.exits).toBe(0);
  });

  it('ثم يخرج من وضع القراءة، ثم يخفي الأزرار العائمة', () => {
    const { state, back } = setup({ mode: true, chrome: true });
    expect(back()).toBe('mode');
    expect(back()).toBe('chrome');
    expect(state.chrome).toBe(false);
    expect(state.hints).toBe(0);
  });

  it('لا يخرج من التطبيق من أول ضغطة: رسالة «اضغط مرة أخرى للخروج»', () => {
    const { state, back } = setup();
    expect(back()).toBe('hint');
    expect(state.hints).toBe(1);
    expect(state.exits).toBe(0);
  });

  it('الضغطة الثانية خلال ثانيتين تخرج، وبعدهما رسالة جديدة', () => {
    const { state, back } = setup();
    back();
    state.t = EXIT_WINDOW_MS - 1;
    expect(back()).toBe('exit');
    expect(state.exits).toBe(1);

    state.t = 10_000;
    expect(back()).toBe('hint');
    state.t += EXIT_WINDOW_MS + 1;
    expect(back()).toBe('hint');
    expect(state.exits).toBe(1);
  });

  it('طبقة فُتحت بين الضغطتين تُغلق ولا يخرج التطبيق', () => {
    const { state, back } = setup();
    back();
    state.layers = 1;
    state.t = 100;
    expect(back()).toBe('layer');
    expect(state.exits).toBe(0);
  });

  it('أوضاع الرجوع كومة: يخرج من آخرها، ويُفك تسجيله', () => {
    const left = [];
    const offA = pushBackMode(() => left.push('a'));
    const offB = pushBackMode(() => left.push('b'));
    expect(leaveBackMode()).toBe(true);
    expect(left).toEqual(['b']);
    offB();
    leaveBackMode();
    expect(left).toEqual(['b', 'a']);
    offA();
    expect(leaveBackMode()).toBe(false);
  });

  it('closeTopLayer بلا طبقة مفتوحة لا يفعل شيئًا', () => {
    expect(closeTopLayer()).toBe(false);
  });
});

describe('ملفات الويب للتطبيق (scripts/native-web.mjs)', () => {
  it('يُحذف عامل الخدمة والتفاسير المحمَّلة وصفحة المعاينة، ويبقى الباقي', () => {
    for (const p of ['sw.js', 'registerSW.js', 'sw-recover.js', 'manifest.webmanifest', 'workbox-63c18b4d.js', 'preview', 'preview/index.html', 'data/tafsir', 'data/tafsir/tabary/2.json']) {
      expect(keepInNative(p), p).toBe(false);
    }
    for (const p of ['index.html', 'assets/index.js', 'data/quran.json', 'data/tafsir-muyassar.json', 'data/warsh/quran.json', 'fonts/qcf4/p1.woff2', 'fonts/qcf4-warsh/p604.woff2', 'audio/preview/x/001002.mp3', 'icons/icon-192.png']) {
      expect(keepInNative(p), p).toBe(true);
    }
  });

  it('صفحة التطبيق بلا تسجيل عامل الخدمة ولا رابط الـ manifest، وعلى <html> علامة التطبيق الأصلي', () => {
    const html =
      '<!doctype html><html lang="ar" dir="rtl"><head><link rel="manifest" href="./manifest.webmanifest"><title>x</title></head><body><script id="vite-plugin-pwa:register-sw" src="./registerSW.js"></script></body>';
    const out = nativeIndexHtml(html);
    expect(out).not.toMatch(/manifest|registerSW/);
    expect(out).toContain('<title>x</title>');
    expect(out).toContain('<html data-native="android" lang="ar" dir="rtl">');
  });
});

describe('داخل التطبيق وفي الموقع', () => {
  afterEach(() => {
    native.on = false;
  });

  it('التفاسير المحمَّلة: من الموقع المنشور داخل التطبيق، ومن الموقع نفسه في الموقع', () => {
    expect(tafsirUrls('baghawy')[0]).not.toContain(SITE_URL);
    native.on = true;
    const urls = tafsirUrls('baghawy');
    expect(urls).toHaveLength(114);
    expect(urls[0]).toBe(`${SITE_URL}data/tafsir/baghawy/1.json`);
    expect(urls[113]).toBe(`${SITE_URL}data/tafsir/baghawy/114.json`);
  });

  it('مشاركة الملاحظة داخل التطبيق بقائمة مشاركة أندرويد', async () => {
    native.on = true;
    expect(await shareText('نص الملاحظة')).toBe('shared');
    expect(native.shared).toEqual([{ text: 'نص الملاحظة' }]);
    native.cancel = true;
    expect(await shareText('نص')).toBe('cancelled');
  });

  it('ملف النسخة الاحتياطية داخل التطبيق: يُكتب ثم يُشارك، والإلغاء لا يُعدّ نسخة', async () => {
    native.on = true;
    expect(await deliverBackup('{"a":1}', 'نسخة.json')).toBe('shared');
    expect(native.files).toEqual([{ path: 'نسخة.json', data: '{"a":1}', directory: 'CACHE', encoding: 'utf8' }]);
    expect(native.shared).toEqual([{ files: ['file:///cache/نسخة.json'], title: 'نسخة.json' }]);
    native.cancel = true;
    expect(await deliverBackup('{}', 'ب.json')).toBe('cancelled');
  });
});
