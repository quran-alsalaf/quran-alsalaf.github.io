// «تطوير الملاحظات» (٢٠٢٦-١١-١٥): إدراج الآية في الملاحظة بخط المصحف في مستطيل منفصل وإزالتها،
// والمشاركة بدل النسخ (الآية إن أُدرجت ثم التعليق ثم اسم التطبيق ورابطه)، وتبويب «الملاحظات»
// (علامة «الآية مُدرجة»، والمشاركة، والتعديل في بطاقة الملاحظة نفسها)
import { test, expect } from '@playwright/test';
import { QURAN, clickTopbar, copied, longPress, openApp, stored, toArabic } from './helpers.js';

const SIGNATURE = 'تطبيق قرآن السلف\nhttps://quran-alsalaf.github.io/';
const plain = (v) => QURAN.verses[v].t.slice(0, -1).join(' ');
const oneVerse = (v) => `﴿${plain(v)}﴾ [${QURAN.suras[QURAN.verses[v].s - 1].name}: ${toArabic(QURAN.verses[v].a)}]`;
const card = (page) => page.getByRole('dialog', { name: 'ملاحظة' });
const side = (page) => page.locator('.sidemenu');
const toast = (page) => page.locator('.toast');

// قائمة المشاركة في الجهاز محاكاة: يُحفظ ما أُرسل إليها نصًّا. وnone: متصفح بلا مشاركة (فيُنسخ النص)
const mockShare = (page, none = false) =>
  page.evaluate((none) => {
    window.__shared = [];
    const share = none ? undefined : (data) => (window.__shared.push(data.text), Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  }, none);
const shared = (page) => page.evaluate(() => window.__shared.at(-1));

const openNote = async (page, v) => {
  await longPress(page, v);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
};

// كل اختبار يفتح التطبيق ببياناته (البيانات المحلية تُكتب عند أول فتح فقط)
const open = (page, notes) => openApp(page, { 'hq.page': '1', ...(notes && { 'hq.notes': notes }) });

test('إدراج الآية: لا تظهر قبله، ثم مستطيل منفصل بخط المصحف أعلى الملاحظة، وتحته التعليق', async ({ page }) => {
  await open(page);
  await openNote(page, 2);
  await expect(card(page).locator('.vnote__verse')).toHaveCount(0);
  await card(page).getByRole('button', { name: 'إدراج الآية' }).click();

  const block = card(page).getByRole('group', { name: 'الآية المُدرجة' });
  await expect(block).toHaveText(QURAN.verses[2].t.join(' '));
  await expect(card(page).getByRole('button', { name: 'إدراج الآية' })).toHaveCount(0);
  // بخط المصحف، ولا يُكتب فيه: ليس خانة كتابة، ونص الآية ليس في خانة التعليق
  expect(await block.locator('p').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('UthmanicHafs');
  expect(await block.evaluate((el) => el.isContentEditable || !!el.querySelector('textarea,input,[contenteditable="true"]'))).toBe(false);
  const area = card(page).locator('.vcard__textarea');
  await expect(area).toHaveValue('');
  await expect(area).toBeFocused();
  // المستطيل فوق خانة التعليق
  const b = await block.boundingBox();
  const a = await area.boundingBox();
  expect(b.y + b.height).toBeLessThanOrEqual(a.y + 0.5);

  await area.fill('تعليقي على الآية');
  await card(page).getByRole('button', { name: 'حفظ' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ 2: { text: 'تعليقي على الآية', verse: true } });
  await expect(page.locator('.sheet--current .w[data-v="2"] .w__notebook')).toHaveCount(1);

  // يبقى كما هو عند فتحها من جديد
  await openNote(page, 2);
  await expect(card(page).getByRole('group', { name: 'الآية المُدرجة' })).toHaveCount(1);
  await expect(card(page).locator('.vcard__textarea')).toHaveValue('تعليقي على الآية');
});

test('✕ يزيل الآية ويُبقي التعليق ويُرجع زرّ الإدراج، ويُحفظ ذلك', async ({ page }) => {
  await open(page, { 3: { text: 'باقٍ', verse: true } });
  await openNote(page, 3);
  await card(page).getByRole('button', { name: 'إزالة الآية من الملاحظة' }).click();
  await expect(card(page).locator('.vnote__verse')).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'إدراج الآية' })).toBeVisible();
  await expect(card(page).locator('.vcard__textarea')).toHaveValue('باقٍ');
  await page.keyboard.press('Escape');
  expect(await stored(page, 'hq.notes')).toEqual({ 3: 'باقٍ' });
});

