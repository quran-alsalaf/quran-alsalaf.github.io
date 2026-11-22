// صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): ترتيب المحتوى على الصور (حجم الخط، والتقسيم عند نهاية جملة،
// وحدّ الصور الأربع و«التتمة»)، ومحتوى البطاقات الأربع، والمشاركة والحفظ في الموقع وداخل التطبيق
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const native = vi.hoisted(() => ({ on: false, shared: [], files: [], cancel: false, saved: [], saveResult: 'saved' }));
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig();
  return {
    ...real,
    Capacitor: { ...real.Capacitor, isNativePlatform: () => native.on },
    registerPlugin: (name) =>
      name === 'QuranGallery'
        ? {
            save: async (opts) => {
              native.saved.push(opts);
              return { result: native.saveResult };
            },
          }
        : real.registerPlugin(name),
  };
});
vi.mock('@capacitor/share', () => ({
  Share: {
    share: async (opts) => {
      if (native.cancel) throw new Error('Share canceled');
      native.shared.push(opts);
    },
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: async (opts) => {
      native.files.push(opts);
      return { uri: `file:///cache/${opts.path}` };
    },
  },
}));

const { MAX_IMAGES, SIZES, layoutShare, sentenceEnds, shareCaption, toWords } = await import('../../src/lib/shareLayout.js');
const { actionUnits, cardSpec, fawaidUnits, meaningUnits, quotedRuns, tafsirUnits } = await import('../../src/lib/shareContent.js');
const { imageNames, saveImages, shareImages } = await import('../../src/lib/shareFiles.js');

const QURAN = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
const vOf = (s, a) => QURAN.verses.findIndex((x) => x.s === s && x.a === a);

// قياس تقديري ثابت: نصف الحجم لكل حرف
const measure = (text, style, px) => text.length * px * 0.5;
const OPTS = { width: 900, height: 950, tail: 80 };
const para = (t) => ({ type: 'para', runs: [{ t, s: 'text' }] });
const sentence = (n) => `${'كلمة '.repeat(n).trim()}.`;
const lines = (page) => page.els.filter((e) => e.kind === 'line');
const textOf = (el) => el.words.map((w) => w.map((x) => x.t).join('')).join(' ');

describe('الكلمات ومواضع الانتقال', () => {
  it('الأجزاء المتلاصقة بلا مسافة كلمة واحدة بنمطين', () => {
    const words = toWords([
      { t: 'قال تعالى: ', s: 'text' },
      { t: '﴿الحمد لله﴾', s: 'quote' },
      { t: '، أي الثناء', s: 'text' },
    ]);
    expect(words.map((w) => w.map((x) => x.t).join(''))).toEqual(['قال', 'تعالى:', '﴿الحمد', 'لله﴾،', 'أي', 'الثناء']);
    expect(words[3]).toEqual([
      { t: 'لله﴾', s: 'quote' },
      { t: '،', s: 'text' },
    ]);
  });

  it('الانتقال بعد نهاية الجملة وحدها، لا داخل الاقتباس القرآني ولا بعد آخر كلمة', () => {
    const words = toWords([{ t: 'أولى. قال: ﴿فإذا فرغت. فانصب﴾ ثانية؟ ثالثة، رابعة.', s: 'text' }]);
    expect(sentenceEnds(words)).toEqual([1, 6]);
    // وعند الفاصلة أيضًا إن طُلب
    expect(sentenceEnds(words, { clauses: true })).toEqual([1, 6, 7]);
  });
});

