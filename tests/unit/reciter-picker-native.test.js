// صفحة اختيار القارئ داخل تطبيق أندرويد (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠): التأكيد لا يطلب إبقاء التطبيق مفتوحًا،
// وتحميل قارئ أثناء تحميل غيره يضعه «بالانتظار»، والضغط على زرّه يخرجه منه، و«ينتظر الاتصال» إذا انقطع
import React, { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ calls: [], listeners: {}, state: { items: {}, active: null, queue: [] }, startResult: 'started' }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = {
    addListener: (name, fn) => {
      (fake.listeners[name] ??= []).push(fn);
      return Promise.resolve({ remove() {} });
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
    freeSpace: () => Promise.resolve({ mb: 50 }),
  };
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
});
vi.mock('@capacitor/app', () => ({ App: { addListener: () => Promise.resolve({ remove() {} }) } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// مكوّنات التطبيق بـJSX، واختبارات الوحدات بلا إضافة React في Vite
globalThis.React = React;
// حدث من أندرويد؛ والحالة نفسها تُعاد إذا سألته الصفحة بعده (getState)
const fire = (name, data) =>
  act(() => {
    if (name === 'state') fake.state = data;
    (fake.listeners[name] ?? []).forEach((fn) => fn(data));
  });
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

let Picker;
let root;
let el;
let toasts;
beforeEach(async () => {
  Object.assign(fake, { calls: [], listeners: {}, state: { items: {}, active: null, queue: [] }, startResult: 'started' });
  vi.resetModules();
  Picker = (await import('../../src/components/ReciterPicker.jsx')).default;
  el = document.createElement('div');
  document.body.append(el);
  root = createRoot(el);
  toasts = [];
  await act(() => root.render(h(Picker, { chosen: 'shuraym', suras: [1], onPick() {}, onClose() {}, onToast: (t) => toasts.push(t) })));
  await tick();
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

const button = (label) => el.querySelector(`button[aria-label="${label}"]`);

describe('التحميل داخل التطبيق', () => {
  it('التأكيد: يستمر التحميل والشاشة مقفلة، والمساحة من الجهاز', async () => {
    await act(() => button('تحميل محمود خليل الحصري لكامل القرآن').click());
    await tick();
    const dlg = el.querySelector('.rcpick__confirm');
    expect(dlg.textContent).toContain('يستمر التحميل ولو قُفلت الشاشة أو أُغلق التطبيق');
    expect(dlg.textContent).not.toContain('إبقاء التطبيق مفتوحًا');
    expect(dlg.textContent).toContain('المساحة المتاحة على الجهاز');
    await act(() => dlg.querySelector('.rcpick__btn--primary').click());
    await tick();
    expect(fake.calls.at(-1)).toMatchObject({ method: 'start', id: 'husary' });
  });

  it('قارئ آخر أثناء التحميل: بالانتظار، لا «أوقفه أولًا»', async () => {
    await fire('state', { items: { husary: { status: 'downloading', count: 624, total: 6236 } }, active: 'husary', queue: [] });
    expect(el.textContent).toContain('يُحمَّل… ١٠٪');
    fake.startResult = 'queued';
    await act(() => button('تحميل مشاري العفاسي لكامل القرآن').click());
    await tick();
    await act(() => el.querySelector('.rcpick__btn--primary').click());
    await tick();
    expect(fake.calls.at(-1)).toMatchObject({ method: 'start', id: 'afasy' });
    expect(toasts.at(-1)).toContain('بالانتظار');
    expect(toasts.join()).not.toContain('أوقفه أولًا');

    await fire('state', {
      items: { husary: { status: 'downloading', count: 624, total: 6236, waiting: true }, afasy: { status: 'queued', count: 0, total: 6236 } },
      active: 'husary',
      queue: ['afasy'],
    });
    expect(el.textContent).toContain('ينتظر الاتصال… ١٠٪');
    expect(el.textContent).toContain('بالانتظار');
    // الضغط على زرّ المنتظر يخرجه من الانتظار
    await act(() => button('إلغاء انتظار تحميل مشاري العفاسي').click());
    await tick();
    expect(fake.calls.at(-1)).toMatchObject({ method: 'pause', id: 'afasy' });
    // والجاري يُوقف بمعرّفه
    await act(() => button('إيقاف تحميل محمود خليل الحصري مؤقتًا').click());
    await tick();
    expect(fake.calls.at(-1)).toMatchObject({ method: 'pause', id: 'husary' });
  });
});
