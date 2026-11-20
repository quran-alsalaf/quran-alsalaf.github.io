// مصحف ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ١): اختيار الرواية عند أول فتح ومن الإعدادات، وعرض مصحف ورش،
// والضغط المطوّل فيه. والاستماع بقرّاء ورش (الجلسة ٣) بمحاكاة الصوت.
// وما يعمل بالربط (المحتوى والعلامات والملاحظات والمقادير) في warsh-map.spec.js، والأثمان في warsh-athman.spec.js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { clickTopbar, closeSettingsPanel, copied, isLaptop, openApp, openCustomSettings, prepare, savedPage, showChrome, shownPages, waitMushaf } from './helpers.js';

const W = JSON.parse(readFileSync(new URL('../../public/data/warsh/quran.json', import.meta.url), 'utf8'));
const at = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const warshPage = (page) => page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first();
const wword = (page, v) => page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${v}"]`).first();
const toast = (page) => page.locator('.toast');
const listen = (page) => page.getByRole('dialog', { name: 'الاستماع للآيات' });
const picker = (page) => page.getByRole('dialog', { name: 'اختر القارئ' });
const lastSrc = (page) => page.evaluate(() => window.__audio.srcs.at(-1));
const end = (page) => page.evaluate(() => window.__audio.end());
const WARSH_NAMES = ['محمود خليل الحصري', 'عبد الباسط عبد الصمد', 'إبراهيم الدوسري', 'ياسين الجزائري', 'العيون الكوشي'];

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
  await openCustomSettings(page);
  const row = page.getByRole('radiogroup', { name: 'الرواية' });
  await expect(row.getByRole('radio', { name: 'حفص' })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'ورش' }).click();
  await expect(row.getByRole('radio', { name: 'ورش' })).toHaveAttribute('aria-checked', 'true');
  await closeSettingsPanel(page);
  await expect(warshPage(page)).toBeVisible();
  expect(await shownPages(page)).toEqual(before);
  expect(await page.locator('.sheet--current .mushaf-page--warsh').count()).toBe(isLaptop(testInfo) ? 2 : 1);
  // أول الحجر في الصفحة ٢٦٢، فالصفحة ٢٦٣ تبدأ بآية من الحجر بترقيم ورش
  await openCustomSettings(page);
  await page.getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name: 'حفص' }).click();
  await closeSettingsPanel(page);
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

  test('الضغط المطوّل: اسم الآية بترقيم ورش، والمربعات كلها متاحة، والنسخ بنصّها', async ({ page }) => {
    const v = at(2, 4);
    await longPressWarsh(page, v);
    const box = page.getByRole('dialog', { name: 'البقرة: ٤' });
    await expect(box).toBeVisible();
    await expect(wword(page, v)).toHaveClass(/w--selected/);
    const items = box.locator('.vmenu__picker [role="menuitem"]');
    await expect(items).toHaveText(['تشغيل', 'علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']);
    for (const name of ['تشغيل', 'علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']) {
      await expect(box.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled', 'true');
    }
    // النسخ بنص ورش وترقيمه
    await box.getByRole('menuitem', { name: 'نسخ' }).click();
    await expect(page.locator('.vmenu')).toHaveCount(0);
    const text = W.verses[v].t.slice(0, -1).join(' ');
    expect(await copied(page)).toBe(`﴿${text}﴾ [البقرة: ٤]`);
  });

  // قرّاء ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٣)
  test('الاستماع: الحصري قارئه الافتراضي، وقرّاء ورش الخمسة وحدهم، والبسملة ثم الآيات بترقيم ورش وتظليلها', async ({ page }, testInfo) => {
    await showChrome(page);
    await page.locator('.dock').getByRole('button', { name: 'الاستماع للآيات' }).click();
    await expect(listen(page)).toBeVisible();
    await expect(listen(page).locator('.listen__value').first()).toContainText('محمود خليل الحصري');
    await listen(page).getByRole('button', { name: /القارئ/ }).click();
    await expect(picker(page).locator('.rcpick__group-title')).toHaveText(['مرتّل']);
    await expect(picker(page).getByRole('radio')).toHaveText(WARSH_NAMES);
    await expect(picker(page).getByRole('radio', { name: 'محمود خليل الحصري' })).toHaveAttribute('aria-checked', 'true');
    // التحميل لكامل القرآن بحجمه (ثم إلغاء)
    await picker(page).getByRole('button', { name: 'تحميل ياسين الجزائري لكامل القرآن' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'تحميل ياسين الجزائري' });
    await expect(confirm).toContainText('٣٨٣ ميغابايت');
    await confirm.getByRole('button', { name: 'إلغاء' }).click();
    await picker(page).getByRole('button', { name: 'إغلاق' }).click();
    await listen(page).getByRole('button', { name: 'تشغيل' }).click();
    // من أول الظاهر: البقرة في الصفحة ٢ (والفاتحة في الصفحة ١ في عرض الصفحتين)، فالبسملة بصوت الحصري، ثم الآية ١
    // («الحمد لله…» في الفاتحة، و«الم ذلك الكتاب» في البقرة بترقيم ورش)، ثم ٢
    const s = isLaptop(testInfo) ? 1 : 2;
    expect(await lastSrc(page)).toBe(`https://files.quranpedia.net/recitations/261/00${s}000.mp3`);
    await expect(wword(page, at(s, 1))).toHaveClass(/w--playing/);
    await end(page);
    expect(await lastSrc(page)).toMatch(new RegExp(`/261/00${s}001\\.mp3$`));
    await end(page);
    expect(await lastSrc(page)).toMatch(new RegExp(`/261/00${s}002\\.mp3$`));
    await expect(wword(page, at(s, 2))).toHaveClass(/w--playing/);
    await expect(wword(page, at(s, 1))).not.toHaveClass(/w--playing/);
  });

  test('قارئ ورش المختار لا يغيّر قارئ حفص، وفي مصحف حفص لا يظهر قرّاء ورش', async ({ page }) => {
    await showChrome(page);
    await page.locator('.dock').getByRole('button', { name: 'الاستماع للآيات' }).click();
    await listen(page).getByRole('button', { name: /القارئ/ }).click();
    await picker(page).getByRole('radio', { name: 'العيون الكوشي' }).click();
    await expect(listen(page).locator('.listen__value').first()).toContainText('العيون الكوشي');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hq.listen')))).toMatchObject({ warshReciter: 'w-kouchi' });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hq.listen')).reciter ?? 'shuraym')).toBe('shuraym');
    await listen(page).getByRole('button', { name: 'إغلاق' }).click();
    // إلى حفص
    await openCustomSettings(page);
    await page.getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name: 'حفص' }).click();
    await closeSettingsPanel(page);
    await waitMushaf(page);
    await showChrome(page);
    await page.locator('.dock').getByRole('button', { name: 'الاستماع للآيات' }).click();
    await expect(listen(page).locator('.listen__value').first()).toContainText('سعود الشريم');
    await listen(page).getByRole('button', { name: /القارئ/ }).click();
    await expect(picker(page).getByRole('radio')).toHaveCount(37);
    for (const name of ['العيون الكوشي', 'ياسين الجزائري', 'إبراهيم الدوسري']) await expect(picker(page).getByRole('radio', { name })).toHaveCount(0);
  });

  test('تشغيل آية من مربعها: آيتا الملك ٩ و١٠ في ملف واحد تُظلَّلان معًا', async ({ page }) => {
    const v9 = at(67, 9);
    await page.evaluate((p) => localStorage.setItem('hq.page', String(p)), W.verses[v9].p);
    await page.reload();
    await expect(warshPage(page)).toBeVisible();
    await longPressWarsh(page, v9);
    await page.getByRole('menuitem', { name: 'تشغيل' }).click();
    await page.getByRole('button', { name: /تشغيل الآية وحدها/ }).click();
    await page.getByRole('button', { name: 'مرة', exact: true }).click();
    expect(await lastSrc(page)).toMatch(/\/261\/067009\.mp3$/);
    await expect(wword(page, v9)).toHaveClass(/w--playing/);
    await expect(wword(page, v9 + 1)).toHaveClass(/w--playing/);
    await end(page);
    await expect(page.locator('.w--playing')).toHaveCount(0);
  });

  test('القائمة: السور بعدد آيات ورش وتنقل إليها، والفهرس الثالث «الأثمان»', async ({ page }) => {
    await clickTopbar(page, 'القائمة');
    const menu = page.getByRole('dialog', { name: 'القائمة' });
    await menu.getByRole('tab', { name: 'السور' }).click();
    const baqara = menu.locator('.sidemenu__suras button').nth(1);
    await expect(baqara).toContainText('سورة البقرة');
    await expect(baqara).toContainText('٢٨٥');
    await expect(menu.locator('.sidemenu__index [role="radio"]')).toHaveText(['السور', 'الأجزاء', 'الأثمان']);
    await menu.getByRole('radio', { name: 'الأثمان' }).click();
    await expect(menu.locator('.sidemenu__empty')).toHaveCount(0);
    await expect(menu.locator('.sidemenu__rubs > li')).toHaveCount(480);
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
