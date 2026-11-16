// مؤقّت التلاوة (٢٠٢٦-١١-١٦): سطر «مؤقّت التلاوة» في نافذة الاستماع، وما بقي منه في زرّ الإعدادات أسفل
// الشاشة، والإيقاف عند نهاية الآية الجارية بعد انتهاء الوقت، والرجوع إلى «بلا مؤقت» — بصوت محاكى
// وساعة محاكاة (page.clock) لتقديم الوقت بلا انتظار
import { test, expect } from '@playwright/test';
import { clickDock, openApp, showChrome } from './helpers.js';

const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });
const timerSelect = (page) => listen(page).getByRole('combobox', { name: /مؤقّت التلاوة/ });
const dock = (page) => page.locator('.dock');
const timerButton = (page) => dock(page).getByRole('button', { name: /مؤقّت التلاوة/ });
const end = (page) => page.evaluate(() => window.__audio.end());
const srcCount = (page) => page.evaluate(() => window.__audio.srcs.length);

async function open(page) {
  await page.clock.install();
  await openApp(page, { 'hq.page': '3' });
  await clickDock(page, 'الاستماع للآيات');
}

test('الخيارات: بلا مؤقت (الافتراضي) والدقائق و«وقت آخر…»', async ({ page }) => {
  await open(page);
  await expect(timerSelect(page)).toHaveValue('');
  const options = await timerSelect(page).locator('option').allTextContents();
  expect(options).toEqual(['بلا مؤقت', '١٥ دقيقة', '٣٠ دقيقة', '٤٥ دقيقة', '٦٠ دقيقة', '٩٠ دقيقة', 'وقت آخر…']);
});

test('يقف بعد انتهاء الوقت عند نهاية الآية الجارية، ثم يرجع إلى «بلا مؤقت»', async ({ page }) => {
  await open(page);
  await timerSelect(page).selectOption('15');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await showChrome(page);
  // ما بقي في زرّ الإعدادات أسفل الشاشة
  await expect(timerButton(page)).toContainText('١٥ د');
  await page.clock.fastForward('05:00');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('١٠ د');
  // الآية الجارية تنتهي قبل الوقت: تكمل التلاوة
  await end(page);
  await expect(page.locator('.w--playing').first()).toBeVisible();
  // انتهى الوقت أثناء آية: لا تنقطع، بل تقف بعد نهايتها
  await page.clock.fastForward('10:01');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('بعد الآية');
  await expect(page.locator('.w--playing').first()).toBeVisible();
  const before = await srcCount(page);
  await end(page);
  await expect(page.locator('.w--playing')).toHaveCount(0);
  expect(await srcCount(page)).toBe(before);
  await expect(page.locator('.toast')).toHaveText('انتهى مؤقّت التلاوة');
  // رجع إلى «بلا مؤقت»
  await showChrome(page);
  await clickDock(page, 'الاستماع للآيات');
  await expect(timerSelect(page)).toHaveValue('');
});

test('الإيقاف المؤقت يجمّد العدّ', async ({ page }) => {
  await open(page);
  await timerSelect(page).selectOption('30');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await showChrome(page);
  await page.getByRole('button', { name: 'إيقاف مؤقت' }).click();
  await page.clock.fastForward('20:00');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٣٠ د');
  await page.getByRole('button', { name: 'استئناف' }).click();
  await expect(page.getByRole('button', { name: 'إيقاف مؤقت' })).toBeVisible();
  await page.clock.fastForward('10:00');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٢٠ د');
});

test('تغييره أثناء التشغيل يُطبَّق عند الإغلاق ويبدأ العدّ من جديد، و«بلا مؤقت» يلغيه', async ({ page }) => {
  await open(page);
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await timerSelect(page).selectOption('45');
  // قبل الإغلاق لم يُطبَّق
  await expect(listen(page)).toBeVisible();
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٤٥ د');
  await page.clock.fastForward('15:00');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٣٠ د');
  // ما بقي ظاهر في النافذة نفسها
  await timerButton(page).click();
  await expect(listen(page)).toContainText('يتبقى ٣٠ د');
  await timerSelect(page).selectOption('15');
  await page.keyboard.press('Escape');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('١٥ د');
  await timerButton(page).click();
  await timerSelect(page).selectOption('');
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await showChrome(page);
  await expect(timerButton(page)).toHaveCount(0);
  await expect(dock(page).getByRole('button', { name: 'إعدادات الاستماع', exact: true })).toBeVisible();
});

test('«وقت آخر…»: يقبل ١–٣٦٠ دقيقة بالأرقام العربية أو الغربية', async ({ page }) => {
  await open(page);
  await timerSelect(page).selectOption('custom');
  const input = listen(page).getByRole('textbox', { name: 'عدد الدقائق' });
  await input.fill('٤٠٠');
  await expect(listen(page).locator('.listen__warn')).toHaveText('اكتب عددًا من ١ إلى ٣٦٠ دقيقة.');
  await input.fill('0');
  await expect(listen(page).locator('.listen__warn')).toBeVisible();
  await input.fill('٢٠');
  await expect(listen(page).locator('.listen__warn')).toHaveCount(0);
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٢٠ د');
  // يُعرض «وقت آخر» بقيمته عند فتح النافذة من جديد
  await timerButton(page).click();
  await expect(timerSelect(page)).toHaveValue('custom');
  await expect(listen(page).getByRole('textbox', { name: 'عدد الدقائق' })).toHaveValue('٢٠');
  await listen(page).getByRole('textbox', { name: 'عدد الدقائق' }).fill('7');
  await listen(page).getByRole('button', { name: 'تم', exact: true }).click();
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٧ د');
});

test('الإيقاف التام ✕ يلغي المؤقّت', async ({ page }) => {
  await open(page);
  await timerSelect(page).selectOption('60');
  await listen(page).getByRole('button', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await showChrome(page);
  await expect(timerButton(page)).toContainText('٦٠ د');
  await dock(page).getByRole('button', { name: 'إيقاف', exact: true }).click();
  await showChrome(page);
  await clickDock(page, 'الاستماع للآيات');
  await expect(timerSelect(page)).toHaveValue('');
});
