// الختمة (ورد يومي): تبويبات القائمة أسفلها، وإنشاء الختمة بالأيام وبالصفحات، وصفحة الورد المحدودة،
// وإتمام الورد، والتأخر، وتعديل الخطة وحذفها، والختم
import { expect, test } from '@playwright/test';
import { clickTopbar, isLaptop, longPress, openApp, savedPage, stored } from './helpers.js';

const side = (page) => page.locator('.sidemenu');
const kpage = (page) => page.locator('.kpage');
const TODAY = new Date('2026-11-12T10:00:00');

// ختمة ورد محفوظة: الافتراضي بالأيام ٣٠ من اليوم، وما يمرر يبدل
const wird = (over = {}) => [
  { type: 'wird', created: '2026-11-12', mode: 'days', value: 30, from: 1, planStart: '2026-11-12', done: 0, doneBefore: 0, lastDone: null, finished: null, ...over },
];

async function open(page, storage = {}) {
  await page.clock.setFixedTime(TODAY);
  await openApp(page, storage);
}

// دائرة المهمة في البطاقة («ورد اليوم» أو «الورد التالي»)، و«التفاصيل» المطوية
const check = (card) => card.getByRole('button', { name: /سجّل أنك أتممت/ });
const details = (card) => card.getByRole('button', { name: 'التفاصيل' }).click();
// نموذج الإنشاء خطوات (الجزء ٢): الخطوة الظاهرة، و«التالي» و«رجوع»
const stepOf = (page) => side(page).locator('.steps');
const next = (page) => side(page).getByRole('button', { name: 'التالي' }).click();
const back = (page) => side(page).getByRole('button', { name: 'رجوع' }).click();
async function nextTo(page, id) {
  for (let i = 0; i < 10 && (await stepOf(page).getAttribute('data-step')) !== id; i++) await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', id);
}

async function openKhatmaTab(page) {
  await clickTopbar(page, 'القائمة');
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  await side(page).getByRole('tab', { name: 'الختمة' }).click();
}

// الصفحات الظاهرة في صفحة الختمة (والباهتة منها خارج الورد)
const kShown = (page, sel = '.sheet--current') =>
  kpage(page)
    .locator(sel)
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('aria-label').replace(/[^٠-٩]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))));
async function waitKpage(page) {
  await expect(kpage(page).locator('.sheet--current .mushaf-page:not(.mushaf-page--pending)').first()).toBeVisible();
  // وانتهت حركة دخول الصفحة (تنزلق من الجانب)
  await page.waitForFunction(() => !document.querySelector('.kpage')?.getAnimations().length);
}

