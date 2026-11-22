// فوائد الآيات (٢٠٢٦-١١-٢٢، «الفوائد» الجلسة ١): تبويب «الفوائد» في صفحات المحتوى، ومربع «فوائد» في مربع الآية،
// والنسخ، وعرضها في مصحف ورش على ما يقابلها
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { QURAN, clickDock, copied, isLaptop, longPress, openApp, pageVerses } from './helpers.js';

const F = JSON.parse(readFileSync(new URL('../../public/data/fawaid.json', import.meta.url), 'utf8'));
const W = JSON.parse(readFileSync(new URL('../../public/data/warsh/quran.json', import.meta.url), 'utf8'));
const study = (page) => page.locator('section.study');
const h = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
// الصفحات الظاهرة إذا فُتح المصحف على الصفحة p: هي وحدها في الجوال، وزوجها في اللابتوب
const shown = (p, laptop) => (laptop ? (p % 2 ? [p, p + 1] : [p - 1, p]) : [p]);
// الفوائد التي تمسّ آيات الصفحات
const fawaidOf = (pages) => {
  const vs = new Set(pages.flatMap(pageVerses));
  return F.items.filter((f) => [...vs].some((v) => v >= f.v[0] && v <= f.v[1]));
};
// أول صفحة فردية لا فوائد فيها ولا في زوجها
const EMPTY = Array.from({ length: 302 }, (_, i) => 2 * i + 1).find((p) => !fawaidOf([p, p + 1]).length);

async function openTab(page) {
  await clickDock(page, 'صفحات المحتوى');
  await expect(study(page)).toHaveClass(/study--open/);
  await study(page).getByRole('tab', { name: 'الفوائد' }).click();
  await expect(study(page).getByRole('tab', { name: 'الفوائد' })).toHaveAttribute('aria-selected', 'true');
}

test('تبويب «الفوائد»: فوائد آيات الصفحة الظاهرة تحت آياتها، بموضوعها وقائلها ومصدرها', async ({ page }, testInfo) => {
  await openApp(page, { 'hq.page': '1' });
  await openTab(page);
  const list = fawaidOf(shown(1, isLaptop(testInfo)));
  await expect(study(page).locator('.faida')).toHaveCount(list.length);
  // أولاها عامة عن الفاتحة كلها: تحت اسم السورة وحده بلا آياتها (٢٠٢٦-١١-٢٢)، ومعها الثانية
  const first = study(page).locator('.study__item').first();
  await expect(first.locator('.study__sura')).toHaveText('سورة الفاتحة');
  await expect(first.locator('.study__box--verse')).toHaveCount(0);
  await expect(first.locator('.faida')).toHaveCount(2);
  // واسم السورة مرة واحدة
  await expect(study(page).locator('.study__sura', { hasText: 'سورة الفاتحة' })).toHaveCount(1);
  await expect(first.locator('.faida__theme').first()).toHaveText('الإيمان بالله');
  await expect(first.locator('.faida__by').first()).toHaveText('قال ابن القيم رحمه الله:');
  await expect(first.locator('.faida__src').first()).toHaveText('مدارج السالكين (١ / ٩٧)');
  // البنود بنقطة (لا برموز القناة)
  await expect(first.locator('.faida__item').first()).toBeVisible();
  await expect(first).not.toContainText('◈');
  // «الحمد لله رب العالمين» (العزو في القناة «الفاتحة: ١» بلا البسملة) تحت الآية ٢
  const second = study(page).locator('.study__item').nth(1);
  await expect(second.locator('.study__box--verse')).toHaveCount(1);
  await expect(second.locator('.study__box--verse')).toContainText(QURAN.verses[h(1, 2)].t[0]);
  await expect(second).toContainText('تربيته تعالى لخلقه نوعان');
});

