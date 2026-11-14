// أزرار النسخ: «نسخ المحتوى» في صفحات المحتوى (آية ثم محتواها)، ومربع «نسخ» للآية، وبطاقات الآية
// (التفسيران والمعاني والعمل والملاحظة: المحتوى وحده).
// الحافظة محاكاة (helpers.js): يُقرأ ما نسخه التطبيق نصًّا كما سيُلصق
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { QURAN, clickDock, copied, isLaptop, longPress, openApp, pageVerses, toArabic } from './helpers.js';

const MUKHTASAR = JSON.parse(readFileSync('public/data/tafsir-mukhtasar.json', 'utf8'));
const MUYASSAR = JSON.parse(readFileSync('public/data/tafsir-muyassar.json', 'utf8'));
const plain = (v) => QURAN.verses[v].t.slice(0, -1).join(' ');
const sura = (v) => QURAN.suras[QURAN.verses[v].s - 1].name;
// ﴿آية (١) آية (٢)﴾ [السورة: ١–٢] لكل سورة، مفصولة بسطر فارغ
function versesText(list) {
  const groups = [];
  for (const v of list) {
    if (groups.at(-1)?.s === QURAN.verses[v].s) groups.at(-1).vs.push(v);
    else groups.push({ s: QURAN.verses[v].s, vs: [v] });
  }
  return groups
    .map(({ vs }) => {
      const a = QURAN.verses[vs[0]].a;
      const b = QURAN.verses[vs.at(-1)].a;
      return `﴿${vs.map((v) => `${plain(v)} (${toArabic(QURAN.verses[v].a)})`).join(' ')}﴾ [${sura(vs[0])}: ${toArabic(a)}${b !== a ? `–${toArabic(b)}` : ''}]`;
    })
    .join('\n\n');
}
const oneVerse = (v) => `﴿${plain(v)}﴾ [${sura(v)}: ${toArabic(QURAN.verses[v].a)}]`;
const toast = (page) => page.locator('.toast');
const study = (page) => page.locator('section.study');

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

// آية واحدة بصيغتها، وأكثر بصيغة المقدار
const ref = (list) => (list.length === 1 ? oneVerse(list[0]) : versesText(list));

test('صفحات المحتوى: زر واحد «نسخ المحتوى» في كل تبويب، ولا «نسخ الآيات»', async ({ page }) => {
  await clickDock(page, 'صفحات المحتوى');
  for (const tab of ['تفسير', 'معاني الكلمات', 'العمل بالآيات']) {
    await study(page).getByRole('tab', { name: tab }).click();
    await expect(study(page).locator('.study__copy > button')).toHaveText(['نسخ المحتوى']);
    await expect(study(page).getByRole('button', { name: 'نسخ الآيات' })).toHaveCount(0);
  }
});

test('صفحات المحتوى: نسخ التفسير اسمه ثم كل آية وتفسيرها، للصفحة الظاهرة', async ({ page }, testInfo) => {
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  const shown = isLaptop(testInfo) ? [...pageVerses(1), ...pageVerses(2)] : pageVerses(1);
  const blocks = [];
  for (const v of shown) {
    if (blocks.at(-1)?.text === MUKHTASAR.verses[v]) blocks.at(-1).vs.push(v);
    else blocks.push({ vs: [v], text: MUKHTASAR.verses[v] });
  }
  const text = await copied(page);
  expect(text).toBe(['المختصر في تفسير القرآن الكريم', ...blocks.map((b) => `${ref(b.vs)}\n${b.text}`)].join('\n\n'));
  // علامة الآية الخاصة بخط المصحف لا تُنسخ
  for (const v of shown) expect(text).not.toContain(QURAN.verses[v].t.at(-1));
});