describe('ترتيب المحتوى على الصور', () => {
  it('المحتوى القصير صورة واحدة بأكبر خط، والآية أولها', () => {
    const r = layoutShare({ title: 'التفسير', ref: 'الفاتحة: ١', verse: 'بسم الله', units: [para('تفسير قصير.')] }, measure, OPTS);
    expect(r.pages).toHaveLength(1);
    expect(r.single).toBe(true);
    expect(r.truncated).toBe(false);
    expect(r.size).toBe(SIZES[0]);
    expect(r.pages[0].els.map((e) => e.kind)).toEqual(['verse', 'line']);
  });

  it('كلما طال المحتوى صغر الخط، حتى أصغر حجم ثم التقسيم على صور', () => {
    const sizes = [1, 4, 8, 14, 40].map((n) => layoutShare({ units: [para(Array.from({ length: n }, () => sentence(10)).join(' '))] }, measure, OPTS));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i].size).toBeLessThanOrEqual(sizes[i - 1].size);
    expect(sizes[0].size).toBe(SIZES[0]);
    expect(sizes.at(-1).size).toBe(SIZES.at(-1));
    expect(sizes.at(-1).pages.length).toBeGreaterThan(1);
  });

  it('الانتقال إلى الصورة التالية عند نهاية جملة، لا في وسطها', () => {
    const r = layoutShare({ units: [para(Array.from({ length: 30 }, () => sentence(9)).join(' '))] }, measure, OPTS);
    expect(r.pages.length).toBeGreaterThan(1);
    for (const p of r.pages.slice(0, -1)) expect(textOf(lines(p).at(-1))).toMatch(/\.$/);
    // ولا يضيع شيء ولا يتكرر
    const all = r.pages.flatMap((p) => lines(p).map(textOf)).join(' ');
    expect(all).toBe(Array.from({ length: 30 }, () => sentence(9)).join(' '));
  });

  it('أربع صور على الأكثر، وفي آخر الرابعة «التتمة» إن بقي شيء', () => {
    const long = layoutShare({ units: Array.from({ length: 60 }, () => para(sentence(30))) }, measure, OPTS);
    expect(long.pages).toHaveLength(MAX_IMAGES);
    expect(long.truncated).toBe(true);
    expect(long.pages.at(-1).els.at(-1).kind).toBe('tail');
    expect(long.pages.slice(0, -1).every((p) => p.els.every((e) => e.kind !== 'tail'))).toBe(true);
    // ولا يتجاوز متن صورة ارتفاعها
    for (const p of long.pages) expect(p.height).toBeLessThanOrEqual(OPTS.height);

    const fits = layoutShare({ units: Array.from({ length: 8 }, () => para(sentence(30))) }, measure, OPTS);
    expect(fits.pages.length).toBeGreaterThan(1);
    expect(fits.pages.length).toBeLessThanOrEqual(MAX_IMAGES);
    expect(fits.truncated).toBe(false);
    expect(fits.pages.flatMap((p) => p.els).some((e) => e.kind === 'tail')).toBe(false);
  });

  it('لا خط فاصل في أول صورة ولا في آخرها، ولا عنوان فائدة منفردًا في آخر صورة', () => {
    const units = [];
    for (let i = 0; i < 12; i++) {
      if (i) units.push({ type: 'rule' });
      units.push({ type: 'para', runs: [{ t: 'قال السعدي:', s: 'bold' }], keepNext: true });
      units.push(para(sentence(40)));
    }
    const r = layoutShare({ units }, measure, OPTS);
    expect(r.pages.length).toBeGreaterThan(1);
    for (const p of r.pages) {
      const kinds = p.els.filter((e) => e.kind !== 'tail').map((e) => e.kind);
      expect(kinds[0]).not.toBe('rule');
      expect(kinds.at(-1)).not.toBe('rule');
      const last = p.els.filter((e) => e.kind === 'line').at(-1);
      expect(last.unit.keepNext).toBeFalsy();
    }
  });

  it('الآية الطويلة (آية الدَّين) تمتد على صورتين، ولا تنفرد عن أول محتواها', () => {
    const spec = cardSpec(QURAN, vOf(2, 282), 'tafsir', { units: [para(sentence(20))] });
    // قياس أقرب إلى خط المصحف (حروفه بتشكيلها أضيق مما يُعدّ)
    const r = layoutShare(spec, (t, st, px) => t.length * px * 0.3, OPTS);
    expect(r.pages.length).toBeGreaterThan(1);
    expect(r.pages[0].els[0].kind).toBe('verse');
    const verseEls = r.pages.flatMap((p) => p.els.filter((e) => e.kind === 'verse'));
    expect(verseEls.length).toBeGreaterThan(1);
    const words = verseEls.flatMap((e) => e.lines.flatMap((l) => l.words.map((w) => w[0].t)));
    expect(words).toEqual(QURAN.verses[vOf(2, 282)].t);
    // آخر الآية في صورة فيها أول التفسير
    const lastVersePage = r.pages.findLast((p) => p.els.some((e) => e.kind === 'verse'));
    expect(lastVersePage.els.some((e) => e.kind === 'line')).toBe(true);
  });

  it('سطر من معاني الكلمات: الكلمة ومعناها معًا، لا يُقسمان', () => {
    const r = layoutShare({ units: meaningUnits([{ word: 'الحمد', mushaf: 'ٱلۡحَمۡدُ', meaning: 'الثناء على الله' }]) }, measure, OPTS);
    const [pair] = r.pages[0].els;
    expect(pair.kind).toBe('pair');
    expect(pair.wordLines[0].words[0][0]).toEqual({ t: 'ٱلۡحَمۡدُ', s: 'word' });
    expect(pair.meaningLines.flatMap((l) => l.words.map((w) => w[0].t)).join(' ')).toBe('الثناء على الله');
  });
});

