// «مشاركة» صور صفحات المحتوى (٢٠٢٦-١١-٢٣، «المشاركة» الجلسة ٢): زرّ بجانب «نسخ المحتوى» في التبويبات الأربعة،
// يفتح معاينة صور آيات المقدار ومحتواها، والمقدار الأطول من ٤ صور يُشارَك أوله بتنبيه ما شُورك منه
import { test, expect } from '@playwright/test';
import { QURAN, clickDock, openApp } from './helpers.js';

const study = (page) => page.locator('section.study');
const preview = (page) => page.getByRole('dialog', { name: 'مشاركة صورة' });
const shareBtn = (page) => study(page).locator('.study__copy').getByRole('button', { name: 'مشاركة' });
const vOf = (s, a) => QURAN.verses.findIndex((x) => x.s === s && x.a === a);

const sizes = (page) =>
  preview(page)
    .locator('img')
    .evaluateAll((els) => Promise.all(els.map(async (img) => (await img.decode(), [img.naturalWidth, img.naturalHeight]))));

async function mockShare(page) {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = (data) => Array.isArray(data?.files) && data.files.length > 0;
    navigator.share = async (data) => {
      window.__shared.push({ text: data.text, files: data.files.map((f) => f.name) });
    };
  });
}

test('في التبويبات الأربعة «مشاركة» بجانب «نسخ المحتوى»، وتفتح معاينة صور المقدار بمقاسها', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.contentRange': '[1,3]' });
  await clickDock(page, 'التدبّر');
  for (const tab of ['تفسير', 'معاني الكلمات', 'العمل بالآيات', 'الفوائد']) {
    await study(page).getByRole('tab', { name: tab }).click();
    await expect(study(page).locator('.study__copy > button')).toHaveText(['نسخ المحتوى', 'مشاركة']);
    await shareBtn(page).click();
    await expect(preview(page).locator('img').first()).toBeVisible();
    for (const s of await sizes(page)) expect(s).toEqual([1080, 1350]);
    await page.keyboard.press('Escape');
    await expect(preview(page)).toHaveCount(0);
    // وتبقى صفحات المحتوى مفتوحة
    await expect(study(page)).toHaveClass(/study--open/);
  }
});

test('المشاركة بقائمة الجهاز: الصور باسم المقدار ومعها سطر «من تطبيق قرآن السلف»', async ({ page }) => {
  await mockShare(page);
  await openApp(page, { 'hq.page': '1', 'hq.contentRange': '[1,3]' });
  await clickDock(page, 'التدبّر');
  await shareBtn(page).click();
  await expect(preview(page).locator('img').first()).toBeVisible();
  await preview(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
  const [shared] = await page.evaluate(() => window.__shared);
  expect(shared.text).toBe('من تطبيق قرآن السلف\nhttps://quran-alsalaf.github.io/');
  // الفاتحة ٢–٤
  expect(shared.files[0]).toMatch(/^quran-alsalaf-tafsir-1-2-4(-1)?\.png$/);
});

test('المقدار الأطول من ٤ صور: أربع صور وتنبيه ما شُورك منه من أصل آيات المقدار', async ({ page }) => {
  const range = [vOf(2, 1), vOf(2, 60)];
  await openApp(page, { 'hq.page': '2', 'hq.contentRange': JSON.stringify(range) });
  await clickDock(page, 'التدبّر');
  await shareBtn(page).click();
  await expect(preview(page).locator('img')).toHaveCount(4);
  await expect(preview(page).locator('.shareimg__note')).toHaveText(
    /^المقدار أطول من ٤ صور، فشُورك من البقرة ١ إلى [٠-٩]+ من أصل ٦٠ آية، وفي آخر الأخيرة «التتمة في تطبيق قرآن السلف»\.$/
  );
});

test('تبويب بلا محتوى للمقدار (معاني آيات لم تُشرح): «مشاركة» معطّل كالنسخ', async ({ page }) => {
  await openApp(page, { 'hq.page': '300' });
  await clickDock(page, 'التدبّر');
  await study(page).getByRole('tab', { name: 'معاني الكلمات' }).click();
  await expect(shareBtn(page)).toBeDisabled();
  await expect(study(page).getByRole('button', { name: 'نسخ المحتوى' })).toBeDisabled();
});

test('في رواية ورش: صور المقدار بآيات ورش', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.riwayah': 'warsh' });
  await clickDock(page, 'التدبّر');
  await shareBtn(page).click();
  await expect(preview(page).locator('img').first()).toBeVisible();
  for (const s of await sizes(page)) expect(s).toEqual([1080, 1350]);
});
