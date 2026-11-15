// مصحف ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ١): اختيار الرواية عند أول فتح ومن الإعدادات، وعرض مصحف ورش،
// والضغط المطوّل فيه، وما يبقى متوقفًا فيه بعد ربط ترقيمه بحفص (الجلسة ٢): الاستماع والأرباع.
// وما يعمل بالربط (المحتوى والعلامات والملاحظات والمقادير) في warsh-map.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clickTopbar, copied, isLaptop, openApp, prepare, savedPage, showChrome, shownPages, waitMushaf } from './helpers.js';

const W = JSON.parse(readFileSync(new URL('../../public/data/warsh/quran.json', import.meta.url), 'utf8'));
const at = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const SOON = 'تُتاح برواية ورش قريبًا';
const warshPage = (page) => page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first();
const wword = (page, v) => page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${v}"]`).first();
const toast = (page) => page.locator('.toast');

async function longPressWarsh(page, v) {
  const box = await wword(page, v).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('.vmenu__picker')).toBeVisible();
}

test.describe('اختيار الرواية عند أول فتح', () => {
  test('تظهر الشاشة بالروايتين، و«ورش» يفتح مصحف ورش، ولا تعود بعد إعادة الفتح', async ({ page }) => {
    await prepare(page, { 'hq.riwayah': null, 'hq.page': '262' });
    await page.goto('/');
    const chooser = page.getByRole('dialog', { name: 'رواية المصحف' });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('button')).toHaveText([/حفص عن عاصم/, /ورش عن نافع/]);
    // المصحف تحتها لا يستقبل التقليب بالمفاتيح
    await page.keyboard.press('ArrowLeft');
    await chooser.getByRole('button', { name: /ورش عن نافع/ }).click();
    await expect(chooser).toHaveCount(0);
    await expect(warshPage(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('hq.riwayah'))).toBe('warsh');
    expect(await savedPage(page)).toBe(262);
    await page.reload();
    await expect(warshPage(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toHaveCount(0);
  });

  test('«حفص» يبقي مصحف حفص، ولا تعود الشاشة', async ({ page }) => {
    await prepare(page, { 'hq.riwayah': null });
    await page.goto('/');
    await page.getByRole('button', { name: /حفص عن عاصم/ }).click();
    await waitMushaf(page);
    await expect(page.locator('.mushaf-page--warsh')).toHaveCount(0);
    await page.reload();
    await waitMushaf(page);
    await expect(page.getByRole('dialog', { name: 'رواية المصحف' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('hq.riwayah'))).toBe('hafs');
  });
});

test('التبديل من الإعدادات: المصحف كله على الصفحة نفسها، ثم الرجوع إلى حفص', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '263' });
  const before = await shownPages(page);
  await clickTopbar(page, 'الإعدادات');
  const row = page.getByRole('radiogroup', { name: 'الرواية' });
  await expect(row.getByRole('radio', { name: 'حفص' })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'ورش' }).click();
  await expect(row.getByRole('radio', { name: 'ورش' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(warshPage(page)).toBeVisible();
  expect(await shownPages(page)).toEqual(before);
  expect(await page.locator('.sheet--current .mushaf-page--warsh').count()).toBe(isLaptop(testInfo) ? 2 : 1);
  // أول الحجر في الصفحة ٢٦٢، فالصفحة ٢٦٣ تبدأ بآية من الحجر بترقيم ورش
  await clickTopbar(page, 'الإعدادات');
  await page.getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name: 'حفص' }).click();
  await page.keyboard.press('Escape');
  await waitMushaf(page);
  await expect(page.locator('.mushaf-page--warsh')).toHaveCount(0);
  expect(await shownPages(page)).toEqual(before);
});

