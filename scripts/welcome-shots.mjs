// لقطات «دليل التطبيق» (الشاشة الترحيبية، src/lib/welcome.js): تُلتقط من التطبيق المبني نفسه، لكل شريحة
// بمقاسَي الجوال واللابتوب وعلى خلفيتين (بيج للفاتحة، رصاصي للداكنة)، وتُحفظ webp في public/welcome.
// إعادة التقاطها بعد أي تغيير في شكل التطبيق:
//   npm run build
//   node scripts/welcome-shots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { clickDock, clickTopbar, longPress, showChrome, waitMushaf } from '../tests/e2e/helpers.js';

const PORT = 4179;
const OUT = new URL('../public/welcome/', import.meta.url);
const SIZES = [
  // الجوال: يُلتقط بدقة مضاعفة ثم يُصغَّر إلى ٦٠٠ بكسل عرضًا (حادّ في إطار الجوال، خفيف الحجم)
  { name: 'mobile', viewport: { width: 390, height: 844 }, scale: 2, width: 600, hasTouch: true },
  { name: 'laptop', viewport: { width: 1440, height: 900 }, scale: 1, width: 1120 },
];
const THEMES = [
  ['light', 'beige'],
  ['dark', 'gray'],
];

const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const started = new Date(today.getTime() - 4 * 86400000);

// بيانات نموذجية: ختمة ورد جارية ليظهر تبويب الختمة ممتلئًا (وبلا علامات، فلا تُلوَّن آيات المصحف)
const seed = (bg) => ({
  'hq.bg': bg,
  'hq.accent': 'amber',
  'hq.riwayah': 'hafs',
  'hq.welcome': 'seen',
  'hq.page': '3',
  'hq.khatmas': [
    { type: 'wird', created: iso(started), mode: 'days', value: 30, from: 1, planStart: iso(started), done: 4, doneBefore: 0, lastDone: iso(started), finished: null },
  ],
});

const SHOTS = {
  async mushaf(page) {
    await longPress(page, 14);
  },
  async study(page) {
    await clickDock(page, 'صفحات المحتوى');
    await expect(page.locator('.study .study__item').first()).toBeVisible();
    await page.locator('.dock').evaluate((el) => el.classList.remove('dock--open'));
  },
  async menu(page) {
    await clickTopbar(page, 'القائمة');
    await page.locator('.sidemenu').getByRole('tab', { name: 'الختمة' }).click();
    await expect(page.locator('.sidemenu')).toHaveClass(/sidemenu--open/);
  },
  async listen(page) {
    await clickDock(page, 'الاستماع للآيات');
    await expect(page.getByRole('dialog', { name: 'الاستماع للآيات' })).toBeVisible();
  },
  async settings(page) {
    await clickTopbar(page, 'الإعدادات');
    await expect.poll(async () => Math.round((await page.locator('.settings__card').boundingBox()).x)).toBe(0);
  },
};

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      // لم يبدأ بعد
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('لم يبدأ خادم المعاينة');
}

async function toWebp(converter, png, width) {
  return converter.evaluate(
    async ({ b64, width }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round((img.height * width) / img.width);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.8).split(',')[1];
    },
    { b64: png.toString('base64'), width }
  );
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
try {
  await waitServer();
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const converter = await (await browser.newContext()).newPage();
  for (const size of SIZES) {
    for (const [theme, bg] of THEMES) {
      for (const [id, act] of Object.entries(SHOTS)) {
        const context = await browser.newContext({
          viewport: size.viewport,
          deviceScaleFactor: size.scale,
          hasTouch: !!size.hasTouch,
          locale: 'ar',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        await page.route(/everyayah\.com|tarteel\.ai|quranpedia\.net/, (r) => r.abort());
        await page.addInitScript((data) => {
          if (sessionStorage.getItem('__seeded')) return;
          sessionStorage.setItem('__seeded', '1');
          localStorage.clear();
          for (const [k, v] of Object.entries(data)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }, seed(bg));
        await page.goto(`http://localhost:${PORT}/`);
        await waitMushaf(page);
        if (id !== 'mushaf') await showChrome(page);
        await act(page);
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);
        const png = await page.screenshot({ animations: 'disabled', caret: 'hide' });
        const webp = Buffer.from(await toWebp(converter, png, size.width), 'base64');
        const file = `${id}-${size.name}-${theme}.webp`;
        writeFileSync(new URL(file, OUT), webp);
        console.log(file, `${Math.round(webp.length / 1024)}KB`);
        await context.close();
      }
    }
  }
  await browser.close();
} finally {
  server.kill();
}
