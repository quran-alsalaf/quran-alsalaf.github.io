// تحميل التفاسير الكبيرة بزرّ (٢٠٢٦-١١-١٥، «تفاسير كثيرة» المرحلة ٢): السعدي والبغوي وابن كثير في قائمة
// التفاسير لا تُختار قبل تحميلها، وزرّ التحميل في آخر السطر بتأكيد يذكر الحجم وينبّه إلى إبقاء التطبيق مفتوحًا،
// ثم دائرة تقدّم ونسبة وإيقاف واستئناف، وبعد الاكتمال يختفي الزرّ ويُختار التفسير ويعمل بلا شبكة.
// والتحميل في صفحات المحتوى أو بطاقة الآية حالته واحدة في الموضعين.
import { test, expect } from '@playwright/test';
import { QURAN, clickDock, longPress, openApp, tafsirData, waitMushaf } from './helpers.js';
import { paragraphs } from '../../src/lib/study.js';

const study = (page) => page.locator('section.study');
const toast = (page) => page.locator('.toast');
const BAGHAWY = tafsirData('baghawy');
const KATHEER = tafsirData('katheer');

const openStudy = async (page) => {
  await clickDock(page, 'صفحات المحتوى');
  await expect(study(page)).toHaveClass(/study--open/);
};
const option = (scope, name) => scope.getByRole('option', { name: new RegExp(name) });

test.beforeEach(async ({ page }) => {
  await openApp(page, { 'hq.page': '1' });
});

test('قبل التحميل لا يُختار، والتأكيد يذكر الحجم وينبّه، وبعد الاكتمال يختفي الزرّ ويُختار ويبقى بعد إعادة الفتح', async ({ page }) => {
  await openStudy(page);
  const picker = study(page).locator('.tpick__btn');
  await picker.click();
  const list = study(page).getByRole('listbox', { name: 'مصدر التفسير' });
  await expect(option(list, 'السعدي')).toHaveClass(/tpick__item--locked/);
  await expect(option(list, 'البغوي')).toHaveClass(/tpick__item--locked/);
  await expect(option(list, 'البغوي')).toHaveAccessibleDescription('يحتاج تحميلًا');
  await expect(option(list, 'الميسّر')).not.toHaveClass(/tpick__item--locked/);
  await expect(list.getByRole('button', { name: 'تحميل تفسير السعدي' })).toBeVisible();

  // الضغط على اسمه لا يختاره
  await option(list, 'البغوي').locator('.tpick__name').click();
  await expect(picker).toHaveText('الميسّر');

  // التأكيد، و«إلغاء» لا يحمّل شيئًا
  await list.getByRole('button', { name: 'تحميل تفسير البغوي' }).click();
  const ask = page.getByRole('alertdialog', { name: 'تحميل تفسير البغوي' });
  await expect(ask).toContainText(/نحو [٠-٩]+ ميغابايت/);
  await expect(ask).toContainText('أبقِ التطبيق مفتوحًا والإنترنت متصلًا حتى يكتمل التحميل');
  await ask.getByRole('button', { name: 'إلغاء' }).click();
  await expect(ask).toHaveCount(0);
  await expect(study(page)).toHaveClass(/study--open/);
  expect(await page.evaluate(() => caches.has('tafsir-baghawy'))).toBe(false);

  await picker.click();
  await list.getByRole('button', { name: 'تحميل تفسير البغوي' }).click();
  await ask.getByRole('button', { name: 'تحميل' }).click();
  await expect(toast(page)).toContainText('اكتمل تحميل تفسير البغوي');
  // التحميل لا يختاره
  await expect(picker).toHaveText('الميسّر');
  expect(await page.evaluate(async () => (await (await caches.open('tafsir-baghawy')).keys()).length)).toBe(114);

  await picker.click();
  await expect(list.getByRole('button', { name: /تحميل تفسير البغوي/ })).toHaveCount(0);
  await expect(option(list, 'البغوي')).not.toHaveClass(/tpick__item--locked/);
  // والسعدي ما زال يحتاج تحميلًا
  await expect(option(list, 'السعدي')).toHaveClass(/tpick__item--locked/);
  await option(list, 'البغوي').click();
  await expect(picker).toHaveText('البغوي');
  await expect(study(page).locator('.study__box--explain').first()).toContainText(paragraphs(BAGHAWY.verses[0])[0].slice(0, 40));
  await expect(study(page).locator('.study__credit')).toHaveText('معالم التنزيل في تفسير القرآن (تفسير البغوي)');

  // يبقى محمَّلًا ومختارًا بعد إعادة الفتح، ويُقرأ من الجهاز لا من الشبكة
  await page.route('**/data/tafsir/**', (r) => r.abort());
  await page.reload();
  await waitMushaf(page);
  await openStudy(page);
  await expect(picker).toHaveText('البغوي');
  await expect(study(page).locator('.study__box--explain').first()).toContainText(paragraphs(BAGHAWY.verses[0])[0].slice(0, 40));
});

