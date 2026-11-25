// الضغط المطوّل على آية وبطاقتها وكل خيار فيها
import { test, expect } from '@playwright/test';
import { clickDock, copied, downloadedTafsir, longPress, openApp, stored, word } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('الضغط المطوّل يفتح مربعًا كبيرًا بمربعاته الثمانية ويظلّل الآية', async ({ page }) => {
  await longPress(page, 2);
  const box = page.getByRole('dialog', { name: 'الفاتحة: ٣' });
  await expect(box.locator('.vbox__head')).toContainText('الفاتحة: ٣');
  const items = box.locator('.vmenu__picker [role="menuitem"]');
  await expect(items).toHaveText(['تشغيل', 'علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']);
  // الثمانية كلها داخل المربع وداخل الشاشة، ثلاثة في كل صف من اليمين، وكل مربع كبير (٧٢px فأكثر)
  const card = await box.boundingBox();
  const vp = page.viewportSize();
  const rects = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const b of rects) {
    expect(b.left).toBeGreaterThanOrEqual(card.x - 0.5);
    expect(b.right).toBeLessThanOrEqual(card.x + card.width + 0.5);
    expect(b.bottom).toBeLessThanOrEqual(card.y + card.height + 0.5);
    expect(b.height).toBeGreaterThanOrEqual(72);
    expect(b.width).toBeGreaterThanOrEqual(72);
  }
  const rows = [...new Set(rects.map((b) => Math.round(b.top)))];
  expect(rows.length).toBe(3);
  expect(rects.map((b) => rows.indexOf(Math.round(b.top)))).toEqual([0, 0, 0, 1, 1, 1, 2, 2]);
  // «تشغيل» و«تفسير» و«فوائد» في أقصى اليمين، و«نسخ» في الوسط تحت «معاني»، وأقصى اليسار تحته فارغ
  expect(rects[0].right).toBeGreaterThan(rects[1].right);
  expect(Math.round(rects[6].left)).toBe(Math.round(rects[3].left));
  expect(Math.round(rects[7].left)).toBe(Math.round(rects[4].left));
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(vp.width);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(vp.height);
  // وسط الشاشة أفقيًا
  expect(Math.abs(card.x + card.width / 2 - vp.width / 2)).toBeLessThan(2);
  await expect(word(page, 2)).toHaveClass(/w--selected/);
  // النقر خارجه يغلقه
  await page.locator('.vmenu__backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.vmenu')).toHaveCount(0);
  // وزرّ ✕ يغلقه
  await longPress(page, 2);
  await page.locator('.vbox').getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('تشغيل: الخياران في المربع نفسه، والرجوع وEsc يعيدان المربعات', async ({ page }) => {
  await longPress(page, 3);
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  const box = page.locator('.vbox');
  await expect(box.locator('.vbox__head h2')).toHaveText('تشغيل الآية');
  await expect(box.getByRole('button', { name: /تشغيل الآية وحدها/ })).toBeVisible();
  await expect(box.getByRole('button', { name: /بدء التشغيل من هذه الآية/ })).toBeVisible();
  // «وحدها» يُظهر عدد المرات تحته ويطويه
  const only = box.getByRole('button', { name: /تشغيل الآية وحدها/ });
  await only.click();
  await expect(only).toHaveAttribute('aria-expanded', 'true');
  await expect(box.getByRole('group', { name: 'عدد المرات' })).toBeVisible();
  await only.click();
  await expect(box.getByRole('group', { name: 'عدد المرات' })).toHaveCount(0);
  // الرجوع
  await box.getByRole('button', { name: 'رجوع' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(8);
  // Esc في خيارات التشغيل يرجع إلى المربعات، ثم يغلق
  await page.getByRole('menuitem', { name: 'تشغيل' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
  await expect(page.locator('.w--playing')).toHaveCount(0);
});

test('الزر الأيمن على آية يفتح بطاقتها، وEsc يغلقها', async ({ page }) => {
  await word(page, 3).click({ button: 'right' });
  await expect(page.locator('.vmenu__picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('تفسير: التفسير المختار وحده للآية، والتبديل من أعلى البطاقة يتبعه صفحات المحتوى', async ({ page }) => {
  await downloadedTafsir(page, 'saadi');
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await expect(card.locator('.vcard__head')).toContainText('الفاتحة: ٢');
  // الميسّر افتراضيًّا، تفسير واحد
  await expect(card.locator('.tpick__btn')).toHaveText('الميسّر');
  await expect(card.locator('.vcard__credit')).toHaveText('التفسير الميسّر');
  await expect(card).not.toContainText('المختصر في تفسير القرآن الكريم');

  await card.locator('.tpick__btn').click();
  await card.getByRole('option', { name: /السعدي/ }).click();
  await expect(card.locator('.tpick__btn')).toHaveText('السعدي');
  await expect(card.locator('.vcard__content')).toContainText('الثناء على الله');
  await expect(card).not.toContainText('التفسير الميسّر');

  // Esc يغلق القائمة وحدها أولًا
  await card.locator('.tpick__btn').click();
  await page.keyboard.press('Escape');
  await expect(card.getByRole('listbox')).toHaveCount(0);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.locator('.vmenu')).toHaveCount(0);

  // الاختيار نفسه في صفحات المحتوى، والمرة القادمة تُفتح البطاقة عليه
  await clickDock(page, 'التدبّر');
  await expect(page.locator('section.study .tpick__btn')).toHaveText('السعدي');
});

test('معاني الكلمات والعمل بالآيات (متوفران للفاتحة)', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  const meanings = page.getByRole('dialog', { name: 'معاني الكلمات' });
  await expect(meanings.locator('.study__words tr, .vcard__empty').first()).toBeVisible();
  await meanings.getByRole('button', { name: 'إغلاق' }).click();

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'عمل' }).click();
  const actions = page.getByRole('dialog', { name: 'العمل بالآيات' });
  await expect(actions.locator('.vcard__action, .vcard__empty').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

// خارج نطاق المذكرات (٢٠٢٦-١١-٢٥): المعاني من الميسّر ومصدره تحتها، والعمل بالآيات برسالة عدم التوفر
test('خارج نطاق المذكرات: معاني الميسّر، والعمل بالآيات غير متوفر', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.page', '300'));
  await page.reload();
  const v = await page.locator('.sheet--current .w[data-v]').first().getAttribute('data-v');
  await longPress(page, Number(v));
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  const meanings = page.getByRole('dialog', { name: 'معاني الكلمات' });
  await expect(meanings.locator('.study__words tr').first()).toBeVisible();
  await expect(meanings.locator('.vcard__credit')).toHaveText('المصدر: الميسّر في غريب القرآن الكريم — مجمع الملك فهد');
  await expect(meanings.locator('.vcard__empty')).toHaveCount(0);
  await meanings.getByRole('button', { name: 'إغلاق' }).click();

  await longPress(page, Number(v));
  await page.getByRole('menuitem', { name: 'عمل' }).click();
  await expect(page.locator('.vcard__empty')).toContainText('غير متوفر');
});

test('ملاحظة: إضافة وتعديل وحذف من البطاقة', async ({ page }) => {
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await page.locator('.vcard__textarea').fill('ملاحظة أولى');
  await page.getByRole('button', { name: 'حفظ' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ 4: 'ملاحظة أولى' });
  await expect(page.locator('.sheet--current .w[data-v="4"] .w__notebook')).toHaveCount(1);

  // تعديل: Esc يحفظ كزر الإغلاق
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await expect(page.locator('.vcard__textarea')).toHaveValue('ملاحظة أولى');
  await page.locator('.vcard__textarea').fill('ملاحظة معدّلة');
  await page.keyboard.press('Escape');
  expect(await stored(page, 'hq.notes')).toEqual({ 4: 'ملاحظة معدّلة' });

  // حذف
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await page.getByRole('button', { name: 'حذف الملاحظة' }).click();
  await expect(page.locator('.toast')).toHaveText('حُذفت الملاحظة');
  expect(await stored(page, 'hq.notes')).toEqual({});
  await expect(page.locator('.sheet--current .w__notebook')).toHaveCount(0);
});


test('تفسير ومعاني وعمل: البطاقة بالمحتوى وحده بلا نص الآية', async ({ page }) => {
  for (const [item, name] of [
    ['تفسير', 'التفسير'],
    ['معاني', 'معاني الكلمات'],
    ['عمل', 'العمل بالآيات'],
  ]) {
    await longPress(page, 1);
    await page.getByRole('menuitem', { name: item }).click();
    const card = page.getByRole('dialog', { name });
    await expect(card.locator('.vcard__content')).toBeVisible();
    await expect(card.locator('.study__box--verse')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.vmenu')).toHaveCount(0);
  }
});

test('فوائد (٢٠٢٦-١١-٢٢): فوائد الآية وحدها وزرّ نسخها، بلا الفوائد العامة عن السورة ولا وسم الموضوع', async ({ page }) => {
  await longPress(page, 4);
  await page.getByRole('menuitem', { name: 'فوائد' }).click();
  const card = page.getByRole('dialog', { name: 'الفوائد' });
  await expect(card.locator('.vcard__head')).toContainText('الفاتحة: ٥');
  // فوائد «إياك نعبد وإياك نستعين» (من الختمة الأولى، ثم الثانية: خمس من «آية اليوم» ٢٩٢٢–٢٩٢٦، ثم الثالثة)،
  // لا فائدتا الفاتحة كلها، بلا نص الآية
  await expect(card.locator('.faida')).toHaveCount(8);
  await expect(card).not.toContainText('قال ابن القيم رحمه الله:');
  await expect(card.locator('.faida__theme')).toHaveCount(0);
  await expect(card.locator('.faida__by').first()).toHaveText('قال السعدي رحمه الله:');
  await expect(card.locator('.faida__src').first()).toHaveText('تفسير السعدي');
  await expect(card.locator('.study__box--verse')).toHaveCount(0);
  await card.getByRole('button', { name: 'نسخ' }).click();
  const text = await copied(page);
  // فائدة الختمة الأولى أولًا (صورة السعدي)، والكلمات الملوّنة فيها بلا علامتيها
  expect(text.startsWith('أي: نخصّك وحدك بالعبادة والاستعانة')).toBe(true);
  expect(text).not.toMatch(/[⸨⸩]/);
  expect(text).toContain('\n\nقال السعدي رحمه الله:\nذَكر الاستعانة');
  expect(text).toContain('\n\nقال الألوسي رحمه الله:\n');
  await page.keyboard.press('Escape');
  await expect(page.locator('.vmenu')).toHaveCount(0);
});

test('فوائد: آية فوائدها كلها عامة عن السورة ⇐ «لا فوائد لهذه الآية»', async ({ page }) => {
  // البسملة: لا فائدة عليها وحدها، وفائدتا الفاتحة كلها عامتان
  await longPress(page, 0);
  await page.getByRole('menuitem', { name: 'فوائد' }).click();
  const card = page.getByRole('dialog', { name: 'الفوائد' });
  await expect(card).toContainText('لا فوائد لهذه الآية');
  await expect(card.locator('.faida')).toHaveCount(0);
});

test.describe('الجوال الأفقي', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('المربعات الثمانية كلها داخل الشاشة بلا تمرير', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'مقاس واحد يكفي');
    await word(page, 2).click({ button: 'right' });
    const box = page.locator('.vbox');
    await expect(box.getByRole('menuitem')).toHaveCount(8);
    const card = await box.boundingBox();
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(390);
    const [sh, ch] = await box.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(sh).toBeLessThanOrEqual(ch);
  });
});

test('رجوع من كل بطاقة إلى المربعات، والملاحظة تُحفظ عند الرجوع', async ({ page }) => {
  for (const [item, name] of [
    ['تفسير', 'التفسير'],
    ['معاني', 'معاني الكلمات'],
    ['عمل', 'العمل بالآيات'],
    ['فوائد', 'الفوائد'],
  ]) {
    await longPress(page, 2);
    await page.getByRole('menuitem', { name: item }).click();
    const card = page.getByRole('dialog', { name });
    await card.getByRole('button', { name: 'رجوع' }).click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.vbox').getByRole('menuitem')).toHaveCount(8);
    await expect(page.locator('.vbox__head')).toContainText('الفاتحة: ٣');
    await page.keyboard.press('Escape');
    await expect(page.locator('.vmenu')).toHaveCount(0);
  }

  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  await page.locator('.vcard__textarea').fill('تُحفظ عند الرجوع');
  await page.getByRole('dialog', { name: 'ملاحظة' }).getByRole('button', { name: 'رجوع' }).click();
  await expect(page.locator('.vbox').getByRole('menuitem')).toHaveCount(8);
  expect(await stored(page, 'hq.notes')).toEqual({ 2: 'تُحفظ عند الرجوع' });
});