describe('محتوى البطاقات', () => {
  it('الآيات المقتبسة بنمطها (بلون التطبيق) بعلامتيها', () => {
    expect(quotedRuns('قوله: ﴿الحمد لله﴾ أي الثناء')).toEqual([
      { t: 'قوله: ', s: 'text' },
      { t: '﴿الحمد لله﴾', s: 'quote' },
      { t: ' أي الثناء', s: 'text' },
    ]);
  });

  it('رأس الصور: عنوان البطاقة واسم الآية، والآية بنصها وعلامتها', () => {
    const v = vOf(2, 255);
    const spec = cardSpec(QURAN, v, 'tafsir', { units: [], credit: 'التفسير الميسّر' });
    expect(spec.title).toBe('التفسير');
    expect(spec.ref).toBe('البقرة: ٢٥٥');
    expect(spec.verse).toBe(QURAN.verses[v].t.join(' '));
    expect(spec.credit).toBe('التفسير الميسّر');
    expect(cardSpec(QURAN, v, 'meanings', { units: [] }).title).toBe('معاني الكلمات');
    expect(cardSpec(QURAN, v, 'actions', { units: [] }).title).toBe('العمل بالآيات');
    expect(cardSpec(QURAN, v, 'fawaid', { units: [] }).title).toBe('الفوائد');
  });

  it('التفسير فقراته كما تُعرض، وبينها خط فاصل', () => {
    const units = tafsirUnits('الفقرة الأولى.\nالفقرة الثانية.');
    expect(units.map((u) => u.type)).toEqual(['para', 'rule', 'para']);
  });

  it('العمل: كل توجيه بند وتحته آياته، وبين التوجيهات خط', () => {
    const units = actionUnits(QURAN, [
      { t: 'داوِم على الحمد', v: [vOf(1, 2)] },
      { t: 'سل الله حاجتك', v: [vOf(1, 2), vOf(1, 4)] },
    ]);
    expect(units.map((u) => u.type)).toEqual(['para', 'para', 'rule', 'para', 'para']);
    expect(units[0].bullet).toBe(true);
    expect(units[1].runs).toEqual([{ t: 'الفاتحة ٢', s: 'muted' }]);
    expect(units[4].runs).toEqual([{ t: 'الفاتحة ٢–٤', s: 'muted' }]);
  });

  it('الفائدة: العنوان والقائل لا ينفردان عن نصها، والكلمات الملوّنة بلون التطبيق، والمصدر أصغر، والتوجيه بخطّه', () => {
    const units = fawaidUnits([
      { title: 'عنوان', by: 'قال السعدي:', t: '⸨رب العالمين⸩: نص.\n• بند أول', src: 'تفسير السعدي', tip: 'فاحرص على ذلك' },
      { t: 'فائدة ثانية', src: 'المصدر' },
    ]);
    expect(units.map((u) => u.type)).toEqual(['para', 'para', 'para', 'para', 'para', 'para', 'rule', 'para', 'para']);
    expect(units[0]).toMatchObject({ keepNext: true, runs: [{ t: 'عنوان', s: 'bold' }] });
    expect(units[1]).toMatchObject({ keepNext: true, runs: [{ t: 'قال السعدي:', s: 'bold' }] });
    expect(units[2].runs).toEqual([
      { t: 'رب العالمين', s: 'em' },
      { t: ': نص.', s: 'text' },
    ]);
    expect(units[3]).toMatchObject({ bullet: true, runs: [{ t: 'بند أول', s: 'text' }] });
    expect(units[4]).toMatchObject({ size: 'small', runs: [{ t: 'تفسير السعدي', s: 'muted' }] });
    expect(units[5]).toMatchObject({ bar: true });
  });

  it('السطر المرافق للصور: اسم التطبيق ورابطه', () => {
    expect(shareCaption('https://example.org/')).toBe('من تطبيق قرآن السلف\nhttps://example.org/');
  });
});