test('ابن كثير: آخر القائمة، يحتاج تحميلًا بتأكيد يذكر حجمه، ثم يُختار ويُعرض تفسيره واسم كتابه', async ({ page }) => {
  await openStudy(page);
  const picker = study(page).locator('.tpick__btn');
  await picker.click();
  const list = study(page).getByRole('listbox', { name: 'مصدر التفسير' });
  await expect(list.locator('.tpick__name').last()).toHaveText('ابن كثير');
  await expect(option(list, 'ابن كثير')).toHaveClass(/tpick__item--locked/);
  await option(list, 'ابن كثير').locator('.tpick__name').click();
  await expect(picker).toHaveText('الميسّر');

  await list.getByRole('button', { name: 'تحميل تفسير ابن كثير' }).click();
  const ask = page.getByRole('alertdialog', { name: 'تحميل تفسير ابن كثير' });
  await expect(ask).toContainText('نحو ١٥ ميغابايت');
  await ask.getByRole('button', { name: 'تحميل' }).click();
  await expect(toast(page)).toContainText('اكتمل تحميل تفسير ابن كثير');
  expect(await page.evaluate(async () => (await (await caches.open('tafsir-katheer')).keys()).length)).toBe(114);

  await picker.click();
  await expect(list.getByRole('button', { name: /تحميل تفسير ابن كثير/ })).toHaveCount(0);
  await option(list, 'ابن كثير').click();
  await expect(picker).toHaveText('ابن كثير');
  // الفاتحة ١: البسملة ﴿…﴾ أول تفسيرها
  await expect(study(page).locator('.study__box--explain').first()).toContainText(paragraphs(KATHEER.verses[0])[0].slice(0, 40));
  await expect(study(page).locator('.study__box--explain').first()).toContainText('﴿بسم الله الرحمن الرحيم﴾');
  await expect(study(page).locator('.study__credit')).toHaveText('تفسير القرآن العظيم (تفسير ابن كثير)');
  // الآيات المقتبسة بلون التطبيق (كتطبيق «آية»)، وليست كذلك في الميسّر
  const ayah = study(page).locator('.study__box--explain .study__ayah').first();
  await expect(ayah).toHaveText('﴿بسم الله الرحمن الرحيم﴾');
  const [quote, body] = await ayah.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.parentElement).color]);
  expect(quote).not.toBe(body);
  await picker.click();
  await option(list, 'الميسّر').click();
  await expect(study(page).locator('.study__ayah')).toHaveCount(0);
});