test('تبويبات القائمة اليمنى في أسفلها بترتيبها، وتفتح على آخر تبويب استعمل', async ({ page }) => {
  await open(page);
  await clickTopbar(page, 'القائمة');
  const tabs = side(page).getByRole('tab');
  await expect(tabs).toHaveText(['الختمة', 'السور', 'العلامات', 'الملاحظات']);
  await expect(side(page).getByRole('tab', { name: 'السور' })).toHaveAttribute('aria-selected', 'true');
  // الشريط أسفل القائمة: تحت محتواها وملاصق لأسفل الشاشة
  const bar = await side(page).locator('.sidemenu__tabs').boundingBox();
  const body = await side(page).locator('.sidemenu__body').boundingBox();
  expect(bar.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  expect(bar.y + bar.height).toBeGreaterThan(page.viewportSize().height - 2);

  await side(page).getByRole('tab', { name: 'الختمة' }).click();
  await page.keyboard.press('Escape');
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await page.reload();
  await clickTopbar(page, 'القائمة');
  await expect(side(page).getByRole('tab', { name: 'الختمة' })).toHaveAttribute('aria-selected', 'true');
  await expect(side(page).getByRole('radio', { name: 'ختمة الورد' })).toBeVisible();
});

test('إنشاء ختمة بالأيام خطوات: ٣٠ يوما افتراضيا، ويظهر الورد اليومي ويوم الختم بالميلادي والهجري', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  // نصوص الختمة بلا تشكيل (بطلب صاحب المشروع)
  const noTashkeel = async (loc) => expect(await loc.innerText()).not.toMatch(/[\u064B-\u0652]/);
  const question = side(page).locator('.steps__question');
  const hint = side(page).locator('.steps__hint');
  // الخطوة ١: نوع الختمة (الورد أولًا)، بسؤال وجملة شرح، ومؤشر الخطوات (في الموقع أربع: لا تذكير)، ولا «رجوع» بلا ختمة
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٤');
  await expect(question).toHaveText('أي ختمة تبدأ؟');
  await expect(hint).toHaveCount(1);
  await expect(side(page).getByRole('radio', { name: 'ختمة الورد' })).toHaveAttribute('aria-checked', 'true');
  await expect(side(page).getByRole('button', { name: 'رجوع' })).toHaveCount(0);
  await noTashkeel(side(page).locator('.khatma'));
  // الخطوة ٢: طريقة التحديد
  await next(page);
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ٢ من ٤');
  await expect(question).toHaveText('كيف تحدد ختمتك؟');
  await expect(side(page).getByRole('radio', { name: 'بالأيام' })).toHaveAttribute('aria-checked', 'true');
  await noTashkeel(side(page).locator('.khatma'));
  // الخطوة ٣: العدد، وتحته عدد الأيام وقدر الورد ويوم الختم بالتاريخين
  await next(page);
  await expect(question).toHaveText('في كم يوما تختم؟');
  await expect(side(page).getByRole('radio', { name: '٣٠ يوما' })).toHaveAttribute('aria-checked', 'true');
  const summary = side(page).locator('.khatma__summary');
  await expect(summary).toContainText('٣٠ يوما، ٢٠–٢١ صفحة يوميا');
  await noTashkeel(side(page).locator('.khatma'));
  await expect(summary).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await expect(summary).toContainText('٢ رجب ١٤٤٨هـ');

  await side(page).getByRole('radio', { name: '٧ أيام' }).click();
  await expect(summary).toContainText('٧ أيام، ٨٦–٨٧ صفحة يوميا');
  await expect(summary).toContainText('الأربعاء ١٨ نوفمبر ٢٠٢٦م');

  await side(page).getByRole('radio', { name: '٣٠ يوما' }).click();
  // الخطوة ٤: الملخص، ثم «ابدأ الختمة»
  await next(page);
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ٤ من ٤');
  await expect(question).toHaveText('ملخص الختمة');
  await expect(side(page).locator('.steps__row')).toHaveText([/طريقة التحديد\s*بالأيام/, /عدد الأيام\s*٣٠ يوما/]);
  await expect(summary).toContainText('٣٠ يوما، ٢٠–٢١ صفحة يوميا');
  await expect(summary).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await noTashkeel(side(page).locator('.khatma'));
  await side(page).getByRole('button', { name: 'ابدأ الختمة' }).click();
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('الورد ١ من ٣٠');
  await expect(card).toContainText('ورد اليوم');
  await expect(card).toContainText('من الصفحة ١ إلى ٢٠');
  await expect(card).toContainText('الفاتحة – البقرة');
  await expect(card).toContainText('على الخطة');
  await details(card);
  await expect(card).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await noTashkeel(side(page).locator('.khatma'));
  expect(await stored(page, 'hq.khatmas')).toEqual([expect.objectContaining({ type: 'wird', mode: 'days', value: 30, from: 1, done: 0 })]);

  // يبقى بعد إعادة الفتح
  await page.reload();
  await clickTopbar(page, 'القائمة');
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ١ إلى ٢٠');
});

test('إنشاء ختمة بالصفحات يوميا، وبعدد يكتب باليد', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  await nextTo(page, 'mode');
  await side(page).getByRole('radio', { name: 'بالصفحات يوميا' }).click();
  await next(page);
  await expect(side(page).locator('.steps__question')).toHaveText('كم صفحة تقرأ كل يوم؟');
  await side(page).getByRole('radio', { name: '١٠ صفحات' }).click();
  const summary = side(page).locator('.khatma__summary');
  await expect(summary).toContainText('٦١ يوما، ١٠ صفحات يوميا');

  await side(page).getByRole('radio', { name: 'عدد آخر' }).click();
  const input = side(page).locator('.khatma__custom input');
  await input.fill('');
  // عدد فارغ: لا «التالي»
  await expect(side(page).getByRole('button', { name: 'التالي' })).toBeDisabled();
  await input.fill('50');
  await expect(summary).toContainText('١٣ يوما، ٥٠ صفحة يوميا');
  await next(page);
  await expect(side(page).locator('.steps__row')).toHaveText([/بالصفحات يوميا/, /الصفحات يوميا\s*٥٠ صفحة/]);
  await side(page).getByRole('button', { name: 'ابدأ الختمة' }).click();
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ١ إلى ٥٠');
  await expect(side(page).locator('.khatma__card')).toContainText('الورد ١ من ١٣');
});

