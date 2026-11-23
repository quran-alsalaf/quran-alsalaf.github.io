// ترتيب الإعدادات و«رأيك يهمنا» (الجلسة ٣ ب، ٢٠٢٦-١١-٢٠): المظهر والقراءة ثابتان، ثم «الإعدادات التخصيصية»،
// وفي أسفل اللوحة: عن التطبيق، وللشكاوى والاقتراحات (كان «تواصل معنا»، ٢٠٢٦-١١-٢١)، وقيّم التطبيق (في التطبيق
// الأصلي وحده)، وشارك التطبيق
import { test, expect } from '@playwright/test';
import { clickTopbar, copied, isLaptop, openApp, openCustomSettings } from './helpers.js';

const settings = (page) => page.locator('.settings');
const mainPage = (page) => settings(page).locator('.settings__page').first();
const shown = (page) => settings(page).locator('.settings__page--in');

test('الإعدادات: أربعة أسطر ثابتة، ثم «الإعدادات التخصيصية»، ثم الأسطر الأخيرة في أسفل اللوحة', async ({ page }, testInfo) => {
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await expect(settings(page)).toHaveClass(/settings--open/);
  const main = mainPage(page);
  await expect(main.locator('.settings__sectionTitle')).toHaveText(['المظهر', 'القراءة']);
  await expect(main.locator('.settings__label')).toHaveText([
    'خلفية القراءة',
    'لون التطبيق',
    'وضع القراءة',
    'وضع التسميع',
    'الإعدادات التخصيصية',
    'عن التطبيق',
    'للشكاوى والاقتراحات',
    'شارك التطبيق',
  ]);
  await expect(main.getByRole('button', { name: 'تواصل معنا' })).toHaveCount(0);
  // في الموقع لا متجر: لا «قيّم التطبيق»
  await expect(page.getByRole('button', { name: 'قيّم التطبيق' })).toHaveCount(0);
  // ما نُقل ليس في الإعدادات نفسها
  await expect(main.getByRole('radiogroup', { name: 'الرواية' })).toHaveCount(0);
  await expect(main.getByRole('switch')).toHaveCount(0);

  // الأسطر الأخيرة ملتصقة بأسفل اللوحة، وبينها وبين ما قبلها ما بقي من الفراغ (واسع في اللابتوب، قليل في الجوال)
  const foot = await main.locator('.settings__section--foot').boundingBox();
  const above = await main.getByRole('button', { name: 'الإعدادات التخصيصية' }).boundingBox();
  const body = await main.locator('.settings__body').boundingBox();
  const pad = await main.locator('.settings__body').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(Math.abs(foot.y + foot.height - (body.y + body.height - pad))).toBeLessThanOrEqual(1);
  expect(foot.y - (above.y + above.height)).toBeGreaterThan(isLaptop(testInfo) ? 40 : 0);
});

test('«الإعدادات التخصيصية»: الرواية ومفتاحا القراءة والنسخة الاحتياطية، والرجوع منها إلى الإعدادات', async ({ page }) => {
  await openApp(page);
  await openCustomSettings(page);
  const sub = shown(page);
  await expect(sub.locator('.settings__sectionTitle')).toHaveText(['المصحف', 'القراءة']);
  await expect(sub.getByRole('radiogroup', { name: 'الرواية' })).toBeVisible();
  await expect(sub.getByRole('switch', { name: 'تمييز مقررات الأسابيع' })).toBeVisible();
  await expect(sub.getByRole('switch', { name: 'التنبيه ببداية الربع' })).toBeVisible();
  await expect(sub.getByRole('button', { name: 'النسخ الاحتياطي' })).toBeVisible();
  await sub.getByRole('button', { name: 'رجوع' }).click();
  await expect(shown(page)).toHaveCount(0);
  await expect(mainPage(page).getByRole('button', { name: 'الإعدادات التخصيصية' })).toBeVisible();
  // وEsc يرجع منها إلى الإعدادات، ثم يغلقها
  await mainPage(page).getByRole('button', { name: 'الإعدادات التخصيصية' }).click();
  await expect(shown(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(shown(page)).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
  await page.keyboard.press('Escape');
  await expect(settings(page)).not.toHaveClass(/settings--open/);
});

test('تغيير الرواية من «الإعدادات التخصيصية» يُحفظ', async ({ page }) => {
  await openApp(page);
  await openCustomSettings(page);
  await shown(page).getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name: 'ورش' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hq.riwayah'))).toBe('warsh');
});

test('شارك التطبيق: قائمة المشاركة بالنص ورابط الموقع', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.share = async (d) => {
      window.__shared.push(d);
    };
  });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'شارك التطبيق' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
  expect(await page.evaluate(() => window.__shared[0])).toEqual({
    text: 'قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.\nhttps://quran-alsalaf.github.io/',
  });
  // الإعدادات ما زالت مفتوحة
  await expect(settings(page)).toHaveClass(/settings--open/);
});

