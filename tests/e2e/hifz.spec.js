// ختمة الحفظ (٢٠٢٦-١١-١٦): اختيار النوع، والإنشاء في الاتجاهين بالبداية والنهاية والمقترح، وصفحة الحفظ
// بالاستماع ثم التسميع على الورد وحده، والمراجعتان (والقطع غير المتصلة)، والتنبيه على إهمال المراجعة
// واقتراح زيادتها، والتعديل والحذف، واجتماعها مع ختمة الورد، وورش
import { expect, test } from '@playwright/test';
import { QURAN, clickTopbar, openApp, pickVerse, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');
const hpage = (page) => page.locator('.hpage');
const toast = (page) => page.locator('.toast');
const at = (s, a) => QURAN.verses.findIndex((v) => v.s === s && v.a === a);
const LAST = QURAN.verses.length - 1;
const TODAY = new Date('2026-11-16T10:00:00');

// ختمة حفظ محفوظة كما ينشئها التطبيق، وما يُمرَّر يبدّل
const hifz = (over = {}) => ({
  type: 'hifz',
  created: '2026-11-16',
  dir: 'forward',
  start: 0,
  end: LAST,
  known: true,
  lines: 15,
  near: 3,
  far: 'hizb',
  next: 0,
  recent: [],
  planStart: '2026-11-16',
  done: 0,
  doneBefore: 0,
  lastDone: null,
  farNext: null,
  reviewed: null,
  lastFar: null,
  hintDismissed: null,
  finished: null,
  ...over,
});

async function open(page, storage = {}) {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, storage);
}
async function openTab(page) {
  await clickTopbar(page, 'القائمة');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await side(page).getByRole('tab', { name: 'الختمة' }).click();
}
async function waitHpage(page) {
  await expect(hpage(page).locator('.sheet--current .mushaf-page:not(.mushaf-page--pending)').first()).toBeVisible();
  await page.waitForFunction(() => !document.querySelector('.hpage')?.getAnimations().length);
}
const step = (page, name) => side(page).locator('.task').filter({ hasText: name });
// دائرة المهمة: تسجّلها بلا صفحتها (لمن سمّع على شيخ أو من مصحف ورقي)
const check = (page, name) => step(page, name).getByRole('button', { name: /سجّل أنك أتممت/ });
const details = (page) => side(page).locator('.hifz-card').getByRole('button', { name: 'التفاصيل' }).click();
const radio = (page, name) => side(page).getByRole('radio', { name, exact: true });
// نموذج الإنشاء خطوات (تنسيق تبويب الختمة، الجزء ٢): الخطوة الظاهرة، و«التالي»
const stepOf = (page) => side(page).locator('.steps');
const next = (page) => side(page).getByRole('button', { name: 'التالي' }).click();
async function nextTo(page, id) {
  for (let i = 0; i < 10 && (await stepOf(page).getAttribute('data-step')) !== id; i++) await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', id);
}
const row = (page, name) => side(page).locator('.steps__row').filter({ hasText: name });

