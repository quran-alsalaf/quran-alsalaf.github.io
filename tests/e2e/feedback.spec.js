// ترتيب الإعدادات و«رأيك يهمنا» (الجلسة ٣ ب، ٢٠٢٦-١١-٢٠): المظهر والقراءة ثابتان، ثم «الإعدادات التخصيصية»،
// وفي أسفل اللوحة: عن التطبيق، والمساعدة والتواصل (كان «للشكاوى والاقتراحات» حتى ٢٠٢٦-١١-٢٤، وقبله «تواصل معنا»، ٢٠٢٦-١١-٢١)، وقيّم التطبيق (في التطبيق
// الأصلي وحده)، وشارك التطبيق
import { test, expect } from '@playwright/test';
import { clickTopbar, copied, isLaptop, openApp, openCustomSettings } from './helpers.js';

const settings = (page) => page.locator('.settings');
const mainPage = (page) => settings(page).locator('.settings__page').first();
const shown = (page) => settings(page).locator('.settings__page--in');

test('الإعدادات: أربعة أسطر ثابتة، ثم «الإعدادات التخصيصية»، ثم الأسطر الأخيرة في أسفل اللوحة', async ({ page }, testInfo) => {
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await expect(settings(page)).toHaveClass(/settings--open/);
  const main = mainPage(page);
  await expect(main.locator('.settings__sectionTitle')).toHaveText(['المظهر', 'القراءة']);
  await expect(main.locator('.settings__label')).toHaveText([
    'خلفية القراءة',
    'لون التطبيق',
    'وضع القراءة',
    'وضع التسميع',
    'الإعدادات التخصيصية',
    'عن التطبيق',
    'المساعدة والتواصل',
    'شارك التطبيق',
  ]);
  await expect(main.getByRole('button', { name: 'تواصل معنا' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'للشكاوى والاقتراحات' })).toHaveCount(0);
  // في الموقع لا متجر: لا «قيّم التطبيق»
  await expect(page.getByRole('button', { name: 'قيّم التطبيق' })).toHaveCount(0);
  // ما نُقل ليس في الإعدادات نفسها
  await expect(main.getByRole('radiogroup', { name: 'الرواية' })).toHaveCount(0);
  await expect(main.getByRole('switch')).toHaveCount(0);

  // الأسطر الأخيرة ملتصقة بأسفل اللوحة، وبينها وبين ما قبلها ما بقي من الفراغ (واسع في اللابتوب، قليل في الجوال)
  const foot = await main.locator('.settings__section--foot').boundingBox();
  const above = await main.getByRole('button', { name: 'الإعدادات التخصيصية' }).boundingBox();
  const body = await main.locator('.settings__body').boundingBox();
  const pad = await main.locator('.settings__body').evaluate((e) => parseFloat(getComputedStyle(e).paddingBottom));
  expect(Math.abs(foot.y + foot.height - (body.y + body.height - pad))).toBeLessThanOrEqual(1);
  expect(foot.y - (above.y + above.height)).toBeGreaterThan(isLaptop(testInfo) ? 40 : 0);
});

test('«الإعدادات التخصيصية»: الرواية ومفتاحا القراءة والنسخة الاحتياطية، والرجوع منها إلى الإعدادات', async ({ page }) => {
  await openApp(page);
  await openCustomSettings(page);
  const sub = shown(page);
  await expect(sub.locator('.settings__sectionTitle')).toHaveText(['المصحف', 'القراءة']);
  await expect(sub.getByRole('radiogroup', { name: 'الرواية' })).toBeVisible();
  await expect(sub.getByRole('switch', { name: 'تمييز مقررات الأسابيع' })).toBeVisible();
  await expect(sub.getByRole('switch', { name: 'التنبيه ببداية الربع' })).toBeVisible();
  await expect(sub.getByRole('button', { name: 'النسخ الاحتياطي' })).toBeVisible();
  await sub.getByRole('button', { name: 'رجوع' }).click();
  await expect(shown(page)).toHaveCount(0);
  await expect(mainPage(page).getByRole('button', { name: 'الإعدادات التخصيصية' })).toBeVisible();
  // وEsc يرجع منها إلى الإعدادات، ثم يغلقها
  await mainPage(page).getByRole('button', { name: 'الإعدادات التخصيصية' }).click();
  await expect(shown(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(shown(page)).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
  await page.keyboard.press('Escape');
  await expect(settings(page)).not.toHaveClass(/settings--open/);
});

test('تغيير الرواية من «الإعدادات التخصيصية» يُحفظ', async ({ page }) => {
  await openApp(page);
  await openCustomSettings(page);
  await shown(page).getByRole('radiogroup', { name: 'الرواية' }).getByRole('radio', { name: 'ورش' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hq.riwayah'))).toBe('warsh');
});

test('شارك التطبيق: قائمة المشاركة بالنص ورابط الموقع', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.share = async (d) => {
      window.__shared.push(d);
    };
  });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'شارك التطبيق' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared.length)).toBe(1);
  expect(await page.evaluate(() => window.__shared[0])).toEqual({
    text: 'قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.\nhttps://quran-alsalaf.github.io/',
  });
  // الإعدادات ما زالت مفتوحة
  await expect(settings(page)).toHaveClass(/settings--open/);
});