test('صفحة الورد: تفتح على أوله ولا تقلب خارجه، وفيها «أتممت الورد» في آخره', async ({ page }, testInfo) => {
  // الورد الحالي من ٢٢ إلى ٢٧ (ست صفحات من الصفحة ٤، أتم منها ثلاثة أوراد في أربعة أيام)
  await open(page, { 'hq.page': '300', 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 6, from: 4, done: 3, lastDone: '2026-11-11', planStart: '2026-11-08' }) });
  await clickTopbar(page, 'القائمة');
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ٢٢ إلى ٢٧');
  await side(page).getByRole('button', { name: 'اقرأ', exact: true }).click();
  await expect(kpage(page)).toBeVisible();
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await waitKpage(page);
  await expect(kpage(page).locator('.kpage__title h2')).toHaveText('ورد اليوم');

  if (isLaptop(testInfo)) {
    // صفحتان: الزوج ٢١–٢٢ وصفحة ٢١ خارج الورد باهتة
    expect(await kShown(page)).toEqual([21, 22]);
    expect(await kShown(page, '.sheet--current.sheet--outside')).toEqual([21]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ١ من ٦');
  } else {
    expect(await kShown(page)).toEqual([22]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ١ من ٦');
  }
  // لا رجوع قبل أول الورد
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect((await kShown(page)).includes(22)).toBe(true);
  await expect(kpage(page).getByRole('button', { name: /أتممت الورد/ })).toHaveCount(0);

  // إلى آخره، ولا يتجاوز
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(380);
  }
  await waitKpage(page);
  if (isLaptop(testInfo)) {
    expect(await kShown(page)).toEqual([27, 28]);
    expect(await kShown(page, '.sheet--current.sheet--outside')).toEqual([28]);
  } else {
    expect(await kShown(page)).toEqual([27]);
    await expect(kpage(page).locator('.kpage__title span')).toContainText('الصفحة ٦ من ٦');
  }
  // القراءة في الورد لا تغير آخر موضع في المصحف
  expect(await savedPage(page)).toBe(300);

  await kpage(page).getByRole('button', { name: /أتممت الورد/ }).click();
  await expect(kpage(page)).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveText('أحسنت، تم تسجيل الورد');
  // يرجع إلى تبويب الختمة: الورد التالي
  await expect(side(page)).toHaveClass(/sidemenu--open/);
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('أتممت ورد اليوم');
  await expect(card).toContainText('الورد التالي');
  await expect(card).toContainText('من الصفحة ٢٨ إلى ٣٣');
  expect(await stored(page, 'hq.khatmas')).toEqual([expect.objectContaining({ done: 4, lastDone: '2026-11-12' })]);
  expect(await savedPage(page)).toBe(300);
});

test('صفحة الورد تغلق بزر الرجوع وEsc وزر رجوع المتصفح، فيرجع إلى تبويب الختمة', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird() });
  for (const close of ['button', 'esc', 'history']) {
    await clickTopbar(page, 'القائمة');
    await side(page).getByRole('button', { name: 'اقرأ', exact: true }).click();
    await waitKpage(page);
    if (close === 'button') await kpage(page).getByRole('button', { name: 'رجوع' }).click();
    else if (close === 'esc') await page.keyboard.press('Escape');
    else await page.goBack();
    await expect(kpage(page)).toHaveCount(0);
    await expect(side(page)).toHaveClass(/sidemenu--open/);
    await expect(side(page).getByRole('tab', { name: 'الختمة' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  }
});

test('الضغط المطول على آية في صفحة الورد يفتح مربعها بلا «تشغيل»', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 3, from: 50 }) });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('button', { name: 'اقرأ', exact: true }).click();
  await waitKpage(page);
  const v = await kpage(page).locator('.sheet--current .w[data-v]').first().getAttribute('data-v');
  const box = await kpage(page).locator(`.sheet--current .w[data-v="${v}"]`).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const menu = page.locator('.vmenu__picker');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['علامة', 'ملاحظة', 'تفسير', 'معاني', 'عمل', 'فوائد', 'نسخ']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(kpage(page)).toBeVisible();
  // ومربع الآية في المصحف نفسه بقي بتشغيله
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(side(page)).not.toHaveClass(/sidemenu--open/);
  await longPress(page, 0);
  await expect(page.locator('.vmenu__picker').getByRole('menuitem').first()).toHaveText('تشغيل');
});