// يكشف بزرّ «كشف الآية» حتى يظهر زرّ الإتمام
async function revealAll(page, done) {
  const btn = hpage(page).getByRole('button', { name: done });
  for (let i = 0; i < 120 && !(await btn.isVisible()); i++) await hpage(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(btn).toBeVisible();
}

test('اختيار النوع، وإنشاء ختمة حفظ خطوات بالقيم الافتراضية', async ({ page }) => {
  await open(page);
  await openTab(page);
  // ختمة الورد أولًا كما كانت، والنوع أول خطوة
  await expect(radio(page, 'ختمة الورد')).toHaveAttribute('aria-checked', 'true');
  await radio(page, 'ختمة الحفظ').click();
  await expect(side(page).locator('.khatma__title')).toHaveText('ختمة جديدة');
  // في الموقع سبع خطوات (لا تذكير)
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٧');

  const question = side(page).locator('.steps__question');
  await next(page);
  await expect(side(page).locator('.khatma__title')).toHaveText('ختمة حفظ جديدة');
  await expect(question).toHaveText('بأي اتجاه تحفظ؟');
  await expect(radio(page, 'من الفاتحة إلى الناس')).toHaveAttribute('aria-checked', 'true');
  await next(page);
  await expect(question).toHaveText('من أين تبدأ؟ وأين تنتهي؟');
  await expect(side(page).locator('.hifz__pick').nth(0)).toContainText('الفاتحة ١');
  await expect(side(page).locator('.hifz__pick').nth(1)).toContainText('الناس ٦');
  // من أول المصحف: لا شيء قبل البداية
  await expect(side(page).getByText('لا أراجع ما قبل البداية')).toHaveCount(0);
  await next(page);
  await expect(question).toHaveText('كم تحفظ كل يوم؟');
  await expect(radio(page, 'نصف وجه')).toHaveAttribute('aria-checked', 'true');
  // مدة الختمة تحت الحفظ اليومي
  await expect(side(page).locator('.khatma__summary')).toContainText('نصف وجه يوميا');
  await radio(page, 'وجه').click();
  await expect(side(page).locator('.khatma__summary')).toContainText('وجه يوميا');
  await next(page);
  await expect(question).toHaveText('كم تراجع من آخر ما حفظت؟');
  await expect(radio(page, 'آخر ٣ أوراد')).toHaveAttribute('aria-checked', 'true');
  await radio(page, 'آخر ٥ أوراد').click();
  await next(page);
  await expect(question).toHaveText('كم تراجع كل يوم من محفوظك القديم؟');
  await expect(radio(page, 'حزب (مقترح)')).toHaveAttribute('aria-checked', 'true');
  // بلا جملة «تحفظ الآن أقل من نصف القرآن…» (أزيلت بطلب صاحب المشروع): يكفي «(مقترح)»
  await expect(side(page).getByText(/تحفظ الآن (أقل|أكثر) من نصف القرآن/)).toHaveCount(0);
  await next(page);

  // الملخص: سطر لكل خطوة، ومدة الختمة
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ٧ من ٧');
  await expect(side(page).locator('.steps__row')).toHaveText([
    /الاتجاه\s*من الفاتحة إلى الناس/,
    /البداية والنهاية\s*من الفاتحة ١ إلى الناس ٦/,
    /الحفظ اليومي\s*وجه يوميا/,
    /المراجعة القريبة\s*آخر ٥ أوراد/,
    /المراجعة البعيدة\s*حزب كل يوم \(مقترح\)/,
  ]);
  await expect(side(page).locator('.khatma__summary')).toContainText('وجه يوميا');
  // نصوص الختمة بلا تشكيل (بطلب صاحب المشروع)
  expect(await side(page).locator('.khatma').innerText()).not.toMatch(/[\u064B-\u0652]/);
  await side(page).getByRole('button', { name: 'ابدأ ختمة الحفظ' }).click();

  const card = side(page).locator('.hifz-card');
  await expect(card).toContainText('ختمة الحفظ');
  await expect(card).toContainText('الورد ١ من');
  await expect(step(page, 'حفظ اليوم')).toContainText('الفاتحة ١ – البقرة ٦');
  await expect(step(page, 'المراجعة البعيدة')).toContainText('لا محفوظ للمراجعة بعد');
  await expect(step(page, 'المراجعة القريبة')).toContainText('تبدأ بعد أول ورد تحفظه');
  // ويمكن إضافة ختمة ورد معها
  await expect(side(page).getByRole('button', { name: 'ختمة ورد جديدة' })).toBeVisible();
  const [k] = await stored(page, 'hq.khatmas');
  expect([k.type, k.dir, k.start, k.end, k.lines, k.near, k.far, k.known]).toEqual(['hifz', 'forward', 0, LAST, 15, 5, 'hizb', true]);
});

test('البداية والنهاية بالمنتقي، و«لا أراجع ما قبل البداية»، والمقترح بحسب النصف، والاتجاه العكسي', async ({ page }) => {
  await open(page);
  await openTab(page);
  await radio(page, 'ختمة الحفظ').click();
  await nextTo(page, 'range');

  // من مريم: ما قبلها أكثر من نصف القرآن ⇐ جزء مقترح
  await side(page).locator('.hifz__pick').nth(0).click();
  await pickVerse(page, at(19, 1));
  await expect(side(page).locator('.hifz__pick').nth(0)).toContainText('مريم ١');
  await nextTo(page, 'far');
  await expect(radio(page, 'جزء (مقترح)')).toHaveAttribute('aria-checked', 'true');
  // ومن الملخص: «لا أراجع ما قبل البداية» يغيّر المقترح إلى حزب
  await next(page);
  await expect(row(page, 'المراجعة البعيدة')).toContainText('جزء كل يوم (مقترح)');
  await row(page, 'البداية والنهاية').click();
  await side(page).getByText('لا أراجع ما قبل البداية').click();
  await side(page).getByRole('button', { name: 'العودة إلى الملخص' }).click();
  await expect(row(page, 'البداية والنهاية')).toContainText('لا تراجع ما قبل البداية');
  await expect(row(page, 'المراجعة البعيدة')).toContainText('حزب كل يوم (مقترح)');

  // العكسي من الملخص: تغيير الاتجاه يعيد البداية والنهاية، فيمرّ بخطوتهما قبل الرجوع إليه
  await row(page, 'الاتجاه').click();
  await expect(side(page).getByRole('button', { name: 'العودة إلى الملخص' })).toBeVisible();
  await radio(page, 'من الناس إلى الفاتحة').click();
  await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'range');
  await expect(side(page).locator('.hifz__pick').nth(0)).toContainText('الناس ١');
  await expect(side(page).locator('.hifz__pick').nth(1)).toContainText('الفاتحة ٧');
  // بلا شرح للاتجاه العكسي (بطلب صاحب المشروع: بديهي)
  await expect(side(page).getByText('تُحفظ السور من الآخر')).toHaveCount(0);

  // نهاية بعد البداية في العكسي: لا تصح، فلا رجوع إلى الملخص
  await side(page).locator('.hifz__pick').nth(0).click();
  await pickVerse(page, at(2, 1));
  await side(page).locator('.hifz__pick').nth(1).click();
  await pickVerse(page, at(114, 1));
  await expect(side(page).getByRole('alert')).toHaveText('في هذا الاتجاه تكون سورة النهاية قبل سورة البداية.');
  await expect(side(page).getByRole('button', { name: 'العودة إلى الملخص' })).toBeDisabled();

  // من الناس إلى البقرة
  await side(page).locator('.hifz__pick').nth(0).click();
  await pickVerse(page, at(114, 1));
  await side(page).locator('.hifz__pick').nth(1).click();
  await pickVerse(page, at(2, 286));
  await side(page).getByRole('button', { name: 'العودة إلى الملخص' }).click();
  await expect(row(page, 'الاتجاه')).toContainText('من الناس إلى الفاتحة');
  await expect(row(page, 'البداية والنهاية')).toContainText('من الناس ١ إلى البقرة ٢٨٦');
  await row(page, 'الحفظ اليومي').click();
  await radio(page, 'وجه').click();
  await side(page).getByRole('button', { name: 'العودة إلى الملخص' }).click();
  await side(page).getByRole('button', { name: 'ابدأ ختمة الحفظ' }).click();
  // أول ورد: النصر إلى الناس (سور كاملة متجاورة)
  await expect(step(page, 'حفظ اليوم')).toContainText('النصر ١ – الناس ٦');
  const [k] = await stored(page, 'hq.khatmas');
  expect([k.dir, k.start, k.end]).toEqual(['reverse', at(114, 1), at(2, 286)]);
});

