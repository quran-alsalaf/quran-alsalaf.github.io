// أثمان مصحف ورش (٢٠٢٦-١١-١٦): فهرس «الأثمان» في تبويب السور بالقائمة اليمنى (١٦ ثمنًا تحت كل جزء)،
// والتنبيه عند الوصول إلى صفحة فيها بداية ثمن: رسالة بنوعه، ووميض علامة ۞ (ولو في وسط آية) أو إطار السورة.
// وأرباع حفص كما هي في rubs.spec.js
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clickTopbar, isLaptop, openApp, savedPage, shownPages } from './helpers.js';

const W = JSON.parse(readFileSync(new URL('../../public/data/warsh/quran.json', import.meta.url), 'utf8'));
const at = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const toast = (page) => page.locator('.toast');
const menu = (page) => page.getByRole('dialog', { name: 'القائمة' });
const rub = (page, v) => page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${v}"] .w__rub`);

async function flipTo(page, p) {
  for (let i = 0; i < 4 && !(await shownPages(page)).includes(p); i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(350);
  }
  expect(await shownPages(page)).toContain(p);
}

test('فهرس الأثمان: ٤٨٠ ثمنًا تحت عناوين الأجزاء بأسمائها وأول كلماتها، والضغط ينقل إلى صفحته', async ({ page }) => {
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.page': '2' });
  await clickTopbar(page, 'القائمة');
  await menu(page).getByRole('tab', { name: 'السور' }).click();
  await menu(page).getByRole('radio', { name: 'الأثمان' }).click();
  await expect(menu(page).locator('.sidemenu__rubGroup')).toHaveCount(30);
  await expect(menu(page).locator('.sidemenu__rubGroup').first().locator('li')).toHaveCount(16);
  const rows = menu(page).locator('.sidemenu__rubs > li');
  await expect(rows).toHaveCount(480);
  // الحزب الأول: رقمه ثم ⅛ ¼ ⅜ ½ ⅝ ¾ ⅞
  await expect(menu(page).locator('.sidemenu__rubGroup').first().locator('.sidemenu__suraNum')).toHaveText([
    '١', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', '٢', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞',
  ]);
  await expect(rows.nth(1)).toContainText('ثمن الحزب ١');
  await expect(rows.nth(3)).toContainText('ثلاثة أثمان الحزب ١');
  // الثمن الذي يبدأ في وسط آية: أول كلماته من بعد ۞ (البقرة ٨٤ «وإن ياتوكم أسرى»)
  await expect(rows.nth(9)).toContainText('ثمن الحزب ٢');
  await expect(rows.nth(9)).toContainText('وإن ياتوكم أسرى تفدوهم');
  await expect(rows.nth(467)).toContainText('ثلاثة أثمان الحزب ٥٩');
  await expect(rows.nth(467)).toContainText('إذا الشمس كورت');
  await expect(rows.nth(467)).toContainText('صفحة ٥٨٦');
  await rows.nth(467).locator('button').click();
  await expect.poll(() => savedPage(page)).toBe(586);
});

test('ثمن في وسط آية (البقرة ٨٤): تومض علامته ۞ وحدها بلون التطبيق، والرسالة «بداية ثمن الحزب»', async ({ page }, testInfo) => {
  const v = at(2, 84);
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.rubAlert': 'on', 'hq.page': '12' });
  await expect(toast(page)).toHaveCount(0);
  await expect(rub(page, v)).toHaveCount(0);
  await flipTo(page, 13);
  if (!isLaptop(testInfo)) await expect(toast(page)).toHaveText('بداية ثمن الحزب');
  else await expect(toast(page)).toHaveText(/^بداية (ثمن|ربع) الحزب$/);
  await expect(rub(page, v)).toHaveCount(1);
  await expect(rub(page, v)).toHaveClass(/w__rub--flash/);
  // العلامة وسط الآية: قبلها كلمات من الآية نفسها في الصفحة
  const before = await page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${v}"]`).evaluateAll(
    (els) => els.findIndex((el) => el.querySelector('.w__rub'))
  );
  expect(before).toBeGreaterThan(0);
  // تتلوّن بلون التطبيق، لا الكلمة التي تليها
  const [mark, word] = await rub(page, v).evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.parentElement).color]);
  expect(mark).not.toBe(word);
  await expect(rub(page, v)).not.toHaveClass(/w__rub--flash/, { timeout: 6000 });
});

test('ثمن يبدأ بأول سورة: يومض إطار اسمها، والرسالة بنوعه (التكوير ثمن، والانفطار نصف الحزب)', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.rubAlert': 'on', 'hq.page': isLaptop(testInfo) ? '584' : '585' });
  await expect(toast(page)).toHaveCount(0);
  await flipTo(page, 586);
  await expect(toast(page)).toHaveText('بداية ثمن الحزب');
  await expect(page.locator('.sheet--current .line--rubflash')).toHaveAttribute('aria-label', 'سورة التكوير');
  await expect(page.locator('.line--rubflash')).toHaveCount(0, { timeout: 6000 });
  await flipTo(page, 587);
  await expect(toast(page)).toHaveText('بداية نصف الحزب');
  await expect(page.locator('.sheet--current .line--rubflash').first()).toHaveAttribute('aria-label', 'سورة الانفطار');
});

test('التنبيه بالأثمان ملغى افتراضيًّا في ورش أيضًا: لا رسالة ولا وميض', async ({ page }) => {
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.page': '12' });
  await flipTo(page, 13);
  await page.waitForTimeout(500);
  await expect(toast(page)).toHaveCount(0);
  await expect(page.locator('.w__rub--flash, .line--rubflash')).toHaveCount(0);
  // والعلامة في مكانها برمزها
  await expect(rub(page, at(2, 84))).toHaveCount(1);
});
