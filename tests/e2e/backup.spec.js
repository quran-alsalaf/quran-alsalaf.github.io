// النسخة الاحتياطية والاستعادة (٢٠٢٦-١١-١٦): حفظ نسخة من الإعدادات وتنزيلها، ثم استعادتها على جهاز آخر
// (متصفح فارغ ببيانات مختلفة) بعد الملخّص والتأكيد، والإلغاء، والملف غير الصالح
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { clickTopbar, openApp, savedPage, shownPages, stored, waitMushaf } from './helpers.js';

const settings = (page) => page.locator('.settings');
const saveButton = (page) => settings(page).getByRole('button', { name: /حفظ نسخة احتياطية/ });
const restoreButton = (page) => settings(page).getByRole('button', { name: 'استعادة من نسخة' });
const dialog = (page) => page.getByRole('alertdialog');

// بيانات جهاز المستخدم الأول
const DEVICE_A = {
  'hq.page': '50',
  'hq.bg': 'black',
  'hq.accent': 'emerald',
  'hq.notes': { 300: 'تدبّر هذه الآية' },
  'hq.bookmarks': [
    { id: 1, name: 'أخطائي', color: '#c0392b', multi: true, verses: [{ v: 290, at: 1 }, { v: 295, at: 2 }] },
    { id: 2, name: 'وقفت هنا', color: '#2e7bc4', multi: false, verses: [{ v: 310, at: 3 }] },
    { id: 3, name: 'مراجعة', color: '#3f8f3f', multi: true, verses: [] },
  ],
  'hq.rubAlert': 'on',
  'hq.searchHistory': ['الصبر'],
};

// يفتح الإعدادات ثم صفحة «النسخة الاحتياطية» الفرعية (سطر واحد في الإعدادات، وفيها خياراها)
async function openSettings(page) {
  await clickTopbar(page, 'الإعدادات');
  await expect(settings(page)).toHaveClass(/settings--open/);
  await settings(page).getByRole('button', { name: 'النسخة الاحتياطية' }).click();
  await expect(saveButton(page)).toBeVisible();
}

// يحفظ نسخة من الإعدادات ويرجع نص الملف واسمه
async function saveBackup(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), saveButton(page).click()]);
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
}

test('النسخة الاحتياطية سطر واحد في الإعدادات يفتح صفحة فيها خياراها، وسهم الرجوع يعيد إلى الإعدادات', async ({ page }) => {
  await openApp(page, DEVICE_A);
  await clickTopbar(page, 'الإعدادات');
  const row = settings(page).getByRole('button', { name: 'النسخة الاحتياطية' });
  await expect(row).toBeVisible();
  // الخياران داخل الصفحة الفرعية لا في الإعدادات نفسها
  await expect(saveButton(page)).not.toBeVisible();
  await expect(restoreButton(page)).not.toBeVisible();
  await row.click();
  const sub = settings(page).locator('.settings__page--in');
  await expect(sub.getByRole('heading', { name: 'النسخة الاحتياطية' })).toBeVisible();
  await expect(sub.getByRole('button', { name: /حفظ نسخة احتياطية/ })).toBeVisible();
  await expect(sub.getByRole('button', { name: 'استعادة من نسخة' })).toBeVisible();
  await sub.getByRole('button', { name: 'رجوع' }).click();
  await expect(row).toBeVisible();
  await expect(saveButton(page)).not.toBeVisible();
});