test('صفحة الحفظ: الورد وحده، وتشغيله بالتكرار، ثم تسميعه وحده، ثم إتمامه', async ({ page }) => {
  await open(page, { 'hq.khatmas': [hifz({ dir: 'reverse', start: at(114, 1), end: at(1, 7), next: at(114, 1), lines: 7.5 })] });
  await openTab(page);
  await expect(step(page, 'حفظ اليوم')).toContainText('الفلق ١ – الناس ٦');
  await step(page, 'حفظ اليوم').getByRole('button', { name: 'احفظ' }).click();
  await waitHpage(page);
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await expect(hpage(page).locator('.kpage__title')).toContainText('حفظ الورد');
  await expect(hpage(page).locator('.kpage__title')).toContainText('الفلق ١ – الناس ٦');
  // ما خارج الورد في صفحته مُخفَت (الإخلاص)
  const ikhlas = hpage(page).locator(`.sheet--current .w[data-v="${at(112, 1)}"]`).first();
  await expect(ikhlas).toHaveClass(/w--out/);

  // التكرار من إعدادات الاستماع نفسها
  await hpage(page).getByRole('radiogroup', { name: 'تكرار الآية' }).getByRole('radio', { name: '٣' }).click();
  expect((await stored(page, 'hq.listen')).verseRepeat).toBe(3);
  await hpage(page).getByRole('button', { name: 'تشغيل الورد' }).click();
  await expect(hpage(page).getByRole('button', { name: 'إيقاف مؤقت' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__audio.srcs.length)).toBeGreaterThan(0);
  // مقدار الاستماع المحفوظ لا يتغيّر
  expect(await stored(page, 'hq.range')).toBeNull();

  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await expect(hpage(page).locator('.kpage__title h2')).toHaveText('تسميع الورد');
  await expect(hpage(page).getByRole('button', { name: 'تشغيل الورد' })).toHaveCount(0);
  const hidden = hpage(page).locator('.sheet--current .w--hidden');
  // الكلمات المخفية مكانها باقٍ بلا رسم (visibility)، فتُعدّ ولا يُنظر إليها
  await expect.poll(() => hidden.count()).toBeGreaterThan(0);
  // الإخلاص خارج الورد: ظاهرة غير مخفية
  await expect(hpage(page).locator(`.sheet--current .w--hidden[data-v="${at(112, 1)}"]`)).toHaveCount(0);
  await expect.poll(() => hpage(page).locator(`.sheet--current .w--hidden[data-v="${at(113, 1)}"]`).count()).toBeGreaterThan(0);
  await hpage(page).getByRole('button', { name: 'كشف كلمتين' }).click();
  await expect(hpage(page).locator(`.sheet--current .w[data-wi][data-v="${at(113, 1)}"]:not(.w--hidden)`)).toHaveCount(2);

  await revealAll(page, 'أتممت حفظ الورد ✓');
  await expect(hidden).toHaveCount(0);
  await hpage(page).getByRole('button', { name: 'أتممت حفظ الورد ✓' }).click();
  await expect(hpage(page)).toHaveCount(0);
  await expect(toast(page)).toHaveText('أحسنت، سجل حفظ الورد');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await expect(side(page).locator('.khatma__status')).toHaveText('أتممت حفظ اليوم ✓');
  await expect(step(page, 'الورد التالي')).toBeVisible();
  await expect(step(page, 'المراجعة القريبة')).toContainText('آخر ورد واحد');
  await expect(step(page, 'المراجعة القريبة')).toContainText('الفلق ١ – الناس ٦');
  await expect(step(page, 'المراجعة البعيدة')).toContainText('الحزب ٦٠');
  const [k] = await stored(page, 'hq.khatmas');
  expect(k.recent).toEqual([[at(113, 1), at(114, 6)]]);
  expect(k.next).toBe(at(112, 1));
});

test('صفحة الحفظ تُغلق بزرّ الرجوع فيها وبرجوع المتصفح، فتعود القائمة على تبويب الختمة', async ({ page }) => {
  await open(page, { 'hq.khatmas': [hifz()] });
  await openTab(page);
  await step(page, 'حفظ اليوم').getByRole('button', { name: 'احفظ' }).click();
  await waitHpage(page);
  await hpage(page).getByRole('button', { name: 'رجوع' }).click();
  await expect(hpage(page)).toHaveCount(0);
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await expect(side(page).getByRole('tab', { name: 'الختمة' })).toHaveAttribute('aria-selected', 'true');
  await step(page, 'حفظ اليوم').getByRole('button', { name: 'احفظ' }).click();
  await waitHpage(page);
  await page.goBack();
  await expect(hpage(page)).toHaveCount(0);
  await expect(side(page)).toHaveClass(/sidemenu--open/);
});

test('من تسميع الورد يُرجَع إلى الحفظ بزرّه وبالرجوع وبرجوع المتصفح، ثم يُسمَّع من جديد', async ({ page }) => {
  await open(page, { 'hq.khatmas': [hifz({ dir: 'reverse', start: at(114, 1), end: at(1, 7), next: at(114, 1), lines: 7.5 })] });
  await openTab(page);
  await step(page, 'حفظ اليوم').getByRole('button', { name: 'احفظ' }).click();
  await waitHpage(page);
  const h2 = hpage(page).locator('.kpage__title h2');
  const hidden = hpage(page).locator('.sheet--current .w--hidden');
  // زرّ «العودة إلى الحفظ» في التسميع وحده
  await expect(hpage(page).getByRole('button', { name: 'العودة إلى الحفظ' })).toHaveCount(0);
  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await expect(h2).toHaveText('تسميع الورد');
  await hpage(page).getByRole('button', { name: 'كشف الآية' }).click();
  await hpage(page).getByRole('button', { name: 'العودة إلى الحفظ' }).click();
  await expect(h2).toHaveText('حفظ الورد');
  await expect(hidden).toHaveCount(0);
  await expect(hpage(page).getByRole('button', { name: 'تشغيل الورد' })).toBeVisible();

  // التسميع من جديد يبدأ مخفيا كله، وزرّ الرجوع يعيد إلى الحفظ لا إلى القائمة
  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await expect.poll(() => hpage(page).locator('.sheet--current .w[data-wi]:not(.w--hidden)').count()).toBe(0);
  await hpage(page).getByRole('button', { name: 'رجوع' }).click();
  await expect(h2).toHaveText('حفظ الورد');
  // ورجوع المتصفح كذلك
  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await expect(h2).toHaveText('تسميع الورد');
  await page.goBack();
  await expect(h2).toHaveText('حفظ الورد');
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);

  // الإتمام من التسميع يغلق الصفحة كلها ويرجع إلى القائمة
  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await revealAll(page, 'أتممت حفظ الورد ✓');
  await hpage(page).getByRole('button', { name: 'أتممت حفظ الورد ✓' }).click();
  await expect(hpage(page)).toHaveCount(0);
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await expect(side(page).locator('.khatma__status')).toHaveText('أتممت حفظ اليوم ✓');
});

