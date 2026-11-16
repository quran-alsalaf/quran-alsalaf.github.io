// التسميع بالكشف (٢٠٢٦-١١-١٦، «القائمة الثالثة» البند ٣): الدخول من الإعدادات، وإخفاء الآيات مع بقاء رؤوسها،
// والكشف كلمتين كلمتين أو بقية الآية، وبقاء ما كُشف عند الرجوع، والإخفاء من كلمة ملموسة، و«أخطائي»، والخروج
import { test, expect } from '@playwright/test';
import { QURAN, clickTopbar, isLaptop, openApp, pageVerses, stored } from './helpers.js';

const cur = (page) => page.locator('.sheet--current .mushaf-page');
const words = (page) => page.locator('.sheet--current .w[data-wi]');
const hidden = (page) => page.locator('.sheet--current .w.w--hidden');
const shown = (page) => page.locator('.sheet--current .w[data-wi]:not(.w--hidden)');
const bar = (page) => page.getByRole('toolbar', { name: 'التحكم في التسميع' });

async function startRecite(page) {
  await clickTopbar(page, 'الإعدادات');
  await page.locator('.settings').getByRole('button', { name: 'التسميع', exact: true }).click();
  await page.locator('.settings').getByRole('button', { name: 'ابدأ التسميع' }).click();
  await expect(bar(page)).toBeVisible();
}

// التقليب: السهم الأيسر للتالية والأيمن للسابقة (كاتجاه المصحف)
async function turn(page, dir) {
  await page.keyboard.press(dir > 0 ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(450);
}

test('الدخول يخفي كلمات الصفحة وتبقى رؤوس الآيات، والكشف كلمتين ثم بقية الآية، والخروج يرجع المصحف', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '1' });
  await startRecite(page);
  const total = await words(page).count();
  expect(total).toBeGreaterThan(20);
  await expect(hidden(page)).toHaveCount(total);
  // رؤوس الآيات ظاهرة: آيات الصفحة كلها (الفاتحة سبع، وفي الزوج معها أول البقرة)
  const heads = page.locator('.sheet--current .w:not([data-wi])');
  await expect(heads.first()).toBeVisible();
  const ends = isLaptop(testInfo) ? pageVerses(1).length + pageVerses(2).length : pageVerses(1).length;
  await expect(heads).toHaveCount(ends);
  // الشريط السفلي بدل الخانتين، ولا شريط علوي
  await expect(page.locator('.dock')).toHaveCount(0);

  await bar(page).getByRole('button', { name: 'كشف كلمتين' }).click();
  await expect(shown(page)).toHaveCount(2);
  await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(shown(page)).toHaveCount(4); // البسملة أربع كلمات
  await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(shown(page)).toHaveCount(8);
  await expect(shown(page).first()).toBeVisible();
  // المكشوف أول الصفحة متصلًا
  expect(await shown(page).evaluateAll((els) => els.map((e) => +e.dataset.wi))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

  await bar(page).getByRole('button', { name: 'الخروج من التسميع' }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('.sheet--current .w--hidden')).toHaveCount(0);
  await expect(page.locator('.sheet--current .w[data-wi]')).toHaveCount(0);
  await expect(page.locator('.dock')).toHaveCount(1);
});

test('الصفحة التالية مخفية، والرجوع يُبقي ما كُشف، والخروج يُنسيه', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '50' });
  await startRecite(page);
  const first = await cur(page).first().getAttribute('data-page');
  await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  const n = await shown(page).count();
  expect(n).toBeGreaterThan(0);
  await turn(page, 1);
  await expect(cur(page).first()).not.toHaveAttribute('data-page', first);
  await expect(shown(page)).toHaveCount(0);
  await expect(hidden(page).first()).toBeAttached();
  await turn(page, -1);
  await expect(cur(page).first()).toHaveAttribute('data-page', first);
  await expect(shown(page)).toHaveCount(n);
  // الخروج والدخول من جديد: كله مخفي
  await bar(page).getByRole('button', { name: 'الخروج من التسميع' }).click();
  await startRecite(page);
  await expect(shown(page)).toHaveCount(0);
  if (isLaptop(testInfo)) expect(await cur(page).count()).toBe(2);
});

test('لمس كلمة مكشوفة يخفيها وما بعدها، ولمس المخفي لا يفعل شيئًا، ولا ضغط مطوّل في التسميع', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await startRecite(page);
  for (let i = 0; i < 4; i++) await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  const n = await shown(page).count();
  expect(n).toBeGreaterThan(8);
  const right = page.locator('.sheet--current .mushaf-page[data-page="1"]');
  await right.locator('.w[data-wi="5"]').click();
  await expect(shown(page)).toHaveCount(5);
  // الكشف بعدها يكمل من الكلمة التي أُخفيت
  await bar(page).getByRole('button', { name: 'كشف كلمتين' }).click();
  await expect(shown(page)).toHaveCount(7);
  // لمس الأولى يخفي الصفحة كلها
  await right.locator('.w[data-wi="0"]').click();
  await expect(shown(page)).toHaveCount(0);
  // ضغط مطوّل على رأس آية: لا مربع آية
  const head = page.locator('.sheet--current .w:not([data-wi])').first();
  const box = await head.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await expect(bar(page)).toBeVisible();
});