test('أثناء التحميل: دائرة تقدّم ونسبة، والضغط إيقاف مؤقت ثم استئناف يكمل الناقص', async ({ page }) => {
  // الملفات تتأخر حتى يُسمح لها
  let open = false;
  const waiting = [];
  await page.route('**/data/tafsir/saadi/**', async (r) => {
    if (!open && !/\/[1-9]\.json$/.test(r.request().url())) {
      await new Promise((res) => waiting.push(res));
    }
    await r.continue().catch(() => {});
  });
  await openStudy(page);
  const picker = study(page).locator('.tpick__btn');
  await picker.click();
  const list = study(page).getByRole('listbox', { name: 'مصدر التفسير' });
  await list.getByRole('button', { name: 'تحميل تفسير السعدي' }).click();
  await page.getByRole('alertdialog', { name: 'تحميل تفسير السعدي' }).getByRole('button', { name: 'تحميل' }).click();

  // يستمر ولو أُغلقت القائمة، وتظهر النسبة عند فتحها
  await picker.click();
  const row = option(list, 'السعدي');
  await expect(row.locator('.tpick__status')).toHaveText(/^يُحمَّل… [٠-٩]+٪$/);
  await row.getByRole('button', { name: 'إيقاف تحميل تفسير السعدي مؤقتًا' }).click();
  await expect(row.locator('.tpick__status')).toHaveText(/^متوقف عند [٠-٩]+٪$/);
  await expect(row).toHaveClass(/tpick__item--locked/);
  const saved = await page.evaluate(async () => (await (await caches.open('tafsir-saadi')).keys()).length);
  expect(saved).toBeGreaterThan(0);
  expect(saved).toBeLessThan(114);

  // الاستئناف بلا تأكيد
  open = true;
  waiting.splice(0).forEach((res) => res());
  const requested = [];
  page.on('request', (req) => /\/data\/tafsir\/saadi\//.test(req.url()) && requested.push(req.url()));
  await row.getByRole('button', { name: 'استئناف تحميل تفسير السعدي' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(toast(page)).toContainText('اكتمل تحميل تفسير السعدي');
  expect(requested.length).toBeLessThanOrEqual(114 - saved);
  await expect(row.getByRole('button')).toHaveCount(0);
  await expect(row).not.toHaveClass(/tpick__item--locked/);
});

test('بطاقة الآية: التفسير غير المحمَّل ظاهر بزرّ تحميله، والتحميل منها يظهر في صفحات المحتوى', async ({ page }) => {
  await longPress(page, 1);
  await page.getByRole('menuitem', { name: 'تفسير' }).click();
  const card = page.getByRole('dialog', { name: 'التفسير' });
  await card.locator('.tpick__btn').click();
  await expect(option(card, 'البغوي')).toHaveClass(/tpick__item--locked/);
  await card.getByRole('button', { name: 'تحميل تفسير البغوي' }).click();
  await page.getByRole('alertdialog', { name: 'تحميل تفسير البغوي' }).getByRole('button', { name: 'تحميل' }).click();
  await expect(toast(page)).toContainText('اكتمل تحميل تفسير البغوي');
  // البطاقة باقية مفتوحة
  await expect(card).toBeVisible();
  await card.locator('.tpick__btn').click();
  await option(card, 'البغوي').click();
  await expect(card.locator('.tpick__btn')).toHaveText('البغوي');
  const v = QURAN.verses.findIndex((x) => x.s === 1 && x.a === 2);
  await expect(card.locator('.vcard__tafsir')).toContainText(paragraphs(BAGHAWY.verses[v])[0].slice(0, 40));
  await card.getByRole('button', { name: 'إغلاق' }).click();

  await openStudy(page);
  await expect(study(page).locator('.tpick__btn')).toHaveText('البغوي');
  await study(page).locator('.tpick__btn').click();
  await expect(study(page).getByRole('button', { name: /تحميل تفسير البغوي/ })).toHaveCount(0);
});

test('تفسير مختار مُسحت ملفاته من الجهاز: يُعرض الميسّر ويرجع زرّ التحميل', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('hq.tafsir', 'baghawy');
    localStorage.setItem('hq.tafsirDownloads', JSON.stringify({ baghawy: { status: 'done', count: 114, total: 114 } }));
  });
  await page.reload();
  await waitMushaf(page);
  await openStudy(page);
  await expect(study(page).locator('.tpick__btn')).toHaveText('الميسّر');
  await study(page).locator('.tpick__btn').click();
  await expect(study(page).getByRole('button', { name: 'تحميل تفسير البغوي' })).toBeVisible();
});