test('إتمام الورد من البطاقة، والتأخر والتقدم على الخطة', async ({ page }) => {
  // بدأت الخطة قبل ثلاثة أيام ولم يتم شيء: متأخر ٣ أيام، ويوم الختم يتأخر معه
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ planStart: '2026-11-09', created: '2026-11-09' }) });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('متأخر عن الخطة ٣ أيام');
  await expect(card).toContainText('من الصفحة ١ إلى ٢٠');
  // التواريخ في «التفاصيل» المطوية
  await expect(card).not.toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  await details(card);
  await expect(card).toContainText('الجمعة ١١ ديسمبر ٢٠٢٦م');
  for (let i = 0; i < 3; i++) await check(card).click();
  await expect(card).toContainText('أتممت ورد اليوم');
  // ورد اليوم ✓ بصفحاته، وتحته «الورد التالي» لمن يتقدّم
  await expect(card.locator('.task--done')).toContainText('من الصفحة ٤١ إلى ٦٠');
  await expect(card.locator('.task').last()).toContainText('الورد التالي');
  await expect(card.locator('.task').last()).toContainText('من الصفحة ٦١ إلى ٨٠');
  await expect(card.locator('.khatma__meta')).toContainText('٩٪');
  await expect(card).toContainText('قرأت ٦٠ من ٦٠٤ صفحات');
  await check(card).click();
  await check(card).click();
  await expect(card).toContainText('متقدم على الخطة يوم واحد');
});

test('تعديل الخطة يعيد التقسيم مما بقي، وحذف الختمة بتأكيد', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ done: 2, lastDone: '2026-11-11' }) });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('من الصفحة ٤١ إلى ٦٠');
  await details(card);
  await card.getByRole('button', { name: 'تعديل الخطة' }).click();
  await expect(card).toContainText('تعديل الخطة');
  await expect(card).toContainText('من الصفحة ٤١');
  // شاشة واحدة كما كانت (لا خطوات): الطريقة والعدد والحفظ معًا
  await expect(side(page).locator('.steps')).toHaveCount(0);
  await expect(card.getByRole('radio', { name: 'بالأيام' })).toBeVisible();
  await expect(card.getByRole('radio', { name: '٣٠ يوما' })).toBeVisible();
  await card.getByRole('radio', { name: 'بالصفحات يوميا' }).click();
  await card.getByRole('radio', { name: '٢٠ صفحة' }).click();
  await card.getByRole('button', { name: 'حفظ الخطة' }).click();
  await expect(page.locator('.toast')).toHaveText('تم تعديل الخطة');
  await expect(card).toContainText('من الصفحة ٤١ إلى ٦٠');
  await expect(card).toContainText('الورد ٣ من ٣١');
  await details(card);
  await expect(card).toContainText('قرأت ٤٠ من ٦٠٤');

  // إلغاء التعديل يبقي الخطة
  await card.getByRole('button', { name: 'تعديل الخطة' }).click();
  await card.getByRole('button', { name: 'إلغاء' }).click();
  await expect(card).toContainText('الورد ٣ من ٣١');

  await details(card);
  await card.getByRole('button', { name: 'حذف الختمة' }).click();
  await card.getByRole('button', { name: 'لا' }).click();
  await expect(card).toContainText('الورد ٣ من ٣١');
  await card.getByRole('button', { name: 'حذف الختمة' }).click();
  await card.getByRole('button', { name: 'نعم، احذفها' }).click();
  await expect(side(page).getByRole('radio', { name: 'ختمة الورد' })).toBeVisible();
  expect(await stored(page, 'hq.khatmas')).toEqual([]);
});