describe('المشاركة والحفظ', () => {
  const blobs = [new Blob(['a'], { type: 'image/png' }), new Blob(['b'], { type: 'image/png' })];
  const names = imageNames('quran-alsalaf-tafsir-1-2', 2);
  let downloads;

  beforeEach(() => {
    native.on = false;
    native.shared = [];
    native.files = [];
    native.saved = [];
    native.cancel = false;
    native.saveResult = 'saved';
    downloads = [];
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function click() {
      downloads.push(this.download);
    };
    delete navigator.share;
    delete navigator.canShare;
  });

  it('أسماء الملفات بأرقامها إن كانت أكثر من صورة', () => {
    expect(names).toEqual(['quran-alsalaf-tafsir-1-2-1.png', 'quran-alsalaf-tafsir-1-2-2.png']);
    expect(imageNames('x', 1)).toEqual(['x.png']);
  });

  it('الموقع: مشاركة المتصفح بالصور والسطر المرافق إن أتاحتها', async () => {
    const calls = [];
    navigator.canShare = ({ files }) => files.length === 2;
    navigator.share = async (data) => calls.push(data);
    expect(await shareImages(blobs, names, 'نص')).toBe('shared');
    expect(calls[0].text).toBe('نص');
    expect(calls[0].files.map((f) => f.name)).toEqual(names);
    expect(calls[0].files[0].type).toBe('image/png');
    expect(downloads).toEqual([]);

    navigator.share = async () => {
      throw Object.assign(new Error('x'), { name: 'AbortError' });
    };
    expect(await shareImages(blobs, names, 'نص')).toBe('cancelled');
  });

  it('الموقع بلا مشاركة صور (الحاسوب): تُنزَّل الصور ملفات، وكذلك «حفظ في الصور»', async () => {
    expect(await shareImages(blobs, names, 'نص')).toBe('downloaded');
    expect(downloads).toEqual(names);
    downloads = [];
    expect(await saveImages(blobs, names)).toBe('downloaded');
    expect(downloads).toEqual(names);
  });

  it('داخل التطبيق: الصور ملفات مؤقتة ثم قائمة مشاركة أندرويد بها وبالسطر المرافق', async () => {
    native.on = true;
    expect(await shareImages(blobs, names, 'نص')).toBe('shared');
    expect(native.files.map((f) => f.path)).toEqual(names.map((n) => `share/${n}`));
    expect(native.files[0]).toMatchObject({ directory: 'CACHE', data: btoa('a') });
    expect(native.shared).toEqual([{ files: names.map((n) => `file:///cache/share/${n}`), text: 'نص' }]);

    native.cancel = true;
    expect(await shareImages(blobs, names, 'نص')).toBe('cancelled');
  });

  it('داخل التطبيق: «حفظ في الصور» في معرض الجوال، أو رفض الإذن', async () => {
    native.on = true;
    expect(await saveImages(blobs, names)).toBe('saved');
    expect(native.saved).toEqual([{ images: [{ name: names[0], data: btoa('a') }, { name: names[1], data: btoa('b') }] }]);
    native.saveResult = 'denied';
    expect(await saveImages(blobs, names)).toBe('denied');
  });
});
