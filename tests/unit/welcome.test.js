// الشاشة الترحيبية «دليل التطبيق» (src/lib/welcome.js): من هو المستخدم الجديد، والإتمام، والشرائح ولقطاتها
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLIDES, WELCOME_KEY, clampSlide, detectNewUser, markWelcomeSeen, shotUrl, shouldShowWelcome } from '../../src/lib/welcome.js';

function memory(init = {}) {
  const data = new Map(Object.entries(init));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

describe('المستخدم الجديد', () => {
  it('لا مفتاح «hq.» عنده: جديد، فيُكتب show ويظهر الدليل', () => {
    const s = memory({ 'other.app': 'x' });
    expect(detectNewUser(s)).toBe(true);
    expect(s.getItem(WELCOME_KEY)).toBe('show');
    expect(shouldShowWelcome(s)).toBe(true);
  });

  it('عنده أي بيانات سابقة: قديم، فلا يُكتب شيء ولا يظهر', () => {
    const s = memory({ 'hq.page': '50' });
    expect(detectNewUser(s)).toBe(false);
    expect(s.getItem(WELCOME_KEY)).toBeNull();
    expect(shouldShowWelcome(s)).toBe(false);
  });

  it('بعد الإتمام (ابدأ أو تخطٍّ) لا يظهر، ولا يرجع جديدًا', () => {
    const s = memory();
    detectNewUser(s);
    markWelcomeSeen(s);
    expect(s.getItem(WELCOME_KEY)).toBe('seen');
    expect(shouldShowWelcome(s)).toBe(false);
    expect(detectNewUser(s)).toBe(false);
  });

  it('بلا تخزين: لا يتعطّل ولا يظهر', () => {
    const broken = { get length() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(detectNewUser(broken)).toBe(false);
    expect(shouldShowWelcome(broken)).toBe(false);
    expect(() => markWelcomeSeen(broken)).not.toThrow();
  });

  it('سكربت index.html يطبّق القاعدة نفسها قبل كتابة المظهر', () => {
    const html = readFileSync('index.html', 'utf8');
    const welcome = html.indexOf("localStorage.setItem('hq.welcome', 'show')");
    expect(welcome).toBeGreaterThan(0);
    expect(welcome).toBeLessThan(html.indexOf('var BG_KEY'));
  });
});

describe('الشرائح', () => {
  it('ست شرائح بترتيبها المعتمد، والأخيرة تذكر أن الدليل في الإعدادات', () => {
    expect(SLIDES.map((s) => s.title)).toEqual(['أهلًا بك في قرآن السلف', 'المصحف', 'صفحات المحتوى', 'القائمة اليمنى', 'الاستماع', 'الإعدادات']);
    expect(SLIDES.at(-1).note).toContain('«عن التطبيق»');
    for (const s of SLIDES) expect(s.text.length).toBeGreaterThan(20);
  });

  it('لكل شريحة بلقطة أربع لقطات موجودة (المقاسان × الخلفيتان)، والأولى بلا لقطة', () => {
    expect(SLIDES[0].shot).toBe(false);
    for (const s of SLIDES.filter((x) => x.shot)) {
      for (const laptop of [false, true]) {
        for (const theme of ['light', 'dark']) {
          const url = shotUrl(s.id, laptop, theme);
          expect(url).toBe(`/welcome/${s.id}-${laptop ? 'laptop' : 'mobile'}-${theme}.webp`);
          expect(existsSync(`public${url}`)).toBe(true);
        }
      }
    }
  });

  it('رابط اللقطة بمسار التطبيق، وأي نوع غير dark فاتح', () => {
    expect(shotUrl('menu', true, 'dark', '/app/')).toBe('/app/welcome/menu-laptop-dark.webp');
    expect(shotUrl('menu', false, undefined)).toBe('/welcome/menu-mobile-light.webp');
  });

  it('التقليب لا يتجاوز الطرفين', () => {
    expect(clampSlide(-1)).toBe(0);
    expect(clampSlide(3)).toBe(3);
    expect(clampSlide(99)).toBe(SLIDES.length - 1);
  });
});
