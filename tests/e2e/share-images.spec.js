// «مشاركة» صور المحتوى من بطاقات مربع الآية (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): زرّ بجانب النسخ في البطاقات الأربع،
// يفتح معاينة الصور (١٠٨٠×١٣٥٠، بألوان مظهر المستخدم، حتى ٤ صور) وتحتها «مشاركة» و«حفظ في الصور»
import { test, expect } from '@playwright/test';
import { QURAN, longPress, openApp, pageVerses } from './helpers.js';

const preview = (page) => page.getByRole('dialog', { name: 'مشاركة صورة' });
const card = (page) => page.locator('.vcard');
const toast = (page) => page.locator('.toast');

async function openCard(page, v, name) {
  await longPress(page, v);
  await page.locator('.vmenu__picker').getByRole('menuitem', { name }).click();
}

// مقاس الصور المعروضة ولون أول نقطة فيها (الخلفية)
const images = (page) =>
  preview(page)
    .locator('img')
    .evaluateAll((els) =>
      Promise.all(
        els.map(async (img) => {
          await img.decode();
          const c = document.createElement('canvas');
          c.width = 4;
          c.height = 4;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 40, 600, 4, 4, 0, 0, 4, 4);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return { w: img.naturalWidth, h: img.naturalHeight, bg: [r, g, b] };
        })
      )
    );

// مشاركة المتصفح بالصور: تُسجَّل في window.__shared بدل قائمة الجهاز
async function mockShare(page) {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = (data) => Array.isArray(data?.files) && data.files.length > 0;
    navigator.share = async (data) => {
      window.__shared.push({ text: data.text, files: data.files.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
    };
  });
}

test('في البطاقات الأربع زرّ «مشاركة» بجانب النسخ، والنسخ كما هو', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  const v = pageVerses(1)[1]; // الفاتحة ٢: لها تفسير ومعانٍ وعمل وفوائد
  for (const name of ['تفسير', 'معاني', 'عمل', 'فوائد']) {
    await openCard(page, v, name);
    await expect(card(page).getByRole('button', { name: 'مشاركة' })).toBeVisible();
    await expect(card(page).getByRole('button', { name: 'نسخ' })).toBeVisible();
    await card(page).getByRole('button', { name: 'إغلاق' }).click();
  }
});

test('«مشاركة» تفتح معاينة الصورة بمقاس ١٠٨٠×١٣٥٠ وبخلفية القراءة المختارة، وEsc يغلقها وتبقى البطاقة', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.bg': 'gray', 'hq.accent': 'amber' });
  await openCard(page, pageVerses(1)[0], 'تفسير');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect(preview(page).locator('img')).toHaveCount(1);
  const [img] = await images(page);
  expect([img.w, img.h]).toEqual([1080, 1350]);
  // خلفية «رصاصي» ‎#2B2B2E
  expect(img.bg).toEqual([0x2b, 0x2b, 0x2e]);
  await expect(preview(page).getByRole('button', { name: 'مشاركة' })).toBeVisible();
  await expect(preview(page).getByRole('button', { name: 'حفظ في الصور' })).toBeVisible();
  // صورة واحدة: بلا نقاط تقليب
  await expect(preview(page).locator('.shareimg__dot')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(preview(page)).toHaveCount(0);
  await expect(card(page)).toBeVisible();
});

test('المحتوى الطويل صور مرقّمة حتى أربع، تُقلَّب بالنقاط', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await openCard(page, pageVerses(1)[1], 'فوائد');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  const imgs = preview(page).locator('img');
  await expect(imgs.first()).toBeVisible();
  const n = await imgs.count();
  expect(n).toBeGreaterThan(1);
  expect(n).toBeLessThanOrEqual(4);
  await expect(preview(page).locator('.shareimg__dot')).toHaveCount(n);
  for (const img of await images(page)) expect([img.w, img.h]).toEqual([1080, 1350]);
  await expect(preview(page).locator('.shareimg__dot').first()).toHaveAttribute('aria-current', 'true');
  await preview(page).locator('.shareimg__dot').nth(1).click();
  await expect(preview(page).locator('.shareimg__dot').nth(1)).toHaveAttribute('aria-current', 'true');
});

test('مشاركة الصور بقائمة الجهاز ومعها سطر «من تطبيق قرآن السلف» ورابطه', async ({ page }) => {
  await mockShare(page);
  await openApp(page, { 'hq.page': '1' });
  const v = pageVerses(1)[1];
  await openCard(page, v, 'معاني');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect(preview(page).locator('img')).toHaveCount(1);
  await preview(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
  const [shared] = await page.evaluate(() => window.__shared);
  expect(shared.text).toBe('من تطبيق قرآن السلف\nhttps://quran-alsalaf.github.io/');
  const { s, a } = QURAN.verses[v];
  expect(shared.files).toEqual([{ name: `quran-alsalaf-meanings-${s}-${a}.png`, type: 'image/png', size: expect.any(Number) }]);
  expect(shared.files[0].size).toBeGreaterThan(10000);
  // تبقى المعاينة مفتوحة (للحفظ أو مشاركة أخرى)
  await expect(preview(page)).toBeVisible();
});

test('حيث لا مشاركة صور (الحاسوب): «مشاركة» و«حفظ في الصور» يُنزّلان الصورة', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => false;
  });
  await openApp(page, { 'hq.page': '1' });
  await openCard(page, pageVerses(1)[1], 'عمل');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect(preview(page).locator('img')).toHaveCount(1);

  let download = page.waitForEvent('download');
  await preview(page).getByRole('button', { name: 'مشاركة' }).click();
  expect((await download).suggestedFilename()).toMatch(/^quran-alsalaf-actions-1-2\.png$/);
  await expect(toast(page)).toHaveText('نُزّلت الصورة');

  download = page.waitForEvent('download');
  await preview(page).getByRole('button', { name: 'حفظ في الصور' }).click();
  expect((await download).suggestedFilename()).toBe('quran-alsalaf-actions-1-2.png');
});

test('بطاقة بلا محتوى (آية لم تُشرح معانيها) بلا «مشاركة» ولا نسخ', async ({ page }) => {
  await openApp(page, { 'hq.page': '300' });
  await openCard(page, pageVerses(300)[0], 'معاني');
  await expect(card(page).locator('.vcard__empty')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'مشاركة' })).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'نسخ' })).toHaveCount(0);
});

test('في رواية ورش: الصورة بآية ورش', async ({ page }) => {
  await openApp(page, { 'hq.page': '1', 'hq.riwayah': 'warsh' });
  // آية في أول صفحة ورش (الفاتحة)
  const word = page.locator('.sheet--current .w[data-v]').nth(3);
  const box = await word.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.locator('.vmenu__picker').getByRole('menuitem', { name: 'تفسير' }).click();
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect(preview(page).locator('img').first()).toBeVisible();
  for (const img of await images(page)) expect([img.w, img.h]).toEqual([1080, 1350]);
});