test('المراجعة البعيدة: تسميع المحفوظ من الوحدة وحده، ثم تعود إلى أول المحفوظ', async ({ page }) => {
  // يحفظ الفاتحة وأول البقرة (الربع الأول) قبل البداية، والمراجعة ربع حزب
  await open(page, { 'hq.khatmas': [hifz({ start: at(2, 26), next: at(2, 26), far: 'rub' })] });
  await openTab(page);
  await expect(step(page, 'المراجعة البعيدة')).toContainText('الحزب ١');
  await expect(step(page, 'المراجعة البعيدة')).toContainText('الفاتحة ١ – البقرة ٢٥');
  await step(page, 'المراجعة البعيدة').getByRole('button', { name: 'راجع', exact: true }).click();
  await waitHpage(page);
  await expect(hpage(page).locator('.kpage__title h2')).toHaveText('المراجعة البعيدة، الحزب ١');
  await revealAll(page, 'أتممت المراجعة ✓');
  await hpage(page).getByRole('button', { name: 'أتممت المراجعة ✓' }).click();
  await expect(toast(page)).toHaveText('أحسنت، تمت المراجعة البعيدة');
  await expect(step(page, 'المراجعة البعيدة')).toHaveClass(/task--done/);
  const [k] = await stored(page, 'hq.khatmas');
  expect(k.reviewed).toEqual({ day: '2026-11-16', far: true });
  expect(k.lastFar).toBe('2026-11-16');
});