test('إتمام آخر ورد يختم المصحف: تهنئة وعدد الختمات، ثم ختمة جديدة', async ({ page }) => {
  // ثلاث صفحات يوميا من ٥٩٨: أتم وردان، وبقي الأخير (٦٠٤ وحدها)
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 3, from: 598, done: 2, lastDone: '2026-11-11' }), 'hq.khatmasDone': { wird: 2 } });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await expect(card).toContainText('الصفحة ٦٠٤');
  await details(card);
  await expect(side(page).locator('.khatma__count')).toHaveText('أتممت قبلها ختمتين');
  await side(page).getByRole('button', { name: 'اقرأ', exact: true }).click();
  await waitKpage(page);
  // ورد بصفحة واحدة: أوله آخره، فزر الإتمام ظاهر من البداية
  await kpage(page).getByRole('button', { name: /أتممت الورد/ }).click();
  await expect(page.locator('.toast')).toHaveText('أتممت الختمة، تقبل الله منك');
  await expect(card).toContainText('أتممت الختمة');
  await expect(card).toContainText('الخميس ١٢ نوفمبر ٢٠٢٦م');
  await expect(card).toContainText('أتممت ٣ ختمات في هذا التطبيق');
  await card.getByRole('button', { name: 'ابدأ ختمة جديدة' }).click();
  await expect(side(page).getByRole('radio', { name: 'ختمة الورد' })).toBeVisible();
  expect(await stored(page, 'hq.khatmasDone')).toEqual({ wird: 3 });
});

// تذكير الختمة اليومي (الجلسة ٣ أ): داخل تطبيق أندرويد وحده، فلا يظهر في الموقع — لا في نموذج الإنشاء، ولا في
// بطاقة ختمة لها تذكير (من نسخة احتياطية من التطبيق). وسلوكه داخل التطبيق في tests/unit/reminders-native.test.js
test('في الموقع لا «تذكير يومي» في نموذجي الختمتين: لا خطوة له ولا سطر في الملخص', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  // ختمة الورد: أربع خطوات، وبعد العدد الملخص مباشرة
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٤');
  await nextTo(page, 'count');
  await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'summary');
  await expect(side(page).getByRole('button', { name: 'ابدأ الختمة' })).toBeVisible();
  await expect(side(page).getByText('التذكير اليومي')).toHaveCount(0);
  // ختمة الحفظ: سبع خطوات، وبعد المراجعة البعيدة الملخص
  for (let i = 0; i < 3; i++) await back(page);
  await side(page).getByRole('radio', { name: 'ختمة الحفظ' }).click();
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٧');
  await nextTo(page, 'far');
  await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'summary');
  await expect(side(page).getByRole('button', { name: 'ابدأ ختمة الحفظ' })).toBeVisible();
  await expect(side(page).getByText('التذكير اليومي')).toHaveCount(0);
});

test('في الموقع لا سطر تذكير في بطاقة ختمة لها تذكير', async ({ page }) => {
  await open(page, { 'hq.khatmas': JSON.stringify(wird({ reminder: '20:00' })) });
  await openKhatmaTab(page);
  await expect(side(page).getByRole('button', { name: 'اقرأ', exact: true })).toBeVisible();
  await expect(side(page).getByText('التذكير اليومي')).toHaveCount(0);
});

// تنسيق تبويب الختمة (الجزء ١، ٢٠٢٦-١١-٢٠): الدائرة تسجّل المهمة، و«تراجع» في الرسالة يعيد الختمة كما كانت
test('الدائرة تسجّل الورد، و«تراجع» يعيده كما كان', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird() });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  // مهمة واحدة بزرّ واحد، و«التفاصيل» مطوية
  await expect(card.locator('.task')).toHaveCount(1);
  await expect(card.locator('.task').getByRole('button')).toHaveCount(2); // الدائرة و«اقرأ»
  await expect(card.getByRole('button', { name: 'التفاصيل' })).toHaveAttribute('aria-expanded', 'false');
  await expect(card.getByRole('button', { name: 'حذف الختمة' })).toHaveCount(0);

  await check(card).click();
  const toast = page.locator('.toast');
  await expect(toast).toContainText('أحسنت، تم تسجيل الورد');
  await expect(card.locator('.task--done')).toContainText('ورد اليوم');
  expect((await stored(page, 'hq.khatmas'))[0].done).toBe(1);
  await toast.getByRole('button', { name: 'تراجع' }).click();
  await expect(toast).toHaveText('تم التراجع');
  await expect(card.locator('.task--done')).toHaveCount(0);
  await expect(card.locator('.task')).toContainText('ورد اليوم');
  expect(await stored(page, 'hq.khatmas')).toEqual(wird());
});

