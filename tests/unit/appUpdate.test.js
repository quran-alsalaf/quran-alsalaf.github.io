// تنبيه التحديث (٢٠٢٦-١١-٢٣): نافذة جوجل بلاي إن نُشرت نسخة أحدث، والرفض يُحترم ٣ أيام للنسخة نفسها،
// وشريط «التحديث جاهز» بعد اكتمال التنزيل — src/lib/appUpdate.js
import React, { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  native: false,
  calls: [],
  info: { available: false, downloaded: false },
  accept: true,
  listeners: {},
  resume: null,
}));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = {
    check: () => {
      fake.calls.push('check');
      return Promise.resolve(fake.info);
    },
    start: () => {
      fake.calls.push('start');
      return Promise.resolve({ accepted: fake.accept });
    },
    complete: () => {
      fake.calls.push('complete');
      return Promise.resolve();
    },
    addListener: (name, fn) => {
      fake.listeners[name] = fn;
      return Promise.resolve({ remove: () => delete fake.listeners[name] });
    },
  };
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => fake.native }, registerPlugin: () => plugin };
});
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name, fn) => {
      if (name === 'resume') fake.resume = fn;
      return Promise.resolve({ remove: () => (fake.resume = null) });
    },
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.React = React;

const DAY = 24 * 60 * 60 * 1000;
let U;
beforeEach(async () => {
  Object.assign(fake, { native: false, calls: [], info: { available: false, downloaded: false }, accept: true, listeners: {}, resume: null });
  localStorage.clear();
  vi.resetModules();
  U = await import('../../src/lib/appUpdate.js');
});

describe('موعد نافذة التحديث', () => {
  const now = Date.UTC(2026, 10, 23);
  const info = { available: true, versionCode: 2, downloaded: false };
  it('لا نافذة إذا لم توجد نسخة أحدث، أو كانت منزَّلة تنتظر التثبيت', () => {
    expect(U.updateDue({ available: false }, {}, now)).toBe(false);
    expect(U.updateDue(null, {}, now)).toBe(false);
    expect(U.updateDue({ ...info, downloaded: true }, {}, now)).toBe(false);
  });
  it('نسخة أحدث لم تُرفض: تُعرض', () => {
    expect(U.updateDue(info, {}, now)).toBe(true);
  });
  it('رفض النسخة نفسها: لا تُعاد قبل ٣ أيام، وتُعاد بعدها', () => {
    const rec = { declined: 2, at: now };
    expect(U.DECLINE_DAYS).toBe(3);
    expect(U.updateDue(info, rec, now + 3 * DAY - 1)).toBe(false);
    expect(U.updateDue(info, rec, now + 3 * DAY)).toBe(true);
  });
  it('نسخة أحدث من المرفوضة: تُعرض فورًا', () => {
    expect(U.updateDue({ ...info, versionCode: 3 }, { declined: 2, at: now }, now)).toBe(true);
  });
  it('الرفض يُسجَّل برقم النسخة، والقبول لا يُسجَّل', async () => {
    fake.native = true;
    fake.accept = false;
    expect(await U.startUpdate(info)).toBe(false);
    expect(U.readUpdate()).toMatchObject({ declined: 2 });
    localStorage.clear();
    fake.accept = true;
    expect(await U.startUpdate(info)).toBe(true);
    expect(U.readUpdate()).toEqual({});
  });
});

describe('useAppUpdate', () => {
  let root;
  let el;
  let out;
  const props = { ready: true, busy: false };
  function Host(p) {
    out = U.useAppUpdate(p);
    return null;
  }
  const render = (p = props) => act(() => root.render(h(Host, p)));
  const wait = (ms) => act(async () => vi.advanceTimersByTimeAsync(ms));
  const count = (c) => fake.calls.filter((x) => x === c).length;

  beforeEach(() => {
    fake.native = true;
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 23, 9), toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    el = document.createElement('div');
    document.body.append(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.useRealTimers();
  });

  it('في الموقع: لا سؤال لجوجل ولا شريط', async () => {
    fake.native = false;
    fake.info = { available: true, versionCode: 2 };
    await render();
    await wait(60_000);
    expect(fake.calls).toEqual([]);
    expect(out.ready).toBe(false);
  });

  it('بلا نسخة أحدث: يُسأل مرة واحدة ولا نافذة ولا شريط', async () => {
    await render();
    await wait(60_000);
    expect(count('check')).toBe(1);
    expect(count('start')).toBe(0);
    expect(out.ready).toBe(false);
  });

  it('نسخة أحدث: النافذة بعد مهلة مرة واحدة، والشريط بعد اكتمال التنزيل لا قبله', async () => {
    fake.info = { available: true, versionCode: 2, downloaded: false };
    await render();
    await wait(U.CHECK_DELAY_MS - 1);
    expect(count('check')).toBe(0);
    await wait(1);
    expect(count('start')).toBe(1);
    await act(async () => fake.listeners.state({ status: 'downloading' }));
    expect(out.ready).toBe(false);
    await act(async () => fake.listeners.state({ status: 'downloaded' }));
    expect(out.ready).toBe(true);
    await act(async () => out.install());
    expect(count('complete')).toBe(1);
    expect(out.ready).toBe(false);
    await wait(60_000);
    expect(count('start')).toBe(1);
  });

  it('لا نافذة قبل استقرار التطبيق ولا أثناء التلاوة، وتظهر حين يستقر', async () => {
    fake.info = { available: true, versionCode: 2 };
    await render({ ready: false, busy: false });
    await wait(20_000);
    await render({ ready: true, busy: true });
    await wait(20_000);
    expect(fake.calls).toEqual([]);
    await render({ ready: true, busy: false });
    await wait(U.CHECK_DELAY_MS);
    expect(count('start')).toBe(1);
  });

  it('رُفضت قبل يوم: لا نافذة للنسخة نفسها', async () => {
    fake.info = { available: true, versionCode: 2 };
    localStorage.setItem(U.UPDATE_KEY, JSON.stringify({ declined: 2, at: Date.now() - DAY }));
    await render();
    await wait(60_000);
    expect(count('check')).toBe(1);
    expect(count('start')).toBe(0);
  });

  it('فتح التطبيق والتحديث منزَّل لم يُثبَّت: الشريط بلا نافذة، و✕ يخفيه', async () => {
    fake.info = { available: true, versionCode: 2, downloaded: true };
    await render();
    await wait(U.CHECK_DELAY_MS);
    expect(count('start')).toBe(0);
    expect(out.ready).toBe(true);
    await act(async () => out.dismiss());
    expect(out.ready).toBe(false);
    expect(count('complete')).toBe(0);
  });

  it('الرجوع إلى التطبيق وقد اكتمل التنزيل: يظهر الشريط', async () => {
    await render();
    await wait(U.CHECK_DELAY_MS);
    expect(out.ready).toBe(false);
    fake.info = { available: true, versionCode: 2, downloaded: true };
    await act(async () => fake.resume());
    expect(out.ready).toBe(true);
  });
});