test('الآية وحدها بلا تعليق تُحفظ ملاحظةً، وزرّ الحذف يحذف الآية والتعليق معًا', async ({ page }) => {
  await open(page);
  await openNote(page, 4);
  // لا مشاركة قبل أن يكون في الملاحظة شيء
  await expect(card(page).getByRole('button', { name: 'مشاركة' })).toHaveCount(0);
  await card(page).getByRole('button', { name: 'إدراج الآية' }).click();
  await expect(card(page).getByRole('button', { name: 'مشاركة' })).toBeVisible();
  await card(page).getByRole('button', { name: 'رجوع' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ 4: { text: '', verse: true } });
  await page.keyboard.press('Escape');

  await openNote(page, 4);
  await card(page).locator('.vcard__textarea').fill('مع تعليق');
  await card(page).getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(toast(page)).toHaveText('حُذفت الملاحظة');
  expect(await stored(page, 'hq.notes')).toEqual({});
  await expect(page.locator('.sheet--current .w__notebook')).toHaveCount(0);
});

test('المشاركة بدل النسخ: الآية ثم التعليق ثم اسم التطبيق ورابطه، أو التعليق وحده بلا آية', async ({ page }) => {
  await open(page);
  await mockShare(page);
  await openNote(page, 5);
  await expect(card(page).getByRole('button', { name: 'نسخ' })).toHaveCount(0);
  await card(page).locator('.vcard__textarea').fill('تأمل هذه الآية');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect.poll(() => shared(page)).toBe(`تأمل هذه الآية\n\n${SIGNATURE}`);

  await card(page).getByRole('button', { name: 'إدراج الآية' }).click();
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect.poll(() => shared(page)).toBe(`${oneVerse(5)}\n\nتأمل هذه الآية\n\n${SIGNATURE}`);
  // المشاركة تحفظ الملاحظة كما هي
  expect(await stored(page, 'hq.notes')).toEqual({ 5: { text: 'تأمل هذه الآية', verse: true } });
});

test('بلا قائمة مشاركة في المتصفح (أكثر الحواسيب): يُنسخ نص المشاركة، وتظهر «نُسخت الملاحظة»', async ({ page }) => {
  await open(page);
  await mockShare(page, true);
  await openNote(page, 1);
  await card(page).getByRole('button', { name: 'إدراج الآية' }).click();
  await card(page).locator('.vcard__textarea').fill('الحمد');
  await card(page).getByRole('button', { name: 'مشاركة' }).click();
  await expect(toast(page)).toHaveText('نُسخت الملاحظة');
  expect(await copied(page)).toBe(`${oneVerse(1)}\n\nالحمد\n\n${SIGNATURE}`);
});

test('تبويب «الملاحظات»: علامة «الآية مُدرجة»، والمشاركة، والتعديل يفتح بطاقة الملاحظة نفسها', async ({ page }) => {
  await open(page, { 1: 'قديمة بلا آية', 6: { text: 'مع الآية', verse: true }, 3: { text: '', verse: true } });
  await mockShare(page);
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الملاحظات' }).click();
  const rows = side(page).locator('.sidemenu__row');
  await expect(rows).toHaveCount(3);
  await expect(rows.locator('.sidemenu__rowText')).toHaveText(['قديمة بلا آية', 'مع الآية']);
  await expect(rows.nth(0).locator('.sidemenu__withVerse')).toHaveCount(0);
  await expect(rows.nth(1).locator('.sidemenu__withVerse')).toHaveText('الآية مُدرجة');
  await expect(rows.nth(2).locator('.sidemenu__withVerse')).toHaveText('الآية مُدرجة');

  await rows.nth(2).getByRole('button', { name: 'مشاركة الملاحظة' }).click();
  await expect.poll(() => shared(page)).toBe(`${oneVerse(6)}\n\nمع الآية\n\n${SIGNATURE}`);
  await rows.nth(0).getByRole('button', { name: 'مشاركة الملاحظة' }).click();
  await expect.poll(() => shared(page)).toBe(`قديمة بلا آية\n\n${SIGNATURE}`);

  // التعديل: تُغلق القائمة وتُفتح بطاقة الملاحظة نفسها بآيتها وتعليقها
  await rows.nth(1).getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('.vcard__title span')).toHaveText('الفاتحة: ٤');
  await expect(card(page).getByRole('group', { name: 'الآية المُدرجة' })).toHaveCount(1);
  await card(page).getByRole('button', { name: 'إزالة الآية من الملاحظة' }).click();
  await card(page).locator('.vcard__textarea').fill('بلا آية الآن');
  await card(page).getByRole('button', { name: 'حفظ' }).click();
  expect((await stored(page, 'hq.notes'))[3]).toBe('بلا آية الآن');
});