test('جزء الآية الذي تتكلم عنه الفائدة بلون التطبيق فوقها', async ({ page }) => {
  await openApp(page, { 'hq.page': String(QURAN.verses[h(2, 255)].p) });
  await openTab(page);
  const faida = study(page).locator('.faida').filter({ hasText: 'لا يتجاسر أحدٌ على أن يشفع' });
  await expect(faida.locator('.faida__q')).toContainText('يَشْفَعُ');
  await expect(faida.locator('.faida__by')).toHaveCount(0);
});

test('نسخ المحتوى: العنوان، ثم آيات كل فائدة ثم الفائدة', async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
  await openTab(page);
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  const text = await copied(page);
  expect(text.startsWith('الفوائد\n\nسورة الفاتحة\nقال ابن القيم رحمه الله:\n')).toBe(true);
  expect(text).toContain('[الفاتحة: ٢]\nقال السعدي رحمه الله:\n');
  expect(text).toContain('\nمدارج السالكين (١ / ٩٧)\n\nقال السعدي رحمه الله:');
});

test('فائدة عامة عن مقطع («قصة أصحاب الكهف») تحت عنوانه بلا آياته، ولا تظهر في مربع آية منه', async ({ page }) => {
  await openApp(page, { 'hq.page': String(QURAN.verses[h(18, 10)].p) });
  await openTab(page);
  const item = study(page).locator('.study__item').filter({ hasText: 'قصة أصحاب الكهف' });
  await expect(item.locator('.study__sura')).toHaveText('الكهف ٩–٢٦');
  await expect(item.locator('.study__box--verse')).toHaveCount(0);
  await expect(item.locator('.faida__title')).toHaveText('قصة أصحاب الكهف');
  await page.keyboard.press('Escape');
  await expect(study(page)).not.toHaveClass(/study--open/);
  // بعد اكتمال انزلاقها
  await expect(study(page)).toBeHidden();
  await longPress(page, h(18, 10));
  await page.getByRole('menuitem', { name: 'فوائد' }).click();
  await expect(page.getByRole('dialog', { name: 'الفوائد' })).not.toContainText('قصة أصحاب الكهف');
});

test('آيات بلا فوائد: «لا فوائد في هذه الآيات»، والنسخ معطّل', async ({ page }) => {
  expect(EMPTY).toBeTruthy();
  await openApp(page, { 'hq.page': String(EMPTY) });
  await openTab(page);
  await expect(study(page).locator('.study__note')).toHaveText('لا فوائد في هذه الآيات');
  await expect(study(page).locator('.faida')).toHaveCount(0);
  await expect(study(page).getByRole('button', { name: 'نسخ المحتوى' })).toBeDisabled();
});

test('مربع «فوائد» لآية بلا فوائد: «لا فوائد لهذه الآية» بلا زرّ نسخ', async ({ page }) => {
  await openApp(page, { 'hq.page': String(EMPTY) });
  await longPress(page, pageVerses(EMPTY)[1]);
  await page.getByRole('menuitem', { name: 'فوائد' }).click();
  const card = page.getByRole('dialog', { name: 'الفوائد' });
  await expect(card).toContainText('لا فوائد لهذه الآية');
  await expect(card.getByRole('button', { name: 'نسخ' })).toHaveCount(0);
});

test('ورش: الفوائد على الآيات المقابلة', async ({ page }) => {
  await openApp(page, { 'hq.riwayah': 'warsh', 'hq.page': '1' });
  await expect(page.locator('.sheet--current .mushaf-page--warsh:not(.mushaf-page--pending)').first()).toBeVisible();
  await openTab(page);
  // «الحمد لله رب العالمين» الفاتحة ١ في ورش
  const item = study(page).locator('.study__item').filter({ hasText: 'تربيته تعالى لخلقه نوعان' });
  await expect(item.locator('.study__box--verse')).toHaveCount(1);
  const fatiha1 = W.verses.find((v) => v.s === 1 && v.a === 1);
  await expect(item.locator('.study__box--verse')).toContainText(fatiha1.t[0]);
  await expect(study(page).locator('.faida').filter({ hasText: 'قال ابن القيم رحمه الله:' })).toHaveCount(1);
});