test('صفحات المحتوى: نسخ التفسير (المختصر والميسّر) والمعاني والعمل للمقدار المحدد، آيةً ثم محتواها', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.contentRange', '[1,3]'));
  await page.reload();
  await clickDock(page, 'صفحات المحتوى');

  await study(page).getByRole('radio', { name: 'الميسّر' }).click();
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  const my = (v) => MUYASSAR.verses[v].split(MUYASSAR.quote[0]).join('﴿').split(MUYASSAR.quote[1]).join('﴾');
  expect(await copied(page)).toBe(['التفسير الميسّر', ...[1, 2, 3].map((v) => `${oneVerse(v)}\n${my(v)}`)].join('\n\n'));

  await study(page).getByRole('tab', { name: 'معاني الكلمات' }).click();
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  const [head, ...blocks] = (await copied(page)).split('\n\n');
  expect(head).toBe('معاني الكلمات');
  expect(blocks.length).toBeGreaterThan(0);
  for (const b of blocks) {
    const [verse, ...lines] = b.split('\n');
    expect(verse).toMatch(/^﴿.+﴾ \[الفاتحة: [٢-٤]\]$/);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/^.+: .+$/);
  }

  await study(page).getByRole('tab', { name: 'العمل بالآيات' }).click();
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  const actions = await copied(page);
  expect(actions).toMatch(/^العمل بالآيات\n\n﴿.+﴾ \[الفاتحة: .+\]\n• داوِم على حمد الله/);
});

test('خارج نطاق المذكرات: زر نسخ المحتوى معطّل', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.page', '300'));
  await page.reload();
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('tab', { name: 'معاني الكلمات' }).click();
  await expect(study(page).getByRole('button', { name: 'نسخ المحتوى' })).toBeDisabled();
});

test('مربع «نسخ» في مربع الآية: ينسخ الآية ﴿…﴾ [السورة: رقم] ويغلق المربع', async ({ page }) => {
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'نسخ' }).click();
  await expect(toast(page)).toHaveText('نُسخت الآية');
  await expect(page.locator('.vmenu')).toHaveCount(0);
  expect(await copied(page)).toBe(oneVerse(2));
});

test('بطاقة الآية: نسخ كل تفسير وحده، والمعاني والعمل وحدها، بلا الآية', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await card.locator('.vcard__copy').first().click();
  await expect(toast(page)).toHaveText('نُسخ المختصر في تفسير القرآن الكريم');
  expect(await copied(page)).toBe(MUKHTASAR.verses[1]);
  await card.locator('.vcard__copy').nth(1).click();
  await expect(toast(page)).toHaveText('نُسخ التفسير الميسّر');
  expect(await copied(page)).toBe(MUYASSAR.verses[1].split(MUYASSAR.quote[0]).join('﴿').split(MUYASSAR.quote[1]).join('﴾'));
  await page.keyboard.press('Escape');

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'معاني' }).click();
  await page.getByRole('dialog', { name: 'معاني الكلمات' }).getByRole('button', { name: 'نسخ' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  const meanings = await copied(page);
  expect(meanings).not.toContain('﴿');
  for (const line of meanings.split('\n')) expect(line).toMatch(/^.+: .+$/);
  await page.keyboard.press('Escape');

  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'عمل' }).click();
  await page.getByRole('dialog', { name: 'العمل بالآيات' }).getByRole('button', { name: 'نسخ' }).click();
  expect(await copied(page)).toMatch(/^• داوِم على حمد الله/);
});

test('بطاقة الملاحظة: نسخ الملاحظة وحدها', async ({ page }) => {
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  // لا زر نسخ قبل الكتابة
  await expect(page.getByRole('dialog', { name: 'ملاحظة' }).getByRole('button', { name: 'نسخ' })).toHaveCount(0);
  await page.locator('.vcard__textarea').fill('تأمل هذه الآية');
  await page.getByRole('dialog', { name: 'ملاحظة' }).getByRole('button', { name: 'نسخ' }).click();
  await expect(toast(page)).toHaveText('نُسخت الملاحظة');
  expect(await copied(page)).toBe('تأمل هذه الآية');
});

test('بلا واجهة الحافظة: يُنسخ بالطريقة البديلة، وإن تعذّر ظهرت «تعذّر النسخ»', async ({ page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    window.__execOk = true;
    document.execCommand = (cmd) => cmd === 'copy' && window.__execOk;
  });
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  await page.evaluate(() => (window.__execOk = false));
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  await expect(toast(page)).toHaveText('تعذّر النسخ');
});
