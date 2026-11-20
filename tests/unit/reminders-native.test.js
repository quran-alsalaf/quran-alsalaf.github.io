// تذكير الختمة داخل تطبيق أندرويد (الجلسة ٣ أ): «التذكير اليومي» في نموذج الختمة ملغى افتراضيًّا، وتفعيله يطلب
// إذن الإشعارات ثم يظهر منتقي الوقت، ورفض الإذن يبقيه ملغى مع زرّ إعدادات الجهاز؛ والإشعارات تُرسل إلى أندرويد
// عند تغيّر الختمة وحده — src/lib/reminders.js، src/components/ReminderField.jsx
import React, { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ calls: [], granted: true }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = {
    set: (args) => {
      fake.calls.push({ method: 'set', ...args });
      return Promise.resolve();
    },
    checkPermission: () => Promise.resolve({ granted: fake.granted }),
    requestPermission: () => {
      fake.calls.push({ method: 'requestPermission' });
      return Promise.resolve({ granted: fake.granted });
    },
    openSettings: () => {
      fake.calls.push({ method: 'openSettings' });
      return Promise.resolve();
    },
    addListener: () => Promise.resolve({ remove() {} }),
  };
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.React = React;

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const Q = { ...load('quran'), qcf: load('qcf4') };
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

let R;
let K;
beforeEach(async () => {
  Object.assign(fake, { calls: [], granted: true });
  localStorage.clear();
  vi.resetModules();
  R = await import('../../src/lib/reminders.js');
  K = await import('../../src/lib/khatma.js');
});

describe('الإرسال إلى أندرويد', () => {
  it('يُرسل إشعارات النوعين، ولا يعيد إرسال الجدول نفسه، ويعيده إذا تغيّر', () => {
    const now = new Date(2026, 10, 20, 9, 0);
    const wird = K.startWird('days', 30, '2026-11-20', '20:00');
    R.syncReminders({ wird, hifz: null, hafs: Q, now });
    const sets = () => fake.calls.filter((c) => c.method === 'set');
    expect(sets().map((c) => c.type)).toEqual(['wird', 'hifz']);
    expect(sets()[0].items).toHaveLength(30);
    expect(sets()[0].dismiss).toBe(false);
    expect(sets()[1].items).toEqual([]); // بلا ختمة حفظ: يُلغى ما كان لها
    R.syncReminders({ wird, hifz: null, hafs: Q, now });
    expect(sets()).toHaveLength(2);
    // أتمّ ورده: يُعاد إرسال الورد من الغد، ويُزال إشعار اليوم إن كان ظاهرًا
    K.completeWird('2026-11-20');
    R.syncReminders({ wird: K.readWird(), hifz: null, hafs: Q, now });
    expect(sets()).toHaveLength(3);
    expect(sets()[2].items[0].day).toBe('2026-11-21');
    expect(sets()[2].dismiss).toBe(true);
  });

  it('إلغاء التذكير يلغي إشعاراته', () => {
    const now = new Date(2026, 10, 20, 9, 0);
    R.syncReminders({ wird: K.startWird('days', 30, '2026-11-20', '20:00'), hifz: null, hafs: Q, now });
    K.setReminder('wird', null);
    R.syncReminders({ wird: K.readWird(), hifz: null, hafs: Q, now });
    const last = fake.calls.filter((c) => c.method === 'set' && c.type === 'wird').at(-1);
    expect(last.items).toEqual([]);
  });
});

