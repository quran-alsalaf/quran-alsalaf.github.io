// أزرار النسخ: «نسخ المحتوى» في صفحات المحتوى (آية ثم محتواها)، ومربع «نسخ» للآية، وبطاقات التفسير والمعاني
// والعمل (المحتوى وحده)، والملاحظة (مشاركة بدل النسخ منذ ٢٠٢٦-١١-١٥).
// الحافظة محاكاة (helpers.js): يُقرأ ما نسخه التطبيق نصًّا كما سيُلصق
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { QURAN, clickDock, copied, downloadedTafsir, isLaptop, longPress, openApp, pageVerses, tafsirData, toArabic } from './helpers.js';
import { paragraphs } from '../../src/lib/study.js';

const MUKHTASAR = JSON.parse(readFileSync('public/data/tafsir-mukhtasar.json', 'utf8'));
const MUYASSAR = JSON.parse(readFileSync('public/data/tafsir-muyassar.json', 'utf8'));
const SAADI = tafsirData('saadi');
const muyassar = (v) => MUYASSAR.verses[v].split(MUYASSAR.quote[0]).join('﴿').split(MUYASSAR.quote[1]).join('﴾');
// التفسير يُنسخ بفقراته كما يُعرض
const para = (text) => paragraphs(text).join('\n');
const chooseTafsir = async (scope, name) => {
  await scope.locator('.tpick__btn').click();
  await scope.getByRole('option', { name: new RegExp(name) }).click();
};
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
  const text = await copied(page);
  // الميسّر افتراضيًّا
  expect(text).toBe(['التفسير الميسّر', ...shown.map((v) => `${oneVerse(v)}\n${para(muyassar(v))}`)].join('\n\n'));
  // علامة الآية الخاصة بخط المصحف لا تُنسخ
  for (const v of shown) expect(text).not.toContain(QURAN.verses[v].t.at(-1));
});

test('صفحات المحتوى: نسخ التفسير (الميسّر والمختصر والسعدي) والمعاني والعمل للمقدار المحدد، آيةً ثم محتواها', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('hq.contentRange', '[1,3]'));
  await downloadedTafsir(page, 'saadi');
  await clickDock(page, 'صفحات المحتوى');

  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  expect(await copied(page)).toBe(['التفسير الميسّر', ...[1, 2, 3].map((v) => `${oneVerse(v)}\n${para(muyassar(v))}`)].join('\n\n'));

  // المختصر: الآيات المتتالية ذات التفسير الواحد تُكتب معًا ثم تفسيرها مرة
  await chooseTafsir(study(page), 'المختصر');
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  const mk = [];
  for (const v of [1, 2, 3]) {
    if (mk.at(-1)?.text === MUKHTASAR.verses[v]) mk.at(-1).vs.push(v);
    else mk.push({ vs: [v], text: MUKHTASAR.verses[v] });
  }
  expect(await copied(page)).toBe(['المختصر في تفسير القرآن الكريم', ...mk.map((b) => `${ref(b.vs)}\n${para(b.text)}`)].join('\n\n'));

  await chooseTafsir(study(page), 'السعدي');
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  expect(await copied(page)).toBe(
    ['تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)', ...[1, 2, 3].map((v) => `${oneVerse(v)}\n${para(SAADI.verses[v])}`)].join('\n\n')
  );

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
  expect(await copied(page)).toMatch(/^العمل بالآيات\n\n﴿.+﴾ \[الفاتحة: .+\]\n• داوِم على حمد الله/);
});

test('صفحات المحتوى: آية السعدي التي لا كلام خاصًّا بها تُكتب مع الآية التي قبلها ثم تفسيرهما', async ({ page }) => {
  const v = (s, a) => QURAN.verses.findIndex((x) => x.s === s && x.a === a);
  const [a, b, c] = [v(4, 60), v(4, 61), v(4, 62)];
  expect(SAADI.verses[b] ?? '').toBe('');
  await page.evaluate((r) => {
    localStorage.setItem('hq.contentRange', JSON.stringify(r));
    localStorage.setItem('hq.tafsir', 'saadi');
  }, [a, c]);
  await downloadedTafsir(page, 'saadi');
  await clickDock(page, 'صفحات المحتوى');
  await study(page).getByRole('button', { name: 'نسخ المحتوى' }).click();
  expect(await copied(page)).toBe(
    ['تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)', `${versesText([a, b])}\n${para(SAADI.verses[a])}`, `${oneVerse(c)}\n${para(SAADI.verses[c])}`].join('\n\n')
  );
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

test('بطاقة الآية: نسخ التفسير المختار والمعاني والعمل، كلٌّ وحده بلا الآية', async ({ page }) => {
  await downloadedTafsir(page, 'saadi');
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  // زرّ نسخ واحد في رأس البطاقة بلا «نسخ الآية» (للآية مربع «نسخ» خاص بها)، وبجانبه «مشاركة» صورًا
  // (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١، بقرار صاحب المشروع؛ وكانت ملغاة منذ ٢٠٢٦-١١-١٤ — share-images.spec.js)
  await expect(card.getByRole('button', { name: 'نسخ الآية' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'مشاركة' })).toHaveCount(1);
  await card.getByRole('button', { name: 'نسخ', exact: true }).click();
  await expect(toast(page)).toHaveText('نُسخ النص');
  expect(await copied(page)).toBe(para(muyassar(1)));
  await chooseTafsir(card, 'السعدي');
  await card.getByRole('button', { name: 'نسخ', exact: true }).click();
  expect(await copied(page)).toBe(para(SAADI.verses[1]));
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

// بطاقة الملاحظة (٢٠٢٦-١١-١٥، «تطوير الملاحظات»): لا زرّ نسخ فيها، والمشاركة بدله (notes.spec.js)،
// وحيث لا مشاركة في المتصفح يُنسخ نص المشاركة
test('بطاقة الملاحظة: «مشاركة» بدل النسخ، وبلا مشاركة في المتصفح يُنسخ نصها', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await longPress(page, 2);
  await page.getByRole('menuitem', { name: 'ملاحظة' }).click();
  const note = page.getByRole('dialog', { name: 'ملاحظة' });
  // لا زرّ مشاركة قبل الكتابة، ولا زرّ نسخ أبدًا
  await expect(note.getByRole('button', { name: 'مشاركة' })).toHaveCount(0);
  await page.locator('.vcard__textarea').fill('تأمل هذه الآية');
  await expect(note.getByRole('button', { name: 'نسخ' })).toHaveCount(0);
  await note.getByRole('button', { name: 'مشاركة' }).click();
  await expect(toast(page)).toHaveText('نُسخت الملاحظة');
  expect(await copied(page)).toBe('تأمل هذه الآية\n\nتطبيق قرآن السلف\nhttps://quran-alsalaf.github.io/');
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