test('المراجعة القريبة: الأوراد غير المتصلة في المصحف تُسمَّع قطعةً بعد قطعة', async ({ page }) => {
  // يحفظ من الناس: الملك ١–١٥ ثم ١٦–٣٠ ثم التحريم ١–١٢، والمراجعة القريبة آخر وردين
  const recent = [
    [at(67, 1), at(67, 15)],
    [at(67, 16), at(67, 30)],
    [at(66, 1), at(66, 12)],
  ];
  await open(page, { 'hq.khatmas': [hifz({ dir: 'reverse', start: at(114, 1), end: at(1, 7), next: at(65, 1), near: 2, recent, done: 3 })] });
  await openTab(page);
  await expect(step(page, 'المراجعة القريبة')).toContainText('آخر وردين');
  await step(page, 'المراجعة القريبة').getByRole('button', { name: 'سمع' }).click();
  await waitHpage(page);
  const title = hpage(page).locator('.kpage__title');
  await expect(title).toContainText('المراجعة القريبة');
  await expect(title).toContainText('القطعة ١ من ٢: الملك ١٦–٣٠');
  // أول الملك ليس في المراجعة: ظاهر
  await expect(hpage(page).locator(`.w--hidden[data-v="${at(67, 12)}"]`)).toHaveCount(0);
  for (let i = 0; i < 60 && !(await title.textContent()).includes('القطعة ٢'); i++) await hpage(page).getByRole('button', { name: 'كشف الآية' }).click();
  await expect(title).toContainText('القطعة ٢ من ٢: التحريم ١–١٢');
  await revealAll(page, 'أتممت المراجعة ✓');
  await hpage(page).getByRole('button', { name: 'أتممت المراجعة ✓' }).click();
  await expect(toast(page)).toHaveText('أحسنت، تمت المراجعة القريبة');
  await expect(step(page, 'المراجعة القريبة')).toHaveClass(/task--done/);
});