describe('«التذكير اليومي» في نموذج الختمة', () => {
  let root;
  let el;
  let toasts;
  const render = async () => {
    const KhatmaTab = (await import('../../src/components/KhatmaTab.jsx')).default;
    el = document.createElement('div');
    document.body.append(el);
    root = createRoot(el);
    toasts = [];
    await act(() => root.render(h(KhatmaTab, { quran: Q, hafs: Q, onRead() {}, onHifz() {}, onToast: (t) => toasts.push(t) })));
  };
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
  });
  const button = (text) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  const reminderGroup = () => el.querySelector('[aria-label="التذكير اليومي"]');
  // نموذج الإنشاء خطوات (الجزء ٢): «التالي» حتى خطوة التذكير، ثم إلى الملخص
  const step = () => el.querySelector('.steps')?.dataset.step;
  const nextUntil = async (id) => {
    for (let i = 0; i < 10 && step() !== id; i++) await act(() => button('التالي').click());
    expect(step()).toBe(id);
  };
  // يعيد وقت الملخص إلى ٥:٣٠ من خطوته
  const setTimeBack = async () => {
    await act(() => [...el.querySelectorAll('.steps__row')].find((b) => b.textContent.includes('التذكير اليومي')).click());
    await setTime('05:30');
    await act(() => button('العودة إلى الملخص').click());
  };
  const setTime = (value) =>
    act(() => {
      const input = el.querySelector('input[type="time"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

  it('ملغى افتراضيًّا، وتفعيله يطلب الإذن ثم يظهر منتقي الوقت على ٨ م، والختمة تُحفظ بالوقت المختار', async () => {
    await render();
    // داخل التطبيق: خطوة التذكير بين العدد والملخص، فالخطوات خمس
    expect(el.querySelector('.steps__count').textContent).toBe('الخطوة ١ من ٥');
    expect(reminderGroup()).toBeNull();
    await nextUntil('reminder');
    expect(el.querySelector('.steps__count').textContent).toBe('الخطوة ٤ من ٥');
    expect(el.querySelector('.steps__question').textContent).toBe('هل تريد تذكيرا يوميا؟');
    expect(reminderGroup()).not.toBeNull();
    expect(button('بلا تذكير').getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('input[type="time"]')).toBeNull();
    await act(() => button('تذكير يومي').click());
    await tick();
    expect(fake.calls.some((c) => c.method === 'requestPermission')).toBe(true);
    const input = el.querySelector('input[type="time"]');
    expect(input.value).toBe('20:00');
    expect(el.textContent).toContain('يصلك إشعار كل يوم نحو ٨:٠٠ م، إلا إذا أتممت ورد اليوم قبله.');
    await setTime('05:30');
    await act(() => button('التالي').click());
    // في الملخص سطر التذكير، والضغط عليه يفتح خطوته ثم يعود إليه
    const row = () => [...el.querySelectorAll('.steps__row')].find((b) => b.textContent.includes('التذكير اليومي'));
    expect(row().textContent).toContain('٥:٣٠ ص');
    await act(() => row().click());
    expect(step()).toBe('reminder');
    await setTime('05:45');
    await act(() => button('العودة إلى الملخص').click());
    expect(row().textContent).toContain('٥:٤٥ ص');
    await setTimeBack();
    await act(() => button('ابدأ الختمة').click());
    expect(K.readWird().reminder).toBe('05:30');
    // في «التفاصيل» بطاقة الختمة سطر بوقت التذكير
    expect(el.textContent).not.toContain('التذكير اليومي: ٥:٣٠ ص');
    await act(() => button('التفاصيل').click());
    expect(el.textContent).toContain('التذكير اليومي: ٥:٣٠ ص');
  });

  it('رفض الإذن: يبقى «بلا تذكير» ومعه شرح وزرّ إعدادات الجهاز', async () => {
    fake.granted = false;
    await render();
    await nextUntil('reminder');
    await act(() => button('تذكير يومي').click());
    await tick();
    expect(button('بلا تذكير').getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('input[type="time"]')).toBeNull();
    expect(el.querySelector('[role="alert"]').textContent).toContain('الإشعارات غير مسموحة لهذا التطبيق');
    await act(() => button('فتح إعدادات الإشعارات').click());
    expect(fake.calls.some((c) => c.method === 'openSettings')).toBe(true);
    await act(() => button('التالي').click());
    expect([...el.querySelectorAll('.steps__row')].at(-1).textContent).toContain('بلا تذكير');
    await act(() => button('ابدأ الختمة').click());
    expect(K.readWird().reminder).toBe(null);
  });

  it('تعديل الخطة بتغيير التذكير وحده لا يعيد تقسيمها', async () => {
    K.startWird('days', 30, '2026-11-18');
    const before = K.readWird();
    await render();
    await act(() => button('التفاصيل').click());
    await act(() => button('تعديل الخطة').click());
    await act(() => button('تذكير يومي').click());
    await tick();
    await act(() => button('حفظ الخطة').click());
    expect(K.readWird()).toEqual({ ...before, reminder: '20:00' });
    expect(toasts).toEqual(['تم حفظ التذكير']);
  });

  it('ختمة الحفظ لها تذكيرها المستقل', async () => {
    K.startWird('days', 30, '2026-11-18', '20:00');
    await render();
    await act(() => button('ختمة حفظ جديدة').click());
    // مع ختمة قائمة: لا خطوة للنوع، فخطوات الحفظ سبع (منها التذكير)
    expect(el.querySelector('.steps__count').textContent).toBe('الخطوة ١ من ٧');
    await nextUntil('reminder');
    expect(el.querySelector('.steps__count').textContent).toBe('الخطوة ٦ من ٧');
    const groups = el.querySelectorAll('[aria-label="التذكير اليومي"]');
    expect(groups).toHaveLength(1); // نموذج الحفظ (وبطاقة الورد فيها سطر الوقت وحده)
    await act(() => [...groups[0].querySelectorAll('button')].find((b) => b.textContent === 'تذكير يومي').click());
    await tick();
    await setTime('17:15');
    await act(() => button('التالي').click());
    await act(() => button('ابدأ ختمة الحفظ').click());
    const hifz = K.readKhatmas().find((x) => x.type === 'hifz');
    expect(hifz.reminder).toBe('17:15');
    expect(K.readWird().reminder).toBe('20:00');
    for (const b of [...el.querySelectorAll('.kdetails__toggle')]) await act(() => b.click());
    expect(el.textContent).toContain('التذكير اليومي: ٨:٠٠ م');
    expect(el.textContent).toContain('التذكير اليومي: ٥:١٥ م');
  });
});
