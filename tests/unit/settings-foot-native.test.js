// أسطر أسفل الإعدادات داخل تطبيق أندرويد (٢٠٢٦-١١-٢١، بقرار صاحب المشروع): عن التطبيق، ثم المساعدة والتواصل (كان «للشكاوى والاقتراحات»، ٢٠٢٦-١١-٢٤)،
// ثم قيّم التطبيق، ثم شارك التطبيق — وترتيبها في الموقع (بلا «قيّم التطبيق») في tests/e2e/feedback.spec.js
import React, { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  const plugin = new Proxy({}, { get: () => () => Promise.resolve({}) });
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => true }, registerPlugin: () => plugin };
});
vi.mock('@capacitor/app', () => ({ App: { addListener: () => Promise.resolve({ remove() {} }) } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.React = React;

let root, host;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('أسفل الإعدادات داخل التطبيق', () => {
  it('الأسطر الأربعة بالترتيب المعتمد', async () => {
    const { default: SettingsSheet } = await import('../../src/components/SettingsSheet.jsx');
    await act(async () => root.render(h(SettingsSheet, { open: true, onPage() {}, onClose() {} })));
    const foot = host.querySelector('.settings__page .settings__section--foot');
    const labels = [...foot.querySelectorAll('.settings__label')].map((e) => e.textContent);
    expect(labels).toEqual(['عن التطبيق', 'المساعدة والتواصل', 'قيّم التطبيق', 'شارك التطبيق']);
    // الاسم القديم لا يبقى سطرًا ولا عنوان صفحة (ويبقى في جملة رسالة التنبيه داخل الصفحة نفسها)
    const names = [...host.querySelectorAll('.settings__label, h2')].map((e) => e.textContent);
    expect(names).toContain('المساعدة والتواصل');
    expect(names).not.toContain('للشكاوى والاقتراحات');
    expect(names).not.toContain('تواصل معنا');
  });
});
