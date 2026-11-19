// شكل الصفحة (٢٠٢٦-١١-١٩): «بسيطة» كما كانت (الافتراضي)، و«مزخرفة» بإطار حول كل صفحة بلون التطبيق — src/lib/pageStyle.js
// وsrc/components/PageFrame.jsx
import { test, expect } from '@playwright/test';
import { clickTopbar, isLaptop, openApp, waitMushaf } from './helpers.js';

const fontSize = (page) => page.locator('.sheet--current .mushaf-page').first().evaluate((e) => parseFloat(e.style.getPropertyValue('--fs')));
const frames = (page) => page.locator('.sheet--current .page-frame');

async function chooseStyle(page, name) {
  await clickTopbar(page, 'الإعدادات');
  const row = page.getByRole('radiogroup', { name: 'شكل الصفحة' });
  await row.getByRole('radio', { name }).click();
  await expect(row.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
}

test('الافتراضي «بسيطة» بلا إطار، و«مزخرفة» تضع إطارًا حول كل صفحة وتبقى بعد إعادة الفتح', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '3' });
  await expect(page.locator('.page-frame')).toHaveCount(0);
  const plainFont = await fontSize(page);
  await clickTopbar(page, 'الإعدادات');
  await expect(page.getByRole('radiogroup', { name: 'شكل الصفحة' }).getByRole('radio', { name: 'بسيطة' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');

  await chooseStyle(page, 'مزخرفة');
  // في عرض الصفحتين لكل صفحة إطارها
  await expect(frames(page)).toHaveCount(isLaptop(testInfo) ? 2 : 1);
  // الأسطر الخمسة عشر كاملة داخل الإطار، والخط أصغر يسيرًا (لا أكثر من ٧٪)
  const box = await frames(page).first().boundingBox();
  const lines = await page.locator('.sheet--current .mushaf-page').first().locator('.line').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    })
  );
  expect(lines).toHaveLength(15);
  for (const l of lines) {
    expect(l.top).toBeGreaterThanOrEqual(box.y);
    expect(l.bottom).toBeLessThanOrEqual(box.y + box.height);
    expect(l.left).toBeGreaterThanOrEqual(box.x);
    expect(l.right).toBeLessThanOrEqual(box.x + box.width);
  }
  const framedFont = await fontSize(page);
  expect(framedFont).toBeLessThan(plainFont);
  expect(framedFont).toBeGreaterThan(plainFont * 0.93);

  await page.reload();
  await waitMushaf(page);
  await expect(frames(page)).toHaveCount(isLaptop(testInfo) ? 2 : 1);
  expect(await page.evaluate(() => localStorage.getItem('hq.pageStyle'))).toBe('framed');

  await chooseStyle(page, 'بسيطة');
  await expect(page.locator('.page-frame')).toHaveCount(0);
  expect(await fontSize(page)).toBe(plainFont);
});

test('لون الزخرفة لون التطبيق نفسه، ويتبدّل معه فورًا', async ({ page }) => {
  await openApp(page, { 'hq.page': '3', 'hq.pageStyle': 'framed' });
  const stroke = () => page.locator('.sheet--current .pf-line--out').first().evaluate((e) => getComputedStyle(e).stroke);
  const accent = () => page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(await stroke()).toBe(await accent());
  const before = await stroke();
  await clickTopbar(page, 'الإعدادات');
  await page.getByRole('radiogroup', { name: 'لون التطبيق' }).getByRole('radio', { name: 'أخضر زمردي' }).click();
  await page.keyboard.press('Escape');
  expect(await stroke()).not.toBe(before);
  expect(await stroke()).toBe(await accent());
});

test('النماذج الأربعة تُجرَّب من الإعدادات (مؤقت حتى يُختار واحد)', async ({ page }) => {
  await openApp(page, { 'hq.page': '3', 'hq.pageStyle': 'framed' });
  await clickTopbar(page, 'الإعدادات');
  const row = page.getByRole('radiogroup', { name: 'نموذج الزخرفة' });
  for (const [name, id] of [['١', 'a'], ['٣', 'c'], ['٤', 'd'], ['٢', 'b']]) {
    await row.getByRole('radio', { name }).click();
    await expect(page.locator(`.sheet--current .page-frame--${id}`).first()).toBeAttached();
  }
});
