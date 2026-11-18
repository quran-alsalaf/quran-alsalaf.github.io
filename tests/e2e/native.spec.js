// التطبيق الأصلي (أندرويد): data-native على <html> (scripts/native-web.mjs)، وCapacitor يحقن حواف شريط الحالة
// وشريط أزرار الجهاز (‎--safe-area-inset-*‎). هنا تُحاكى الحافتان بقيمتين ثابتتين في متصفح الاختبار
import { test, expect } from '@playwright/test';
import { isLaptop, openApp } from './helpers.js';

const TOP = 30;
const BOTTOM = 48; // ارتفاع شريط الأزرار الثلاثة في أندرويد

async function asNative(page) {
  await page.evaluate(
    ([top, bottom]) => {
      const root = document.documentElement;
      root.setAttribute('data-native', 'android');
      root.style.setProperty('--safe-area-inset-top', `${top}px`);
      root.style.setProperty('--safe-area-inset-bottom', `${bottom}px`);
    },
    [TOP, BOTTOM]
  );
}

// حدود أسطر الصفحة الظاهرة (أعلى أول سطر وأسفل آخر سطر)
const linesBox = (page) =>
  page.locator('.sheet--current').first().locator('.line').evaluateAll((els) => {
    const rects = els.map((e) => e.getBoundingClientRect());
    return { count: els.length, top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)) };
  });

test('آخر سطر في المصحف لا يصل إلى شريط أزرار الجهاز، والأسطر الخمسة عشر كاملة', async ({ page }, testInfo) => {
  test.skip(isLaptop(testInfo), 'الجوال وحده');
  await openApp(page, { 'hq.page': '3' });
  const fs = () => page.locator('.sheet--current .mushaf-page').first().evaluate((e) => e.style.getPropertyValue('--fs'));
  const web = await linesBox(page);
  const webFs = await fs();
  await asNative(page);
  await expect.poll(async () => (await linesBox(page)).bottom).toBeLessThanOrEqual(844 - BOTTOM);
  const box = await linesBox(page);
  expect(box.count).toBe(15);
  expect(box.top).toBeGreaterThanOrEqual(TOP);
  // تتقارب الأسطر قليلًا ولا يصغر الخط
  expect(box.bottom - box.top).toBeLessThan(web.bottom - web.top);
  expect(await fs()).toBe(webFs);
});

test('في الموقع لا يُحجز شيء أسفل المصحف', async ({ page }) => {
  await openApp(page);
  const pad = await page.locator('.app').evaluate((e) => getComputedStyle(e).paddingBottom);
  expect(pad).toBe('0px');
});