test('شارك التطبيق حيث لا قائمة مشاركة: يُنسخ النص مع رسالة', async ({ page }) => {
  await page.addInitScript(() => {
    delete Navigator.prototype.share;
    delete navigator.share;
  });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'شارك التطبيق' }).click();
  await expect(page.locator('.toast')).toHaveText('نُسخ رابط التطبيق');
  expect(await copied(page)).toBe('قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.\nhttps://quran-alsalaf.github.io/');
});

test('للشكاوى والاقتراحات: الرسالة والرقم وزرّ واتساب برسالة جاهزة، والرجوع إلى الإعدادات', async ({ page }) => {
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'للشكاوى والاقتراحات' }).click();
  const sub = shown(page);
  await expect(sub.getByRole('heading', { name: 'للشكاوى والاقتراحات' })).toBeVisible();
  await expect(sub.locator('.contact__note')).toHaveText(
    'هذا التطبيق تم إنشاؤه بمساعدة الذكاء الاصطناعي، فإذا وجدت أي أخطاء أو كانت لديك اقتراحات فتواصل معنا من فضلك.'
  );
  await expect(sub.locator('.contact__number')).toHaveText('0548470724');
  const link = sub.getByRole('link', { name: 'مراسلة على واتساب' });
  await expect(link).toBeVisible();
  const url = new URL(await link.getAttribute('href'));
  expect(url.origin + url.pathname).toBe('https://wa.me/966548470724');
  const text = url.searchParams.get('text');
  expect(text.startsWith('السلام عليكم،')).toBe(true);
  expect(text.endsWith('قرآن السلف (الموقع) · رواية حفص')).toBe(true);
  await expect(link).toHaveAttribute('target', '_blank');
  // زرّ الرجوع في المتصفح (وأندرويد) يعيد إلى الإعدادات
  await page.goBack();
  await expect(shown(page)).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
});

test('للشكاوى والاقتراحات في مصحف ورش: الرواية في الرسالة', async ({ page }) => {
  await openApp(page, { 'hq.riwayah': 'warsh' });
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'للشكاوى والاقتراحات' }).click();
  const href = await shown(page).getByRole('link', { name: 'مراسلة على واتساب' }).getAttribute('href');
  expect(new URL(href).searchParams.get('text')).toContain('رواية ورش');
});

test('الشاشة القصيرة: الأسطر الأخيرة تحت ما قبلها مباشرة، وتُبلغ بالتمرير', async ({ page }, testInfo) => {
  test.skip(isLaptop(testInfo), 'الجوال وحده');
  await page.setViewportSize({ width: 390, height: 480 });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  const main = mainPage(page);
  const last = main.getByRole('button', { name: 'شارك التطبيق' });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const foot = await main.locator('.settings__section--foot').boundingBox();
  const above = await main.getByRole('button', { name: 'الإعدادات التخصيصية' }).boundingBox();
  expect(foot.y - (above.y + above.height)).toBeLessThan(30);
});