test('شارك التطبيق حيث لا قائمة مشاركة: يُنسخ النص مع رسالة', async ({ page }) => {
  await page.addInitScript(() => {
    delete Navigator.prototype.share;
    delete navigator.share;
  });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'شارك التطبيق' }).click();
  await expect(page.locator('.toast')).toHaveText('نُسخ رابط التطبيق');
  expect(await copied(page)).toBe('قرآن السلف — المصحف على نهج السلف في تلقّي القرآن.\nhttps://quran-alsalaf.github.io/');
});

test('المساعدة والتواصل: الرسالة والرقم وزرّ واتساب برسالة جاهزة، والرجوع إلى الإعدادات', async ({ page }) => {
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'المساعدة والتواصل' }).click();
  const sub = shown(page);
  await expect(sub.getByRole('heading', { name: 'المساعدة والتواصل' })).toBeVisible();
  await expect(sub.locator('.contact__note')).toHaveText(
    'هذا التطبيق تم إنشاؤه بمساعدة الذكاء الاصطناعي، فإذا وجدت أي أخطاء أو كانت لديك اقتراحات فتواصل معنا من فضلك.'
  );
  await expect(sub.locator('.contact__number')).toHaveText('0548470724');
  const link = sub.getByRole('link', { name: 'مراسلة على واتساب' });
  await expect(link).toBeVisible();
  const url = new URL(await link.getAttribute('href'));
  expect(url.origin + url.pathname).toBe('https://wa.me/966548470724');
  const text = url.searchParams.get('text');
  expect(text.startsWith('السلام عليكم،')).toBe(true);
  expect(text.endsWith('قرآن السلف (الموقع) · رواية حفص')).toBe(true);
  await expect(link).toHaveAttribute('target', '_blank');
  // زرّ الرجوع في المتصفح (وأندرويد) يعيد إلى الإعدادات
  await page.goBack();
  await expect(shown(page)).toHaveCount(0);
  await expect(settings(page)).toHaveClass(/settings--open/);
});

test('المساعدة والتواصل: الأسئلة الشائعة مطويّة أولًا، وكل سؤال يُفتح ويُطوى وحده، ثم «لم تجد جوابك؟ راسلنا»', async ({ page }) => {
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'المساعدة والتواصل' }).click();
  const sub = shown(page);
  await expect(sub.locator('.contact__title')).toHaveText(['الأسئلة الشائعة', 'لم تجد جوابك؟ راسلنا']);
  await expect(sub.locator('.faq__sectionTitle')).toHaveText(['القراءة والمصحف', 'الاستماع', 'الختمة والحفظ', 'بياناتي', 'عامة']);
  // في الموقع ١٣ سؤالًا (سؤال التذكير في التطبيق الأصلي وحده)، كلها مطويّة
  const items = sub.locator('.faq__item');
  await expect(items).toHaveCount(13);
  await expect(sub.getByText('كيف أضبط تذكيرًا يوميًّا بالورد؟')).toHaveCount(0);
  await expect(sub.locator('.faq__a').first()).toBeHidden();
  await expect(sub.locator('.faq__item[open]')).toHaveCount(0);

  // الضغط على السؤال يفتح جوابه، وفتح غيره لا يطويه، والضغط ثانيةً يطويه
  const first = sub.locator('.faq__item', { hasText: 'كيف أغيّر الرواية بين حفص وورش؟' });
  await first.locator('summary').click();
  await expect(first.locator('.faq__a')).toHaveText('من الإعدادات ← الإعدادات التخصيصية ← الرواية.');
  await expect(first.locator('.faq__a')).toBeVisible();
  const second = sub.locator('.faq__item', { hasText: 'هل يحتاج التطبيق إلى حساب أو تسجيل؟' });
  await second.locator('summary').click();
  await expect(second.locator('.faq__a')).toBeVisible();
  await expect(first.locator('.faq__a')).toBeVisible();
  await first.locator('summary').click();
  await expect(first.locator('.faq__a')).toBeHidden();
  await expect(second.locator('.faq__a')).toBeVisible();

  // الأسئلة قبل التواصل، والواتساب تحتها كما كان
  const faq = await sub.locator('.faq').boundingBox();
  const note = await sub.locator('.contact__note').boundingBox();
  expect(note.y).toBeGreaterThan(faq.y + faq.height - 1);
  await sub.getByRole('link', { name: 'مراسلة على واتساب' }).scrollIntoViewIfNeeded();
  await expect(sub.getByRole('link', { name: 'مراسلة على واتساب' })).toBeVisible();
});

test('المساعدة والتواصل في مصحف ورش: الرواية في الرسالة', async ({ page }) => {
  await openApp(page, { 'hq.riwayah': 'warsh' });
  await clickTopbar(page, 'الإعدادات');
  await mainPage(page).getByRole('button', { name: 'المساعدة والتواصل' }).click();
  const href = await shown(page).getByRole('link', { name: 'مراسلة على واتساب' }).getAttribute('href');
  expect(new URL(href).searchParams.get('text')).toContain('رواية ورش');
});

test('الشاشة القصيرة: الأسطر الأخيرة تحت ما قبلها مباشرة، وتُبلغ بالتمرير', async ({ page }, testInfo) => {
  test.skip(isLaptop(testInfo), 'الجوال وحده');
  await page.setViewportSize({ width: 390, height: 480 });
  await openApp(page);
  await clickTopbar(page, 'الإعدادات');
  const main = mainPage(page);
  const last = main.getByRole('button', { name: 'شارك التطبيق' });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const foot = await main.locator('.settings__section--foot').boundingBox();
  const above = await main.getByRole('button', { name: 'الإعدادات التخصيصية' }).boundingBox();
  expect(foot.y - (above.y + above.height)).toBeLessThan(30);
});