test.describe('مصحف ورش', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, { 'hq.riwayah': 'warsh', 'hq.page': '2' });
    await expect(warshPage(page)).toBeVisible();
  });

  test('صفحته بأسطر المطبوع وكلمات آياته بترقيم ورش، وترويستها كحفص', async ({ page }) => {
    const sheet = page.locator('.sheet--current[aria-label="الصفحة ٢"]');
    await expect(sheet.locator('.line--sura')).toHaveAttribute('aria-label', 'سورة البقرة');
    await expect(sheet.locator('.line--basmala-warsh')).toHaveText(W.qcf.basmalaText);
    // البقرة ١–٤ في الصفحة الثانية (وفي حفص ١–٥)، وآخرها رقمها بلون التطبيق
    for (const a of [1, 2, 3, 4]) await expect(wword(page, at(2, a))).toBeVisible();
    await expect(sheet.locator(`.w[data-v="${at(2, 5)}"]`)).toHaveCount(0);
    await expect(sheet.locator('.w--aya')).toHaveCount(4);
  });

  test('الضغط المطوّل: اسم الآية بترقيم ورش، والنسخ بنصّها، و«تشغيل» وحده يُتاح لاحقًا', async ({ page }) => {
    const v = at(2, 4);
    await longPressWarsh(page, v);
    const box = page.getByRole('dialog', { name: 'البقرة: ٤' });
    await expect(box).toBeVisible();
    await expect(wword(page, v)).toHaveClass(/w--selected/);
    const items = box.locator('.vmenu__picker [role="menuitem"]');
    await expect(items).toHaveText(['تشغيل', 'علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']);
    await expect(box.getByRole('menuitem', { name: 'تشغيل' })).toHaveAttribute('aria-disabled', 'true');
    for (const name of ['علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']) {
      await expect(box.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled', 'true');
    }
    // المتوقف: رسالة، ويبقى المربع على حاله
    // (aria-disabled: يُعلن متوقفًا لقارئ الشاشة ويُضغط مع ذلك؛ وأداة الاختبار لا تضغطه إلا بـforce)
    await box.getByRole('menuitem', { name: 'تشغيل' }).click({ force: true });
    await expect(toast(page)).toHaveText(SOON);
    await expect(box.locator('.vmenu__picker')).toBeVisible();
    // النسخ بنص ورش وترقيمه
    await box.getByRole('menuitem', { name: 'نسخ' }).click();
    await expect(page.locator('.vmenu')).toHaveCount(0);
    const text = W.verses[v].t.slice(0, -1).join(' ');
    expect(await copied(page)).toBe(`﴿${text}﴾ [البقرة: ٤]`);
  });

  test('الاستماع: رسالة بدل الفتح', async ({ page }) => {
    await showChrome(page);
    await page.locator('.dock').getByRole('button', { name: 'الاستماع للآيات' }).click({ force: true });
    await expect(toast(page)).toHaveText(SOON);
    await expect(page.locator('.listen')).toHaveCount(0);
  });

  test('القائمة: السور بعدد آيات ورش وتنقل إليها، والأرباع تُتاح لاحقًا', async ({ page }) => {
    await clickTopbar(page, 'القائمة');
    const menu = page.getByRole('dialog', { name: 'القائمة' });
    await menu.getByRole('tab', { name: 'السور' }).click();
    const baqara = menu.locator('.sidemenu__suras button').nth(1);
    await expect(baqara).toContainText('سورة البقرة');
    await expect(baqara).toContainText('٢٨٥');
    await menu.getByRole('radio', { name: 'الأرباع' }).click();
    await expect(menu.locator('.sidemenu__empty')).toContainText(SOON);
    await menu.getByRole('radio', { name: 'السور' }).click();
    await menu.locator('.sidemenu__suras button').filter({ hasText: /سورة الحجر(?!ات)/ }).click();
    // الانتقال يكتمل بعد إغلاق القائمة بقليل، فيُنتظر حفظ الصفحة الجديدة
    await expect.poll(() => savedPage(page)).toBe(262);
    await expect(warshPage(page)).toBeVisible();
  });

  test('البحث بالسورة ورقم الآية بترقيم ورش: ينقل إلى صفحتها ويميّزها', async ({ page }) => {
    await clickTopbar(page, 'ابحث في المصحف بالكلمات والأرقام');
    await page.locator('.searchov input').fill('البقرة ٢٨٥');
    const hit = page.locator('.searchov__refHit').first();
    await expect(hit).toContainText('البقرة ٢٨٥');
    await hit.click();
    const v = at(2, 285);
    await expect(wword(page, v)).toHaveClass(/w--flash/);
    expect((await shownPages(page)).includes(W.verses[v].p)).toBe(true);
  });

  test('وضع القراءة بصفحات ورش، والخروج منه إلى مصحف ورش', async ({ page }) => {
    await clickTopbar(page, 'الإعدادات');
    await page.locator('.settings').getByRole('button', { name: 'وضع القراءة', exact: true }).click();
    await page.locator('.settings').getByRole('button', { name: 'ابدأ وضع القراءة' }).click();
    await expect(page.locator('.mushaf-page--warsh:not(.mushaf-page--pending)').first()).toBeVisible();
    await expect(page.locator('.mushaf-page:not(.mushaf-page--warsh)')).toHaveCount(0);
    await page.getByRole('button', { name: 'الخروج من وضع القراءة' }).click({ force: true });
    await expect(warshPage(page)).toBeVisible();
  });
});
