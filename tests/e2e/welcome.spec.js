// الشاشة الترحيبية «دليل التطبيق» (٢٠٢٦-١١-٢٣، بقرار صاحب المشروع): ست شرائح بلقطات من التطبيق نفسه، تظهر مرة
// واحدة عند أول فتح للمستخدم الجديد (لا للقدامى)، ثم اختيار الرواية؛ وتُفتح من زرّ «دليل التطبيق» في «عن التطبيق»
import { test, expect } from '@playwright/test';
import { clickTopbar, drag, isLaptop, openApp, prepare, waitMushaf } from './helpers.js';

const guide = (page) => page.getByRole('dialog', { name: 'دليل التطبيق' });
const slide = (page) => guide(page).locator('.welcome__slide:not([aria-hidden="true"])');
const TITLES = ['أهلًا بك في قرآن السلف', 'المصحف', 'صفحات المحتوى', 'القائمة اليمنى', 'الاستماع', 'الإعدادات'];

// مستخدم جديد حقًّا: لا مفتاح «hq.» عنده عند أول فتح (يُمحى ما جهّزه prepare مرة واحدة)
async function openFresh(page, storage = {}) {
  await prepare(page, storage);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__fresh')) return;
    sessionStorage.setItem('__fresh', '1');
    for (const k of Object.keys(localStorage)) if (k.startsWith('hq.')) localStorage.removeItem(k);
  });
  await page.goto('/');
  await expect(page.locator('.splash')).toHaveCount(0);
}

// الإعدادات ← «عن التطبيق» ← زرّ «دليل التطبيق»
async function openGuide(page) {
  await clickTopbar(page, 'الإعدادات');
  await page.locator('.settings').getByRole('button', { name: 'عن التطبيق' }).click();
  await page.locator('.settings .about__body').getByRole('button', { name: 'دليل التطبيق' }).click();
}

test('مستخدم جديد: الدليل أول فتح، يُقلَّب حتى «ابدأ»، ثم اختيار الرواية، ولا يعود بعدها', async ({ page }) => {
  await openFresh(page);
  await expect(guide(page)).toBeVisible();
  // اختيار الرواية بعد الدليل لا معه
  await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hq.welcome'))).toBe('show');

  for (let i = 0; i < TITLES.length; i++) {
    await expect(slide(page).getByRole('heading')).toHaveText(TITLES[i]);
    await expect(guide(page).locator('.welcome__dot[aria-current]')).toHaveAttribute('aria-label', new RegExp(TITLES[i]));
    const last = i === TITLES.length - 1;
    await expect(guide(page).getByRole('button', { name: 'رجوع' })).toBeEnabled({ enabled: i > 0 });
    await expect(guide(page).getByRole('button', { name: 'تخطٍّ' })).toHaveCount(last ? 0 : 1);
    if (!last) await guide(page).getByRole('button', { name: 'التالي' }).click();
  }
  // الأخيرة: الإعدادات، وأن الدليل فيها
  await expect(slide(page)).toContainText('تجد هذا الدليل متى أردت في الإعدادات، في «عن التطبيق»');
  await guide(page).getByRole('button', { name: 'ابدأ' }).click();
  await expect(guide(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hq.welcome'))).toBe('seen');

  const chooser = page.getByRole('dialog', { name: 'رواية المصحف' });
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: /حفص عن عاصم/ }).click();
  await waitMushaf(page);

  await page.reload();
  await waitMushaf(page);
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toHaveCount(0);
});

test('«تخطٍّ» يغلق الدليل فلا يعود عند الفتح التالي', async ({ page }) => {
  await openFresh(page);
  await guide(page).getByRole('button', { name: 'تخطٍّ' }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.splash')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
});

test('المستخدم القديم (عنده بيانات محفوظة): لا يظهر له الدليل تلقائيًّا', async ({ page }) => {
  await openApp(page, { 'hq.page': '50' });
  await page.waitForTimeout(400);
  await expect(guide(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('hq.welcome'))).toBeNull();
});

test('زرّ «دليل التطبيق» في «عن التطبيق» يفتحه من أوله، وEsc يرجع شريحة ثم يغلقه من الأولى', async ({ page }) => {
  await openApp(page, { 'hq.page': '3' });
  await openGuide(page);
  await expect(guide(page)).toBeVisible();
  await expect(page.locator('.settings')).not.toHaveClass(/settings--open/);
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[0]);

  await guide(page).getByRole('button', { name: 'التالي' }).click();
  await guide(page).getByRole('button', { name: 'التالي' }).click();
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[2]);
  await page.keyboard.press('Escape');
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[1]);
  await guide(page).getByRole('button', { name: 'رجوع' }).click();
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[0]);
  await page.keyboard.press('Escape');
  await expect(guide(page)).toHaveCount(0);
  // والمستخدم القديم بعد فتحه من الإعدادات يبقى كما هو
  expect(await page.evaluate(() => localStorage.getItem('hq.welcome'))).toBe('seen');
});

test('التقليب بالسحب والنقاط والأسهم، والمصحف تحته لا يتقلّب', async ({ page }) => {
  await openFresh(page, { 'hq.page': null });
  // السحب نحو اليمين يأتي بالتالية (كالمصحف)، ونحو اليسار بالسابقة
  await drag(page, 200);
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[1]);
  await drag(page, -200);
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[0]);
  // سحب قصير لا ينقل
  await drag(page, 20);
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[0]);
  // نقطة الشريحة الرابعة
  await guide(page).locator('.welcome__dot').nth(3).click();
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[3]);
  // الأسهم: الأيسر للتالية والأيمن للسابقة
  await page.keyboard.press('ArrowLeft');
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[4]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(slide(page).getByRole('heading')).toHaveText(TITLES[2]);
  await guide(page).getByRole('button', { name: 'تخطٍّ' }).click();
  await page.getByRole('dialog', { name: 'رواية المصحف' }).getByRole('button', { name: /حفص عن عاصم/ }).click();
  await waitMushaf(page);
  expect(await page.evaluate(() => localStorage.getItem('hq.page') ?? '1')).toBe('1');
});

test('اللقطة بمقاس العرض ونوع الخلفية، وتُحمَّل', async ({ page }, testInfo) => {
  const size = isLaptop(testInfo) ? 'laptop' : 'mobile';
  await openApp(page, { 'hq.page': '3', 'hq.bg': 'gray' });
  await openGuide(page);
  await expect(guide(page)).toHaveClass(isLaptop(testInfo) ? /welcome--laptop/ : /^welcome$/);
  // الأولى بأيقونة التطبيق، وما بعدها لقطاتها
  await expect(slide(page).locator('img.welcome__logo')).toHaveCount(1);
  const ids = ['mushaf', 'study', 'menu', 'listen', 'settings'];
  for (const id of ids) {
    await guide(page).getByRole('button', { name: 'التالي' }).or(guide(page).getByRole('button', { name: 'ابدأ' })).click();
    const img = slide(page).locator('img.welcome__shot');
    await expect(img).toHaveAttribute('src', new RegExp(`welcome/${id}-${size}-dark\\.webp$`));
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('على الخلفية الفاتحة: اللقطات الفاتحة', async ({ page }, testInfo) => {
  await openFresh(page);
  await guide(page).getByRole('button', { name: 'التالي' }).click();
  await expect(slide(page).locator('img')).toHaveAttribute('src', new RegExp(`mushaf-${isLaptop(testInfo) ? 'laptop' : 'mobile'}-light\\.webp$`));
});

// ولقطتاه المرجعيتان في tests/e2e/screens.spec.js (مع لقطات الشاشات الرئيسية، ليحدّثها snapshots.yml)
