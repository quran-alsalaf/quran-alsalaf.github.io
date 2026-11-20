// ربط ترقيم ورش بحفص (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٢): في مصحف ورش تعمل التفاسير والمعاني والعمل وصفحات
// المحتوى ومقدارها، والعلامات والملاحظات مشتركة بين الروايتين (محفوظة بترقيم حفص)
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { QURAN, clickDock, clickTopbar, closeSettingsPanel, openApp, openCustomSettings, stored, toArabic } from './helpers.js';
import { muyassarPlain } from '../../src/lib/study.js';

const W = JSON.parse(readFileSync(new URL('../../public/data/warsh/quran.json', import.meta.url), 'utf8'));
const MUYASSAR = JSON.parse(readFileSync(new URL('../../public/data/tafsir-muyassar.json', import.meta.url), 'utf8'));
const w = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const h = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
const RED = '#c0392b';

const wword = (page, v) => page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${v}"]`).first();
const hword = (page, v) => page.locator(`.sheet--current .mushaf-page:not(.mushaf-page--warsh) .w[data-v="${v}"]`).first();
const toast = (page) => page.locator('.toast');
const side = (page) => page.locator('.sidemenu');
const study = (page) => page.getByRole('dialog', { name: 'صفحات المحتوى' });

async function openWarsh(page, storage = {}) {
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.page': '1', ...storage });
  await expect(page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first()).toBeVisible();
}

async function longPressWarsh(page, v) {
  const box = await wword(page, v).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('.vmenu__picker')).toBeVisible();
}

// اختيار آية من منتقي الآيات بترقيم ورش (السورة مفتوحة إن كانت سورة الموضع الحالي)
async function pickWarsh(page, s, a) {
  const toggle = page.locator(`.rpick__sura[data-sura="${s}"] .rpick__toggle`);
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await page
    .locator(`.rpick__sura[data-sura="${s}"] .rpick__verse`)
    .filter({ has: page.locator('.rpick__num', { hasText: new RegExp(`^${toArabic(a)}$`) }) })
    .first()
    .click();
  await expect(page.locator('.rpick')).toHaveCount(0);
}

async function switchTo(page, name) {
  await openCustomSettings(page);
  await page.getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name }).click();
  await closeSettingsPanel(page);
}

test('علامة وملاحظة من حفص تظهران في ورش على ما يقابل آيتهما، وفي القائمة بترقيم ورش', async ({ page }) => {
  await openWarsh(page, {
    // الفاتحة ٧ في حفص = الفاتحة ٦–٧ في ورش، والفاتحة ٢ في حفص = الفاتحة ١ في ورش
    'hq.bookmarks': [{ id: 1, name: 'وصلت هنا', color: RED, multi: false, verses: [{ v: h(1, 7), at: 1 }] }],
    'hq.notes': { [h(1, 2)]: 'ملاحظة على الحمد' },
  });
  for (const a of [6, 7]) await expect(wword(page, w(1, a))).toHaveClass(/w--mark/);
  await expect(wword(page, w(1, 5))).not.toHaveClass(/w--mark/);
  await expect(page.locator(`.sheet--current .mushaf-page--warsh .w[data-v="${w(1, 1)}"] .w__notebook`)).toHaveCount(1);

  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الملاحظات' }).click();
  await expect(side(page).locator('.sidemenu__row')).toHaveCount(1);
  await expect(side(page).locator('.sidemenu__rowLabel')).toContainText('الفاتحة ١');
  await side(page).getByRole('tab', { name: 'العلامات' }).click();
  await expect(side(page).locator('.sidemenu__row')).toContainText('الفاتحة ٦');
  await side(page).locator('.sidemenu__row', { hasText: 'وصلت هنا' }).click();
  await expect(side(page).locator('.bmdetail .sidemenu__rowLabel')).toHaveText(['الفاتحة ٦', 'الفاتحة ٧']);
  // الإزالة من ورش تزيلها من آية حفص نفسها
  await side(page).getByRole('button', { name: 'إزالة الفاتحة ٧ من العلامة' }).click();
  await side(page).getByRole('button', { name: 'نعم، أزلها' }).click();
  expect((await stored(page, 'hq.bookmarks'))[0].verses).toEqual([]);
});