test('اكتمال الصفحة: رسالة بالتقليب، وفي عرض الصفحتين يُكشف اليمنى ثم اليسرى', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '1' });
  await startRecite(page);
  const right = page.locator('.sheet--current .mushaf-page[data-page="1"] .w[data-wi]');
  const rightCount = await right.count();
  for (let i = 0; i < 7; i++) await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(page.locator('.sheet--current .mushaf-page[data-page="1"] .w--hidden')).toHaveCount(0);
  expect(await right.count()).toBe(rightCount);
  if (isLaptop(testInfo)) {
    // أول البقرة «الٓمٓ» كلمة واحدة: تُكشف وحدها، ثم الآية التي بعدها
    const left = page.locator('.sheet--current .mushaf-page[data-page="2"] .w[data-wi]:not(.w--hidden)');
    await bar(page).getByRole('button', { name: 'كشف كلمتين' }).click();
    await expect(left).toHaveCount(1);
    await bar(page).getByRole('button', { name: 'كشف كلمتين' }).click();
    await expect(left).toHaveCount(3);
  } else {
    await bar(page).getByRole('button', { name: 'كشف كلمتين' }).click();
    await expect(page.getByRole('status')).toHaveText('كُشفت الصفحة كلها؛ قلّب إلى التالية');
  }
});

test('«أخطائي»: قائمة الآيات المكشوفة الأحدث أولًا، والاختيار يسجّلها في علامة «أخطائي» ويكمل التسميع', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await startRecite(page);
  // قبل الكشف: لا آيات
  await bar(page).getByRole('button', { name: 'أخطائي' }).click();
  const dialog = page.getByRole('dialog', { name: 'أخطائي' });
  await expect(dialog).toContainText('لم تكشف شيئًا بعدُ');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  for (let i = 0; i < 3; i++) await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  await bar(page).getByRole('button', { name: 'أخطائي' }).click();
  const rows = dialog.locator('.mistakes__row');
  await expect(rows).toHaveCount(3);
  // أولها الآية الجارية (الثالثة)، وفيها رقمها وبدايتها
  await expect(rows.nth(0).locator('.mistakes__num')).toHaveText('٣');
  await expect(rows.nth(2).locator('.mistakes__num')).toHaveText('١');
  await expect(rows.nth(1)).toContainText('ٱلۡحَمۡدُ');
  // الخطأ في الآية السابقة: تُختار هي
  await rows.nth(1).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('سُجّلت في أخطائي');
  const list = await stored(page, 'hq.bookmarks');
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ name: 'أخطائي', multi: true });
  expect(list[0].verses.map((x) => x.v)).toEqual([1]);
  // ما زال في التسميع، وما كُشف باقٍ، والآيات بلا تظليل العلامة
  await expect(bar(page)).toBeVisible();
  await expect(shown(page)).toHaveCount(10);
  await expect(page.locator('.sheet--current .w--mark')).toHaveCount(0);

  // المسجّلة عليها ✓ ولا تتكرر
  await bar(page).getByRole('button', { name: 'أخطائي' }).click();
  await expect(rows.nth(1)).toHaveClass(/mistakes__row--done/);
  await rows.nth(1).click();
  await expect(page.getByRole('status')).toHaveText('الآية في أخطائي من قبل');
  await bar(page).getByRole('button', { name: 'أخطائي' }).click();
  await rows.nth(0).click();
  expect((await stored(page, 'hq.bookmarks'))[0].verses.map((x) => x.v)).toEqual([1, 2]);

  // بعد الخروج تظهر الآيتان مظلّلتين بلون العلامة
  await bar(page).getByRole('button', { name: 'الخروج من التسميع' }).click();
  await expect(page.locator('.sheet--current .w--mark[data-v="1"]').first()).toBeVisible();
  await expect(page.locator('.sheet--current .w--mark[data-v="2"]').first()).toBeVisible();
});

test('التسميع في مصحف ورش', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.riwayah': 'warsh' });
  await expect(page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first()).toBeVisible();
  await startRecite(page);
  // البسملة في ورش ليست آية: تبقى ظاهرة
  await expect(page.locator('.sheet--current .line--basmala').first()).toBeVisible();
  const total = await words(page).count();
  await expect(hidden(page)).toHaveCount(total);
  await bar(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(shown(page)).toHaveCount(4); // الحمد لله رب العالمين
  await bar(page).getByRole('button', { name: 'أخطائي' }).click();
  await page.getByRole('dialog', { name: 'أخطائي' }).locator('.mistakes__row').first().click();
  // تُحفظ بترقيم حفص: الحمد لله في ورش تقابل الآية الثانية من الفاتحة في حفص
  const list = await stored(page, 'hq.bookmarks');
  expect(QURAN.verses[list[0].verses[0].v]).toMatchObject({ s: 1, a: 2 });
});