test('«تراجع» بعد ختم المصحف يعيد آخر ورد وعدد الختمات', async ({ page }) => {
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': wird({ mode: 'pages', value: 3, from: 598, done: 2, lastDone: '2026-11-11' }), 'hq.khatmasDone': { wird: 2 } });
  await clickTopbar(page, 'القائمة');
  const card = side(page).locator('.khatma__card');
  await check(card).click();
  await expect(card).toContainText('أتممت الختمة');
  expect(await stored(page, 'hq.khatmasDone')).toEqual({ wird: 3 });
  await page.locator('.toast').getByRole('button', { name: 'تراجع' }).click();
  await expect(card).toContainText('الصفحة ٦٠٤');
  expect(await stored(page, 'hq.khatmasDone')).toEqual({ wird: 2 });
});

// نموذج الإنشاء خطوات (تنسيق تبويب الختمة، الجزء ٢، ٢٠٢٦-١١-٢٠)
test('خطوات الإنشاء: «رجوع» يبقي ما اختير، وسطر الملخص يفتح خطوته ويعود إليه', async ({ page }) => {
  await open(page);
  await openKhatmaTab(page);
  await nextTo(page, 'count');
  await side(page).getByRole('radio', { name: '٧ أيام' }).click();
  await back(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'mode');
  await back(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'type');
  await nextTo(page, 'count');
  await expect(side(page).getByRole('radio', { name: '٧ أيام' })).toHaveAttribute('aria-checked', 'true');

  // من الملخص: الخطوة بزرّ «العودة إلى الملخص» وبلا «رجوع»
  await next(page);
  await side(page).locator('.steps__row').filter({ hasText: 'عدد الأيام' }).click();
  await expect(stepOf(page)).toHaveAttribute('data-step', 'count');
  await expect(side(page).getByRole('button', { name: 'رجوع' })).toHaveCount(0);
  await side(page).getByRole('radio', { name: '١٥ يوما' }).click();
  await side(page).getByRole('button', { name: 'العودة إلى الملخص' }).click();
  await expect(stepOf(page)).toHaveAttribute('data-step', 'summary');
  await expect(side(page).locator('.steps__row').nth(1)).toContainText('١٥ يوما');

  // تغيير الطريقة من الملخص يعيد العدد، فيمرّ بخطوة العدد قبل الرجوع إليه
  await side(page).locator('.steps__row').filter({ hasText: 'طريقة التحديد' }).click();
  await expect(side(page).getByRole('button', { name: 'العودة إلى الملخص' })).toBeVisible();
  await side(page).getByRole('radio', { name: 'بالصفحات يوميا' }).click();
  await next(page);
  await expect(stepOf(page)).toHaveAttribute('data-step', 'count');
  await side(page).getByRole('radio', { name: '٢٠ صفحة' }).click();
  await side(page).getByRole('button', { name: 'العودة إلى الملخص' }).click();
  await expect(side(page).locator('.steps__row')).toHaveText([/بالصفحات يوميا/, /٢٠ صفحة/]);
  await side(page).getByRole('button', { name: 'ابدأ الختمة' }).click();
  await expect(side(page).locator('.khatma__card')).toContainText('من الصفحة ١ إلى ٢٠');
  expect(await stored(page, 'hq.khatmas')).toEqual([expect.objectContaining({ type: 'wird', mode: 'pages', value: 20 })]);
});

test('ختمة ورد جديدة مع ختمة حفظ قائمة: لا خطوة للنوع، و«رجوع» في الأولى يلغي الإنشاء', async ({ page }) => {
  const hifz = { type: 'hifz', created: '2026-11-12', dir: 'forward', start: 0, end: 6235, known: true, lines: 15, near: 3, far: 'hizb', next: 0, recent: [], planStart: '2026-11-12', done: 0, doneBefore: 0, lastDone: null, farNext: null, reviewed: null, lastFar: null, hintDismissed: null, finished: null };
  await open(page, { 'hq.sideTab': 'khatma', 'hq.khatmas': [hifz] });
  await clickTopbar(page, 'القائمة');
  await side(page).getByRole('button', { name: 'ختمة ورد جديدة' }).click();
  await expect(side(page).locator('.steps__count')).toHaveText('الخطوة ١ من ٣');
  await expect(side(page).locator('.steps__question')).toHaveText('كيف تحدد ختمتك؟');
  await expect(side(page).getByRole('radio', { name: 'ختمة الورد' })).toHaveCount(0);
  await back(page);
  await expect(side(page).locator('.steps')).toHaveCount(0);
  await expect(side(page).getByRole('button', { name: 'ختمة ورد جديدة' })).toBeVisible();
  expect((await stored(page, 'hq.khatmas')).map((k) => k.type)).toEqual(['hifz']);
});
