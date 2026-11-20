// «رأيك يهمنا» (الجلسة ٣ ب، ٢٠٢٦-١١-٢٠): نص المشاركة ورابطها، ورسالة واتساب الجاهزة، ونافذة التقييم التلقائية
// (مرة واحدة بعد إتمام مهمة ختمة أو بعد ٧ أيام من أول استعمال) — src/lib/feedback.js
import React, { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ native: false, calls: [] }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = {
    requestReview: () => {
      fake.calls.push('requestReview');
      return Promise.resolve();
    },
    openStore: () => {
      fake.calls.push('openStore');
      return Promise.resolve();
    },
    openUrl: ({ url }) => {
      fake.calls.push(`openUrl ${url}`);
      return Promise.resolve();
    },
    deviceInfo: () => Promise.resolve({ version: '1.0', manufacturer: 'samsung', model: 'SM-A546E', android: '14' }),
  };
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => fake.native }, registerPlugin: () => plugin };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.React = React;

const DAY = 24 * 60 * 60 * 1000;
let F;
beforeEach(async () => {
  Object.assign(fake, { native: false, calls: [] });
  localStorage.clear();
  vi.resetModules();
  F = await import('../../src/lib/feedback.js');
});

describe('المشاركة', () => {
  it('النص المعتمد، ورابط المتجر داخل التطبيق ورابط الموقع في الموقع', () => {
    expect(F.SHARE_TEXT).toBe('قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.');
    expect(F.shareMessage(true)).toBe(`${F.SHARE_TEXT}\nhttps://play.google.com/store/apps/details?id=com.quranalsalaf.app`);
    expect(F.shareMessage(false)).toBe(`${F.SHARE_TEXT}\nhttps://quran-alsalaf.github.io/`);
  });
});

describe('التواصل', () => {
  it('رسالة التنبيه والرقم كما اعتُمدا', () => {
    expect(F.CONTACT_NOTE).toBe(
      'هذا التطبيق تم إنشاؤه بمساعدة الذكاء الاصطناعي، فإذا وجدت أي أخطاء أو كانت لديك اقتراحات فتواصل معنا من فضلك.'
    );
    expect(F.WHATSAPP_SHOWN).toBe('0548470724');
  });

  it('سطر المعلومات: نسخة التطبيق والجهاز والرواية، وفي الموقع «الموقع»', () => {
    expect(F.contactInfo({ native: true, version: '1.0', manufacturer: 'samsung', model: 'SM-A546E', android: '14', riwayah: 'warsh' })).toBe(
      'قرآن السلف 1.0 (أندرويد 14 · samsung SM-A546E) · رواية ورش'
    );
    expect(F.contactInfo({ native: true, riwayah: 'hafs' })).toBe('قرآن السلف (أندرويد) · رواية حفص');
    expect(F.contactInfo({ native: false, riwayah: null })).toBe('قرآن السلف (الموقع) · رواية حفص');
  });

  it('رابط واتساب بالرقم الدولي والرسالة الجاهزة', () => {
    const text = F.contactMessage({ native: false, riwayah: 'hafs' });
    expect(text.startsWith('السلام عليكم،')).toBe(true);
    expect(text.endsWith('قرآن السلف (الموقع) · رواية حفص')).toBe(true);
    const url = new URL(F.whatsappUrl(text));
    expect(url.origin + url.pathname).toBe('https://wa.me/966548470724');
    expect(url.searchParams.get('text')).toBe(text);
  });

  it('داخل التطبيق: معلومات الجهاز من أندرويد، وواتساب يُفتح بأندرويد نفسه', async () => {
    fake.native = true;
    expect(await F.deviceInfo()).toEqual({ native: true, version: '1.0', manufacturer: 'samsung', model: 'SM-A546E', android: '14' });
    await F.openExternal('https://wa.me/966548470724');
    expect(fake.calls).toEqual(['openUrl https://wa.me/966548470724']);
  });

  it('في الموقع: لا معلومات جهاز، والرابط بنافذة جديدة', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(await F.deviceInfo()).toEqual({ native: false });
    await F.openExternal('https://wa.me/966548470724');
    expect(open).toHaveBeenCalledWith('https://wa.me/966548470724', '_blank', 'noopener');
    expect(fake.calls).toEqual([]);
    open.mockRestore();
  });
});

describe('موعد نافذة التقييم', () => {
  const now = Date.UTC(2026, 10, 20);
  it('بعد إتمام مهمة: فورًا ولو في أول يوم', () => {
    expect(F.rateDue({ first: now }, { now, task: true })).toBe(true);
    expect(F.rateDue({}, { now, task: true })).toBe(true);
  });
  it('عند الفتح: بعد ٧ أيام من أول استعمال، لا قبلها', () => {
    expect(F.rateDue({ first: now }, { now })).toBe(false);
    expect(F.rateDue({ first: now }, { now: now + 7 * DAY - 1 })).toBe(false);
    expect(F.rateDue({ first: now }, { now: now + 7 * DAY })).toBe(true);
    expect(F.rateDue({}, { now })).toBe(false);
  });
  it('مرة واحدة: لا تعود بعد أن طُلبت', () => {
    expect(F.rateDue({ first: now, asked: true }, { now: now + 30 * DAY })).toBe(false);
    expect(F.rateDue({ first: now, asked: true }, { now, task: true })).toBe(false);
  });
  it('أول استعمال يُسجَّل مرة ولا يتغيّر بعدها', () => {
    F.noteFirstUse(now);
    F.noteFirstUse(now + DAY);
    expect(F.readRate()).toEqual({ first: now });
    F.markAsked();
    expect(F.readRate()).toEqual({ first: now, asked: true });
  });
  it('التقييم في التطبيق الأصلي وحده', () => {
    expect(F.ratingAvailable()).toBe(false);
    fake.native = true;
    expect(F.ratingAvailable()).toBe(true);
  });
});