test('من يسجّل الحفظ ويترك المراجعة يُنبَّه، ومن لم يراجع منذ أيام يرى تنبيها في البطاقة', async ({ page }) => {
  await open(page, { 'hq.khatmas': [hifz({ start: at(10, 1), next: at(10, 1), lastFar: '2026-11-12' })] });
  await openTab(page);
  await expect(side(page).locator('.hifz__note--warn')).toHaveText('لم تراجع منذ ٤ أيام. المراجعة تثبت الحفظ، فلا تتركها.');
  await check(page, 'حفظ اليوم').click();
  await expect(toast(page)).toContainText('سجل حفظ الورد. لا تترك المراجعة، فبها يثبت الحفظ');
  await expect(toast(page).getByRole('button', { name: 'تراجع' })).toBeVisible();
  await expect(step(page, 'حفظ اليوم')).toHaveClass(/task--done/);
  // الدائرة تسجّل المراجعة البعيدة بلا صفحتها، فيزول التنبيه
  await check(page, 'المراجعة البعيدة').click();
  await expect(side(page).locator('.hifz__note--warn')).toHaveCount(0);
  await expect(step(page, 'المراجعة البعيدة')).toHaveClass(/task--done/);
});

test('اقتراح زيادة المراجعة بعد النصف، وتعديل الخطة، وحذف الختمة', async ({ page }) => {
  await open(page, { 'hq.khatmas': [hifz({ start: at(19, 1), next: at(19, 1) })] });
  await openTab(page);
  const note = side(page).locator('.hifz__note').filter({ hasText: 'تجاوز حفظك نصف القرآن' });
  await expect(note).toBeVisible();
  await note.getByRole('button', { name: 'اجعلها جزءا' }).click();
  await expect(toast(page)).toHaveText('صارت المراجعة البعيدة جزءا كل يوم');
  await expect(note).toHaveCount(0);
  await expect(step(page, 'المراجعة البعيدة')).toContainText('الجزء ١');

  await details(page);
  await side(page).getByRole('button', { name: 'تعديل الخطة' }).click();
  await expect(side(page).locator('.khatma__title')).toHaveText('تعديل خطة الحفظ');
  // شاشة واحدة كما كانت (لا خطوات): الحفظ اليومي والمراجعتان معًا
  await expect(side(page).locator('.steps')).toHaveCount(0);
  await expect(side(page).getByRole('radiogroup', { name: 'الحفظ اليومي' })).toBeVisible();
  await expect(side(page).getByRole('radiogroup', { name: 'المراجعة القريبة' })).toBeVisible();
  await expect(side(page).getByRole('radiogroup', { name: 'المراجعة البعيدة' })).toBeVisible();
  await expect(radio(page, 'من الفاتحة إلى الناس')).toHaveCount(0);
  await expect(radio(page, 'جزء')).toHaveAttribute('aria-checked', 'true');
  await radio(page, 'وجهان').click();
  await side(page).getByRole('button', { name: 'حفظ الخطة' }).click();
  await expect(toast(page)).toHaveText('تم تعديل الخطة');
  expect((await stored(page, 'hq.khatmas'))[0].lines).toBe(30);

  await details(page);
  await side(page).getByRole('button', { name: 'حذف الختمة' }).click();
  await side(page).getByRole('button', { name: 'نعم، احذفها' }).click();
  await expect(radio(page, 'ختمة الورد')).toBeVisible();
  expect(await stored(page, 'hq.khatmas')).toEqual([]);
});

