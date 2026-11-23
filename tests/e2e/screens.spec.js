// لقطات مرجعية للشاشات الرئيسية، على خلفية فاتحة (بيج) وداكنة (رصاصي)، بمقاسَي الجوال واللابتوب.
// أي تغيير شكلي غير مقصود يُفشل المقارنة في GitHub. وتحديثها عن قصد: التزام فيه [update-snapshots] (snapshots.yml)
// (وبحسب CLAUDE.md: تُعرض الصورة القديمة والجديدة على صاحب المشروع قبل اعتماد التحديث)
import { test, expect } from '@playwright/test';
import { clickDock, clickTopbar, openApp, prepare, showChrome } from './helpers.js';

const THEMES = [
  ['light', 'beige'],
  ['dark', 'gray'],
];

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // الفأرة بعيدًا، والأزرار العائمة مخفية
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
}

for (const [theme, bg] of THEMES) {
  test.describe(`المظهر ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'blue' });
    });

    test('المصحف', async ({ page }) => {
      await settle(page);
      await expect(page).toHaveScreenshot(`mushaf-${theme}.png`);
    });

    // نص التفسير بخط المحتوى (Scheherazade New منذ ٢٠٢٦-١١-١٦) وآياته المقتبسة بلون التطبيق
    test('التدبّر', async ({ page }) => {
      await clickDock(page, 'التدبّر');
      await expect(page.locator('.study .study__item').first()).toBeVisible();
      await page.locator('.dock').evaluate((el) => el.classList.remove('dock--open'));
      await settle(page);
      await expect(page).toHaveScreenshot(`study-${theme}.png`);
    });

    // التسميع بالكشف (٢٠٢٦-١١-١٦): كلمات الآيات مخفية إلا ما كُشف، ورؤوس الآيات ظاهرة، وشريط التسميع أسفلها
    test('التسميع', async ({ page }) => {
      await clickTopbar(page, 'الإعدادات');
      await page.locator('.settings').getByRole('button', { name: 'وضع التسميع', exact: true }).click();
      await page.locator('.settings').getByRole('button', { name: 'ابدأ وضع التسميع' }).click();
      const bar = page.getByRole('toolbar', { name: 'التحكم في وضع التسميع' });
      await bar.getByRole('button', { name: 'كشف الآية' }).click();
      await bar.getByRole('button', { name: 'كشف كلمتين' }).click();
      await expect(page.locator('.sheet--current .w[data-wi]:not(.w--hidden)').first()).toBeVisible();
      await settle(page);
      await expect(page).toHaveScreenshot(`recite-${theme}.png`);
    });

    test('الإعدادات', async ({ page }) => {
      await clickTopbar(page, 'الإعدادات');
      await expect.poll(async () => Math.round((await page.locator('.settings__card').boundingBox()).x)).toBe(0);
      await settle(page);
      await expect(page).toHaveScreenshot(`settings-${theme}.png`);
    });
  });

  // «بلا لون» (٢٠٢٦-١١-١٢) ومعه مقدار صفحات المحتوى: الإخفات، وزرّا الشريط السفلي ظاهران و✕ الإلغاء في زر صفحات المحتوى
  test(`بلا لون ${theme}`, async ({ page }) => {
    await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'none', 'hq.contentRange': [12, 16] });
    await page.evaluate(() => document.fonts.ready);
    await showChrome(page);
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot(`none-${theme}.png`);
  });

  // مصحف ورش (٢٠٢٦-١١-١٥): الصفحة الثالثة بخطوط صفحاته، ورقم الآية بلون التطبيق
  test(`ورش ${theme}`, async ({ page }) => {
    await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'blue', 'hq.riwayah': 'warsh' });
    await expect(page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first()).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`warsh-${theme}.png`);
  });

  // الشاشة الترحيبية «دليل التطبيق» (٢٠٢٦-١١-٢٣): الشريحة الأولى (أيقونة التطبيق) والثانية (لقطة المصحف)،
  // مفتوحة من الإعدادات ← «عن التطبيق» — tests/e2e/welcome.spec.js
  test(`دليل التطبيق ${theme}`, async ({ page }) => {
    await openApp(page, { 'hq.page': '3', 'hq.bg': bg, 'hq.accent': 'blue' });
    await clickTopbar(page, 'الإعدادات');
    await page.locator('.settings').getByRole('button', { name: 'عن التطبيق' }).click();
    await page.locator('.settings .about__body').getByRole('button', { name: 'دليل التطبيق' }).click();
    const guide = page.getByRole('dialog', { name: 'دليل التطبيق' });
    // انتهت حركة الظهور وانتقال الشرائح، ورُسمت اللقطة الظاهرة
    const still = () =>
      page.waitForFunction(() => !document.querySelector('.welcome')?.getAnimations({ subtree: true }).some((a) => a.playState === 'running'));
    await expect(guide).toBeVisible();
    await settle(page);
    await still();
    await expect(page).toHaveScreenshot(`welcome-1-${theme}.png`);
    await guide.getByRole('button', { name: 'التالي' }).click();
    const shot = guide.locator('.welcome__slide:not([aria-hidden="true"]) img');
    await expect.poll(() => shot.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    await still();
    await expect(page).toHaveScreenshot(`welcome-2-${theme}.png`);
  });
}

// اختيار الرواية عند أول فتح (٢٠٢٦-١١-١٥)
test('اختيار الرواية', async ({ page }) => {
  await prepare(page, { 'hq.riwayah': null, 'hq.page': '3' });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toBeVisible();
  await expect(page.locator('.splash')).toHaveCount(0);
  await settle(page);
  await expect(page).toHaveScreenshot('riwayah.png');
});