test('حفظ نسخة: ملف فيه البيانات، وسطر «آخر نسخة» يتحدّث', async ({ page }) => {
  await openApp(page, DEVICE_A);
  await openSettings(page);
  await expect(saveButton(page)).toContainText('لم تحفظ نسخة بعد');
  const { name, text } = await saveBackup(page);
  expect(name).toMatch(/^quran-alsalaf-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(text);
  expect(file.app).toBe('quran-alsalaf');
  expect(file.version).toBe(1);
  expect(file.data['hq.page']).toBe(50);
  expect(file.data['hq.bookmarks']).toHaveLength(3);
  expect(file.data['hq.notes']).toEqual({ 300: 'تدبّر هذه الآية' });
  expect(file.data).not.toHaveProperty('hq.searchHistory');
  await expect(saveButton(page)).toContainText('آخر نسخة: اليوم');
  // ويبقى بعد إعادة الفتح
  await page.reload();
  await openSettings(page);
  await expect(saveButton(page)).toContainText('آخر نسخة: اليوم');
});

test('الاستعادة على جهاز آخر: الملخّص ثم التأكيد، فتعود البيانات والموضع والمظهر', async ({ page }) => {
  await openApp(page, DEVICE_A);
  await openSettings(page);
  const { text } = await saveBackup(page);

  // «جهاز آخر»: تُمحى بيانات المتصفح كلها ويُكتب غيرها، ثم يُعاد الفتح
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('hq.riwayah', 'hafs');
    localStorage.setItem('hq.page', '3');
    localStorage.setItem('hq.notes', JSON.stringify({ 5: 'ستُمحى' }));
    localStorage.setItem('hq.searchHistory', JSON.stringify(['الرحمن']));
  });
  await page.reload();
  await waitMushaf(page);
  expect(await shownPages(page)).toContain(3);

  await openSettings(page);
  await expect(saveButton(page)).toContainText('لم تحفظ نسخة بعد');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), restoreButton(page).click()]);
  await chooser.setFiles({ name: 'نسخة.json', mimeType: 'application/json', buffer: Buffer.from(text) });

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('رواية حفص عن عاصم');
  await expect(dialog(page)).toContainText('٣ علامات');
  await expect(dialog(page)).toContainText('ملاحظة واحدة');
  await expect(dialog(page)).toContainText('لا ختمات');
  await expect(dialog(page)).toContainText('ستُستبدل بياناتك الحالية كلها');

  await Promise.all([page.waitForEvent('load'), dialog(page).getByRole('button', { name: 'استعادة' }).click()]);
  await waitMushaf(page);

  expect(await stored(page, 'hq.notes')).toEqual({ 300: 'تدبّر هذه الآية' });
  expect((await stored(page, 'hq.bookmarks')).map((b) => b.name)).toEqual(['أخطائي', 'وقفت هنا', 'مراجعة']);
  expect(await page.evaluate(() => localStorage.getItem('hq.rubAlert'))).toBe('on');
  // سجل البحث خاص بالجهاز: يبقى
  expect(await stored(page, 'hq.searchHistory')).toEqual(['الرحمن']);
  // الموضع والمظهر
  expect(await savedPage(page)).toBe(50);
  expect(await shownPages(page)).toContain(50);
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'black');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'emerald');
  // وتاريخ آخر نسخة خاص بكل جهاز: هذا «الجهاز» لم يحفظ نسخة
  await openSettings(page);
  await expect(saveButton(page)).toContainText('لم تحفظ نسخة بعد');
});

test('إلغاء الاستعادة لا يغيّر شيئًا', async ({ page }) => {
  await openApp(page, DEVICE_A);
  await openSettings(page);
  const backup = { app: 'quran-alsalaf', version: 1, created: new Date().toISOString(), data: { 'hq.page': 9 } };
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), restoreButton(page).click()]);
  await chooser.setFiles({ name: 'نسخة.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(dialog(page)).toContainText('لا علامات');
  await dialog(page).getByRole('button', { name: 'إلغاء' }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await savedPage(page)).toBe(50);
  expect(await stored(page, 'hq.bookmarks')).toHaveLength(3);
  // والإعدادات ما زالت مفتوحة
  await expect(settings(page)).toHaveClass(/settings--open/);
});

test('ملف غير صالح: رسالة واضحة ولا يتغيّر شيء', async ({ page }) => {
  await openApp(page, DEVICE_A);
  await openSettings(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), restoreButton(page).click()]);
  await chooser.setFiles({ name: 'صورة.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
  await expect(dialog(page)).toContainText('تعذّرت الاستعادة');
  await expect(dialog(page)).toContainText('ليس نسخة احتياطية من «قرآن السلف»');
  await dialog(page).getByRole('button', { name: 'حسنًا' }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page, 'hq.notes')).toEqual({ 300: 'تدبّر هذه الآية' });
});

// أجهزة اللمس: قائمة المشاركة بدل التنزيل (محاكاة المشاركة)، وإغلاقها بلا اختيار لا يُعدّ نسخة
test('الجوال: الحفظ بقائمة المشاركة، وإغلاقها لا يُعدّ نسخة', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = [];
    window.__shareAbort = true;
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q === '(pointer: coarse)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    navigator.canShare = (d) => Array.isArray(d?.files);
    navigator.share = async (d) => {
      if (window.__shareAbort) throw new DOMException('cancelled', 'AbortError');
      window.__shared.push({ name: d.files[0].name, text: await d.files[0].text() });
    };
  });
  await openApp(page, DEVICE_A);
  await openSettings(page);
  await saveButton(page).click();
  await expect(saveButton(page)).toBeEnabled();
  await expect(saveButton(page)).toContainText('لم تحفظ نسخة بعد');
  await page.evaluate(() => (window.__shareAbort = false));
  await saveButton(page).click();
  await expect(saveButton(page)).toContainText('آخر نسخة: اليوم');
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].name).toMatch(/^quran-alsalaf-backup-/);
  expect(JSON.parse(shared[0].text).data['hq.page']).toBe(50);
});