test('علامة وملاحظة من ورش تُحفظان بترقيم حفص وتظهران في حفص', async ({ page }) => {
  await openWarsh(page);
  // علامة على الفاتحة ٣ في ورش (= ٤ في حفص)
  await longPressWarsh(page, w(1, 3));
  await page.getByRole('menuitem', { name: 'علامة' }).click();
  await page.locator('.vbox').getByRole('button', { name: 'علامة جديدة' }).click();
  await page.locator('.vbox').getByRole('button', { name: 'إنشاء ووضعها على الآية' }).click();
  await expect(toast(page)).toHaveText('وُضعت علامة «علامة ١»');
  expect((await stored(page, 'hq.bookmarks'))[0].verses.map((x) => x.v)).toEqual([h(1, 4)]);
  await expect(wword(page, w(1, 3))).toHaveClass(/w--mark/);

  // ملاحظة على الفاتحة ١ في ورش: تُحفظ على «الحمد لله» (حفص ٢) لا على البسملة
  await longPressWarsh(page, w(1, 1));
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  const card = page.getByRole('dialog', { name: 'ملاحظة' });
  await card.getByRole('button', { name: 'إدراج الآية' }).click();
  // الآية المدرجة بنص ورش وخطه
  const verse = card.getByRole('group', { name: 'الآية المُدرجة' }).locator('p');
  await expect(verse).toHaveText(W.verses[w(1, 1)].t.join(' '));
  expect(await verse.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('UthmanicWarsh');
  await card.locator('.vcard__textarea').fill('من ورش');
  await card.getByRole('button', { name: 'حفظ' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ [h(1, 2)]: { text: 'من ورش', verse: true } });

  await switchTo(page, 'حفص');
  await expect(hword(page, h(1, 4))).toHaveClass(/w--mark/);
  await expect(page.locator(`.sheet--current .w[data-v="${h(1, 2)}"] .w__notebook`)).toHaveCount(1);
  await expect(page.locator(`.sheet--current .w[data-v="${h(1, 1)}"] .w__notebook`)).toHaveCount(0);
});

test('آية ورش تقابل آيتين من حفص: ملاحظتاهما تظهران، والتعديل على الأولى', async ({ page }) => {
  // البقرة ١ في ورش = البقرة ١–٢ في حفص
  await openWarsh(page, { 'hq.page': '2', 'hq.notes': { [h(2, 1)]: 'الأولى', [h(2, 2)]: 'الثانية' } });
  await longPressWarsh(page, w(2, 1));
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  const card = page.getByRole('dialog', { name: 'ملاحظة' });
  await expect(card.locator('.vcard__textarea')).toHaveValue('الأولى');
  await expect(card.locator('.vnote__other')).toContainText('الثانية');
  await card.locator('.vcard__textarea').fill('الأولى معدّلة');
  await card.getByRole('button', { name: 'حفظ' }).click();
  expect(await stored(page, 'hq.notes')).toEqual({ [h(2, 1)]: 'الأولى معدّلة', [h(2, 2)]: 'الثانية' });

  // ومن القائمة: كلٌّ منهما بسطره، والتعديل يفتح ملاحظته هو
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('tab', { name: 'الملاحظات' }).click();
  await expect(side(page).locator('.sidemenu__row')).toHaveCount(2);
  await side(page).locator('.sidemenu__row', { hasText: 'الثانية' }).getByRole('button', { name: 'تعديل الملاحظة' }).click();
  await expect(card.locator('.vcard__textarea')).toHaveValue('الثانية');
  await expect(card.locator('.vnote__other')).toContainText('الأولى معدّلة');
});

test('التفسير والمعاني والعمل في مربع الآية بترقيم ورش', async ({ page }) => {
  await openWarsh(page);
  // الفاتحة ١ في ورش: تفسير البسملة ثم «الحمد لله» (الميسّر، الافتراضي)
  await longPressWarsh(page, w(1, 1));
  const box = page.getByRole('dialog', { name: 'الفاتحة: ١' });
  await box.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await expect(card.locator('.vcard__title span')).toHaveText('الفاتحة: ١');
  const text = (v) => muyassarPlain(MUYASSAR.verses[v], MUYASSAR.quote);
  await expect(card.locator('.vcard__tafsir')).toContainText(text(h(1, 1)).slice(0, 30));
  await expect(card.locator('.vcard__tafsir')).toContainText(text(h(1, 2)).slice(0, 30));
  await card.getByRole('button', { name: 'رجوع' }).click();

  // المعاني بكلمات ورش
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  const meanings = page.getByRole('dialog', { name: 'معاني الكلمات' });
  await expect(meanings.locator('.study__words th').first()).toBeVisible();
  await expect(meanings.locator('.study__words th', { hasText: 'اِ۬لْحَمْدُ لِلهِ' })).toHaveCount(1);
  await meanings.getByRole('button', { name: 'رجوع' }).click();

  await page.getByRole('menuitem', { name: 'عمل' }).click();
  const actions = page.getByRole('dialog', { name: 'العمل بالآيات' });
  await expect(actions.locator('.vcard__action').first()).toBeVisible();
  // اسم الآيات تحت كل توجيه بترقيم ورش
  await expect(actions.locator('.study__ref').first()).toContainText('الفاتحة');
});

test('صفحات المحتوى في ورش: آيات الصفحة بنص ورش، والمقدار يُحفظ بترقيم حفص ويُخفت ما خارجه', async ({ page }) => {
  await openWarsh(page);
  await clickDock(page, 'صفحات المحتوى');
  await expect(study(page)).toBeVisible();
  const items = study(page).locator('.study__item');
  await expect(items.first().locator('.study__box--verse')).toHaveText(W.verses[w(1, 1)].t.join(' '));
  expect(await items.first().locator('.study__box--verse').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('UthmanicWarsh');

  const bar = study(page).locator('.rbar');
  await bar.getByRole('button', { name: /البداية/ }).click();
  await pickWarsh(page, 1, 2);
  await bar.getByRole('button', { name: /النهاية/ }).click();
  await pickWarsh(page, 1, 6);
  // الفاتحة ٢–٦ في ورش = الفاتحة ٣–٧ في حفص
  expect(await stored(page, 'hq.contentRange')).toEqual([h(1, 3), h(1, 7)]);
  // ٦ و٧ في ورش آية واحدة في حفص، فيشملهما المقدار
  await expect(items).toHaveCount(6);
  await expect(bar).toContainText('الفاتحة');

  await page.keyboard.press('Escape');
  await expect(wword(page, w(1, 1))).toHaveClass(/w--out/);
  await expect(wword(page, w(1, 2))).not.toHaveClass(/w--out/);
  await expect(wword(page, w(1, 7))).not.toHaveClass(/w--out/);

  // في حفص المقدار نفسه
  await switchTo(page, 'حفص');
  await expect(hword(page, h(1, 2))).toHaveClass(/w--out/);
  await expect(hword(page, h(1, 3))).not.toHaveClass(/w--out/);
  await expect(hword(page, h(1, 7))).not.toHaveClass(/w--out/);
});