test('ختمة الورد وختمة الحفظ معا: لكلٍّ بطاقتها', async ({ page }) => {
  const wird = { type: 'wird', created: '2026-11-16', mode: 'days', value: 30, from: 1, planStart: '2026-11-16', done: 0, doneBefore: 0, lastDone: null, finished: null };
  await open(page, { 'hq.khatmas': [wird] });
  await openTab(page);
  await expect(side(page).getByRole('button', { name: 'اقرأ', exact: true })).toBeVisible();
  await side(page).getByRole('button', { name: 'ختمة حفظ جديدة' }).click();
  await expect(side(page).locator('.khatma__title').last()).toHaveText('ختمة حفظ جديدة');
  // مع ختمة قائمة: لا خطوة للنوع، فأول خطوة الاتجاه
  await expect(stepOf(page)).toHaveAttribute('data-step', 'dir');
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٦');
  await nextTo(page, 'summary');
  await side(page).getByRole('button', { name: 'ابدأ ختمة الحفظ' }).click();
  await expect(side(page).locator('.khatma__card')).toHaveCount(2);
  await expect(side(page).getByRole('button', { name: 'اقرأ', exact: true })).toBeVisible();
  await expect(side(page).locator('.hifz-card')).toBeVisible();
  await expect(side(page).getByRole('button', { name: /ختمة (ورد|حفظ) جديدة/ })).toHaveCount(0);
  expect((await stored(page, 'hq.khatmas')).map((k) => k.type)).toEqual(['wird', 'hifz']);
});

test('ورش: الورد بترقيمه، والتسميع على الورد وحده', async ({ page }) => {
  await open(page, { 'hq.riwayah': 'warsh', 'hq.khatmas': [hifz({ dir: 'reverse', start: at(114, 1), end: at(1, 7), next: at(114, 1), lines: 7.5 })] });
  await openTab(page);
  await expect(step(page, 'حفظ اليوم')).toContainText('الناس');
  await step(page, 'حفظ اليوم').getByRole('button', { name: 'احفظ' }).click();
  await waitHpage(page);
  await hpage(page).getByRole('button', { name: 'تسميع الورد' }).click();
  await expect.poll(() => hpage(page).locator('.sheet--current .w--hidden').count()).toBeGreaterThan(0);
  await revealAll(page, 'أتممت حفظ الورد ✓');
});