describe('إتمام مهام الختمة يُعلَن', () => {
  it('إتمام الورد يطلق الحدث', async () => {
    const K = await import('../../src/lib/khatma.js');
    const seen = vi.fn();
    window.addEventListener(K.TASK_DONE, seen);
    K.startWird('days', 30, '2026-11-20');
    K.completeWird('2026-11-20');
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(K.TASK_DONE, seen);
  });
});

// ---------- النافذة التلقائية في التطبيق ----------
describe('useRatePrompt', () => {
  let root;
  let el;
  let layers;
  const props = { ready: true, busy: false };
  function Host(p) {
    F.useRatePrompt(p);
    return null;
  }
  const render = (p = props) => act(() => root.render(h(Host, p)));

  beforeEach(async () => {
    fake.native = true;
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 20, 9), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    layers = await import('../../src/lib/layers.js');
    el = document.createElement('div');
    document.body.append(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.useRealTimers();
  });
  const wait = (ms) => act(() => vi.advanceTimersByTime(ms));
  const reviews = () => fake.calls.filter((c) => c === 'requestReview').length;

  it('أول فتح: يُسجَّل أول استعمال ولا نافذة', async () => {
    await render();
    await wait(60_000);
    expect(reviews()).toBe(0);
    expect(F.readRate().first).toBe(Date.now() - 60_000);
  });

  it('فتح بعد ٧ أيام: تظهر بعد مهلة مرة واحدة، ولا تعود عند فتح آخر', async () => {
    localStorage.setItem(F.RATE_KEY, JSON.stringify({ first: Date.now() - 8 * DAY }));
    await render();
    await wait(F.RATE_DELAY_MS - 1);
    expect(reviews()).toBe(0);
    await wait(1);
    expect(reviews()).toBe(1);
    expect(F.readRate().asked).toBe(true);
    await wait(60_000);
    expect(reviews()).toBe(1);
    await act(() => root.unmount());
    root = createRoot(el);
    await render();
    await wait(60_000);
    expect(reviews()).toBe(1);
  });

  it('لا تظهر أثناء التلاوة أو الأوضاع، ولا قبل استقرار التطبيق، وتظهر حين يستقر', async () => {
    localStorage.setItem(F.RATE_KEY, JSON.stringify({ first: Date.now() - 8 * DAY }));
    await render({ ready: false, busy: false });
    await wait(10_000);
    await render({ ready: true, busy: true });
    await wait(10_000);
    expect(reviews()).toBe(0);
    await render({ ready: true, busy: false });
    await wait(F.RATE_DELAY_MS);
    expect(reviews()).toBe(1);
  });

  it('عند الفتح لا تظهر وطبقة مفتوحة فوق المصحف، وتظهر بعد إغلاقها', async () => {
    localStorage.setItem(F.RATE_KEY, JSON.stringify({ first: Date.now() - 8 * DAY }));
    function Layer({ open }) {
      layers.useLayer(() => {}, open);
      return null;
    }
    const el2 = document.createElement('div');
    const root2 = createRoot(el2);
    await act(() => root2.render(h(Layer, { open: true })));
    await render();
    await wait(10_000);
    expect(reviews()).toBe(0);
    await act(() => root2.render(h(Layer, { open: false })));
    await wait(F.RATE_DELAY_MS);
    expect(reviews()).toBe(1);
    await act(() => root2.unmount());
  });

  it('إتمام مهمة ختمة: تظهر بعد مهلة قصيرة ولو كانت القائمة مفتوحة، ومرة واحدة', async () => {
    function Layer() {
      layers.useLayer(() => {});
      return null;
    }
    const el2 = document.createElement('div');
    const root2 = createRoot(el2);
    await act(() => root2.render(h(Layer)));
    await render();
    const K = await import('../../src/lib/khatma.js');
    await act(() => K.announceTaskDone());
    await wait(F.TASK_DELAY_MS);
    expect(reviews()).toBe(1);
    await act(() => K.announceTaskDone());
    await wait(60_000);
    expect(reviews()).toBe(1);
    await act(() => root2.unmount());
  });

  it('إتمام مهمة أثناء التلاوة: تنتظر حتى تقف التلاوة', async () => {
    await render({ ready: true, busy: true });
    const K = await import('../../src/lib/khatma.js');
    await act(() => K.announceTaskDone());
    await wait(10_000);
    expect(reviews()).toBe(0);
    await render({ ready: true, busy: false });
    await wait(F.RATE_DELAY_MS);
    expect(reviews()).toBe(1);
  });

  it('في الموقع: لا شيء', async () => {
    fake.native = false;
    localStorage.setItem(F.RATE_KEY, JSON.stringify({ first: Date.now() - 8 * DAY }));
    await render();
    const K = await import('../../src/lib/khatma.js');
    await act(() => K.announceTaskDone());
    await wait(60_000);
    expect(reviews()).toBe(0);
  });
});
