// فوائد الآيات (٢٠٢٦-١١-٢٢، «الفوائد» الجلسة ١): قراءة رسائل القناة وربطها بآياتها (scripts/data/19-fawaid.mjs)،
// والبيانات المبنية (public/data/fawaid.json)، وعرضها بترقيم حفص وورش (src/lib/fawaid.js)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIXES, buildKhatma, parseMessage, quoteIn, skeleton } from '../../scripts/data/19-fawaid.mjs';
import { NO_FAWAID, NO_FAWAID_VERSE, emphasisParts, faidaPlain, faidaVerses, fawaidBlocks, fawaidIn, wholeHeading } from '../../src/lib/fawaid.js';
import { copyContent } from '../../src/lib/study.js';

const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const H = load('public/data/quran.json');
const W = load('public/data/warsh/quran.json');
const F = load('public/data/fawaid.json');
const K1 = load('scripts/data/fawaid/khatma1.json');
const K2 = load('scripts/data/fawaid/khatma2.json');
const K3 = load('scripts/data/fawaid/khatma3.json');
const h = (s, a) => H.verses.findIndex((v) => v.s === s && v.a === a);
const w = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const msg = (id) => K3.messages.find((m) => m.id === id);
const byId = (id) => F.items.find((f) => f.id === id);

describe('قراءة رسالة القناة', () => {
  it('الآية وعزوها، ثم القائل، ثم النص، ثم المصدر', () => {
    const f = parseMessage(msg(3096));
    expect(skeleton(f.quote)).toBe(skeleton('إياك نعبد وإياك نستعين'));
    expect(f.ref).toEqual({ sura: 'الفاتحة', from: 5, to: 5 });
    expect(f.by).toBe('قال السعدي رحمه الله:');
    expect(f.t).toMatch(/^ذَكر الاستعانة بعد العبادة/);
    expect(f.src).toBe('تفسير السعدي');
  });

  it('البنود بأي رمز (- ◈ ¤ ← …) ⇐ «• »، واقتباس {…} ⇐ ﴿…﴾', () => {
    const f = parseMessage(msg(3147));
    expect(f.t.split('\n').filter((l) => l.startsWith('• '))).toHaveLength(5);
    expect(parseMessage(msg(3443)).t).toContain('﴿وما عند الله خير للأبرار﴾');
    expect(parseMessage(msg(3443)).t).not.toMatch(/[{}]/);
  });

  it('فائدة بلا سطر قائل: الآية ثم النص ثم المصدر', () => {
    const f = parseMessage(msg(3141));
    expect(f.by).toBe('');
    expect(f.ref).toEqual({ sura: 'البقرة', from: 255, to: 255 });
    expect(f.src).toBe('تفسير ابن كثير');
  });

  it('كلام القائل في سطره نفسه نصٌّ لا سطر قائل', () => {
    const f = parseMessage(msg(3314));
    expect(f.by).toBe('');
    expect(f.t).toMatch(/^قال ابن عباس رضي الله عنهما: إن الله/);
  });

  it('العزو بنقطة أو فاصلة منقوطة، وباسم «سورة …» مشكولًا، وآيتان', () => {
    expect(parseMessage(msg(3855)).ref).toEqual({ sura: 'النازعات', from: 26, to: 26 });
    expect(parseMessage(msg(3671)).ref.from).toBe(3);
    expect(parseMessage(msg(3719)).ref.sura).toBe('سورة مُحمد');
    expect(parseMessage(msg(3118)).ref).toEqual({ sura: 'البقرة', from: 153, to: 154 });
  });

  it('الإعلانات والمقررات والروابط ليست فوائد', () => {
    for (const id of [3086, 3089, 3092, 3112, 3162, 3281, 3286, 3287, 3896]) expect(parseMessage(msg(id))).toBeNull();
  });
});

describe('مطابقة الاقتباس بالمصحف', () => {
  const idx = H.verses.map((v) => skeleton(v.e));
  it('بالرسم العثماني والإملائي، والتاء المفتوحة، والاقتباس المختصر بثلاث نقاط، والآيات بـ«*»', () => {
    expect(quoteIn(idx, 'رَحْمَتَ ٱللَّهِ', h(11, 73), h(11, 73))).toBe(true);
    expect(quoteIn(idx, 'إِنَّ نَاشِئَةَ ٱلَّيْلِ', h(73, 6), h(73, 6))).toBe(true);
    expect(quoteIn(idx, 'الله لا إله إلا هو الحي القيوم . . . وهو العلي العظيم', h(2, 255), h(2, 255))).toBe(true);
    expect(quoteIn(idx, 'فاصدع بما تؤمر وأعرض عن المشركين . إنا كفيناك المستهزئين', h(15, 94), h(15, 95))).toBe(true);
    expect(quoteIn(idx, 'إِيَّاكَ نَعْبُدُ', h(2, 5), h(2, 5))).toBe(false);
  });
});

describe('البيانات المبنية', () => {
  it('الختمة الثالثة كلها (أكثر من ٦٠٠ فائدة)، بلا موضوعات الختمات (أُلغي الوسم في الجلسة ٢)', () => {
    expect(F.themes).toBeUndefined();
    expect(F.items.length).toBeGreaterThan(600);
    expect(new Set(F.items.map((f) => f.id)).size).toBe(F.items.length);
  });

  it('كل فائدة: آيات موجودة، ونص ومصدر، والآية المقتبسة من آياتها', () => {
    const idx = H.verses.map((v) => skeleton(v.e));
    for (const f of F.items) {
      expect([1, 2, 3]).toContain(f.k);
      expect(f.v[0]).toBeGreaterThanOrEqual(0);
      expect(f.v[1]).toBeGreaterThanOrEqual(f.v[0]);
      expect(f.v[1]).toBeLessThan(H.verses.length);
      expect(H.verses[f.v[0]].s).toBe(H.verses[f.v[1]].s);
      expect(f.t.trim()).not.toBe('');
      expect(f.src.trim()).not.toBe('');
      if (f.q) expect(quoteIn(idx, f.q, f.v[0], f.v[1])).toBe(true);
      expect(f.t).not.toMatch(/[{}]/);
    }
  });

  it('بترتيب المصحف، ثم الختمات بالتسلسل (الأولى ثم الثانية ثم الثالثة) على الآيات نفسها', () => {
    for (let i = 1; i < F.items.length; i++) {
      const [a, b] = [F.items[i - 1], F.items[i]];
      expect(b.v[0]).toBeGreaterThanOrEqual(a.v[0]);
      if (a.v.join() === b.v.join()) expect(b.k).toBeGreaterThanOrEqual(a.k);
    }
  });

  it('البناء يعيد الملف نفسه، وبلا مشكلات', () => {
    const one = buildKhatma(H, K1);
    const two = buildKhatma(H, K2);
    const three = buildKhatma(H, K3);
    expect(one.problems).toEqual([]);
    expect(two.problems).toEqual([]);
    expect(three.problems).toEqual([]);
    expect(one.items.length + two.items.length + three.items.length).toBe(F.items.length);
  });

  it('الفوائد بلا آية في أولها مربوطة بآياتها (FIXES)', () => {
    expect(byId(3093).v).toEqual([h(1, 1), h(1, 7)]);
    expect(byId(3443).v).toEqual([h(18, 9), h(18, 26)]);
    expect(byId(3443).title).toBe('قصة أصحاب الكهف');
    // فوائد عامة عن السورة أو مقطع منها
    expect(F.items.filter((f) => f.all && f.k === 3).map((f) => f.id)).toEqual([3093, 3094, 3443]);
    expect(byId(3634).v).toEqual([h(36, 38), h(36, 38)]);
    // كل تصحيح يخصّ فائدة ظاهرة، إلا المتروكة (skip)
    for (const [id, fix] of Object.entries(FIXES)) if (!fix.skip) expect(byId(Number(id))).toBeTruthy();
  });

  it('عزو الفاتحة بلا البسملة يُصحَّح بنص الآية: «الحمد لله رب العالمين» الآية ٢', () => {
    expect(byId(3095).v).toEqual([h(1, 2), h(1, 2)]);
  });

  it('جزء الآية إن لم تُقتبس كاملة', () => {
    expect(skeleton(byId(3141).q)).toBe(skeleton('من ذا الذي يشفع عنده إلا بإذنه'));
    expect(msg(3141).text).toContain(byId(3141).q);
    expect(byId(3096).q).toBeUndefined();
  });
});

describe('الختمة الأولى (صور، الجلسة ٢)', () => {
  const image = (id) => K1.images.find((x) => x.id === id);

  it('نصوص الصور بشكل الرسالة: الآية وعزوها، ثم النص، ثم المصدر', () => {
    const f = parseMessage(image(1100));
    expect(f.ref).toEqual({ sura: 'القصص', from: 23, to: 23 });
    expect(f.src).toBe('تفسير الطبري');
    expect(byId(1100)).toMatchObject({ k: 1, v: [h(28, 23), h(28, 23)] });
  });

  it('الكلمات الملوّنة ⸨…⸩ عنوان في أول السطر وحده (والتلوين في وسط الجمل زخرفة لا تُحفظ)', () => {
    for (const f of F.items) {
      if (!/[⸨⸩]/.test(f.t)) continue;
      // (من الصور وحدها: الختمتان الأولى والثانية)
      expect([1, 2]).toContain(f.k);
      for (const line of f.t.split('\n')) {
        const marks = line.match(/[⸨⸩]/g) ?? [];
        if (!marks.length) continue;
        expect(marks).toEqual(['⸨', '⸩']);
        expect(line).toMatch(/^(?:• )?⸨[^⸩]+⸩/);
      }
    }
    expect(image(1101).design).toBe('b');
    expect(byId(1101).t).not.toMatch(/[⸨⸩]/);
  });

  it('جزء الآية في أعلى الصورة إن لم تكن الآية كاملة', () => {
    expect(skeleton(byId(1101).q)).toBe(skeleton('فجاءته إحداهما تمشي على استحياء'));
    expect(byId(1100).q).toBeUndefined();
  });

  it('الصورة المكررة مرة واحدة، والفائدة عن القرآن كله (بلا سورة) لا تظهر', () => {
    expect(byId(1116)).toBeTruthy();
    expect(byId(1117)).toBeUndefined();
    expect(byId(38)).toBeUndefined();
    expect(FIXES[38]).toEqual({ skip: true });
    // عبارة ليست في الكتاب ومعناها مضطرب (بقرار صاحب المشروع)
    expect(byId(132)).toBeUndefined();
  });

  it('قرارات صاحب المشروع في الربط: آية الصورة الخاطئة، والآيات المتفرقة على أولاها', () => {
    // آية الصورة محمد ١٩ ونصها عن الآية ٣٣: على ٣٣ بلا آية الصورة
    expect(byId(1504)).toMatchObject({ v: [h(47, 33), h(47, 33)] });
    expect(byId(1504).q).toBeUndefined();
    expect(byId(148).v).toEqual([h(3, 120), h(3, 120)]);
    expect(byId(430).v).toEqual([h(7, 205), h(7, 205)]);
    expect(byId(1857)).toMatchObject({ all: 1, v: [h(81, 1), h(81, 29)] });
  });

  it('الصور التي عنوانها اسم سورة: فائدة عامة عن السورة كلها، بلا تكرار اسمها عنوانًا', () => {
    const anfal = byId(455);
    expect(anfal).toMatchObject({ k: 1, all: 1, v: [h(8, 1), h(8, 75)] });
    expect(anfal.title).toBeUndefined();
    expect(byId(486)).toMatchObject({ all: 1, title: 'من أسماء سورة التوبة' });
    expect(byId(799)).toMatchObject({ all: 1, title: 'قصة أصحاب الكهف', v: [h(18, 9), h(18, 26)] });
  });

  it('الآية في أعلى الصورة بلا عزو تُعرف من نصها، والعزو الخاطئ يُصحَّح بها', () => {
    const img = K1.images.find((x) => x.id === 189);
    expect(img.text.split('\n')[0]).toMatch(/^﴿[^﴿]/);
    expect(byId(189).v).toEqual([h(4, 19), h(4, 19)]);
    // العزو «مريم: ٢٤» والآية ٢٥
    expect(byId(836).v).toEqual([h(19, 25), h(19, 25)]);
  });

  it('الصور التي ليست فوائد لا تظهر', () => {
    for (const x of K1.images.filter((i) => i.skip)) expect(byId(x.id)).toBeUndefined();
  });
});

describe('الختمة الثانية «الدعوة إلى الله» (الجلسة ٣)', () => {
  const image = (id) => K2.images.find((x) => x.id === id);
  const msg2 = (id) => K2.messages.find((m) => m.id === id);
  const k2 = F.items.filter((f) => f.k === 2);

  it('صورها كلها (٦٨٥) منسوخة، والإعلان وحده بلا نص', () => {
    expect(K2.images).toHaveLength(685);
    expect(K2.images.filter((x) => !x.text).map((x) => x.id)).toEqual([2900]);
    expect(image(2900).skip).toBeTruthy();
    expect(byId(2900)).toBeUndefined();
    expect(k2.length).toBeGreaterThan(800);
  });

  it('الصورة بشكل الرسالة: الآية وعزوها، ثم النص، ثم المصدر، والتوجيه الدعوي tip منفصلًا', () => {
    const f = parseMessage(image(2050));
    expect(f.ref).toEqual({ sura: 'البقرة', from: 254, to: 254 });
    expect(f.src).toBe('تفسير ابن كثير');
    expect(byId(2050)).toMatchObject({ k: 2, v: [h(2, 254), h(2, 254)] });
    expect(byId(2050).tip).toMatch(/^احرص على/);
    expect(byId(2050).t).not.toContain(byId(2050).tip);
    // كل فائدة من صورة لها توجيه، ورسائل «آية اليوم» النصية بلا توجيه
    const images = new Set(K2.images.map((x) => x.id));
    for (const x of k2) {
      if (images.has(x.id)) expect(x.tip?.trim()).toBeTruthy();
      else expect(x.tip).toBeUndefined();
    }
    expect(F.items.filter((x) => x.tip).every((x) => x.k === 2)).toBe(true);
  });

  it('النسخ: التوجيه بعد المصدر', () => {
    const lines = faidaPlain(byId(2050)).split('\n');
    expect(lines.at(-1)).toBe(byId(2050).tip);
    expect(lines.at(-2)).toBe('تفسير ابن كثير');
  });

  it('العزو الخاطئ في الصورة مربوط بالآية التي في نصها، وآية الصورة الخاطئة لا تُعرض', () => {
    expect(byId(2011).v).toEqual([h(2, 87), h(2, 87)]);
    expect(byId(2593).v).toEqual([h(29, 64), h(29, 64)]);
    expect(byId(2604).v).toEqual([h(30, 60), h(30, 60)]);
    expect(byId(2839).v).toEqual([h(72, 17), h(72, 17)]);
    expect(byId(2901)).toMatchObject({ v: [h(87, 1), h(87, 1)] });
    expect(byId(2901).q).toBeUndefined();
  });

  it('برنامج «آية اليوم»: الفائدة بلا آية في أولها (day) على آية اليوم قبلها', () => {
    expect(msg2(2921).text).toMatch(/آية اليوم/);
    expect(parseMessage(msg2(2921))).toBeNull();
    expect(msg2(2922).day).toBe(true);
    expect(byId(2922)).toMatchObject({ k: 2, v: [h(1, 5), h(1, 5)], src: 'ابن القيم، مدارج السالكين' });
    expect(byId(2934).v).toEqual([h(2, 74), h(2, 74)]);
    expect(byId(3057).v).toEqual([h(4, 48), h(4, 48)]);
    // إعلانات البرنامج والتهنئة ليست فوائد
    for (const id of [2920, 2967, 3081, 3082, 3083]) expect(byId(id)).toBeUndefined();
  });

  it('رسالة «آية اليوم» التي جاءت فيها فائدة (٣٠٦٤) تُقرأ فائدةً على آيتها بلا سطرها الأول', () => {
    expect(byId(3064)).toMatchObject({ v: [h(4, 58), h(4, 58)], src: 'رواه أبو داود والترمذي وأحمد' });
    expect(byId(3064).t).toMatch(/^قال النبي ﷺ/);
  });

  it('المكررة: الصورة تبقى بتوجيهها وتُترك إعادتها نصًّا، والفائدة بلا سطر مصدر تُترك', () => {
    expect(byId(2130).tip).toBeTruthy();
    expect(byId(3070)).toBeUndefined();
    expect(FIXES[2935]).toEqual({ skip: true });
    expect(byId(2935)).toBeUndefined();
  });
});

describe('العرض', () => {
  it('فوائد الآيات (في صفحات المحتوى) ومعها العامة عن السورة، وفي مربع الآية ما يخصّها وحده', () => {
    const ids = fawaidIn(H, F, [h(1, 3)]).map((f) => f.id);
    expect(ids).toEqual([3093, 3094, 16]);
    // البسملة: لا فائدة تخصّها
    expect(fawaidIn(H, F, [h(1, 1)], { own: true })).toEqual([]);
    expect(fawaidIn(H, F, [h(1, 3)], { own: true }).map((f) => f.id)).toEqual([16]);
    // الختمة الأولى ثم الثانية ثم الثالثة
    const k = fawaidIn(H, F, [h(1, 5)], { own: true }).map((f) => byId(f.id).k);
    expect(k).toEqual([...k].sort());
    expect(new Set(k)).toEqual(new Set([1, 2, 3]));
    expect(fawaidIn(H, F, [h(18, 10)], { own: true }).map((f) => f.id)).not.toContain(3443);
    expect(fawaidIn(H, F, [h(2, 255)], { own: true }).map((f) => f.id)).toContain(3141);
    // الفائدة المكتوبة على آيتين تظهر في مربع كلٍّ منهما
    const two = F.items.find((f) => !f.all && f.v[1] > f.v[0]);
    expect(fawaidIn(H, F, [two.v[1]], { own: true })).toContain(two);
  });

  it('كتل صفحات المحتوى: العامة عن السورة أولًا بلا آياتها، ثم آيات كل فائدة ثم فوائدها', () => {
    const blocks = fawaidBlocks(H, F, [h(1, 1), h(1, 2), h(1, 3), h(1, 4), h(1, 5)]);
    expect(blocks[0]).toMatchObject({ all: true, verses: [0, 1, 2, 3, 4, 5, 6] });
    expect(blocks[0].items.map((f) => f.id)).toEqual([3093, 3094]);
    expect(wholeHeading(H, blocks[0].verses)).toBe('سورة الفاتحة');
    // الثانية (٢٠٠٤) ثم الثالثة (٣٠٩٥)
    expect(blocks[1]).toEqual({ verses: [h(1, 2)], items: [byId(2004), byId(3095)] });
    expect(blocks[2]).toEqual({ verses: [h(1, 2), h(1, 3), h(1, 4)], items: [byId(16)] });
    expect(blocks[3].verses).toEqual([h(1, 5)]);
    // الختمة الأولى، ثم الثانية (برنامج «آية اليوم»: ٢٩٢٢–٢٩٢٦)، ثم الثالثة
    const ids = blocks[3].items.map((f) => f.id);
    expect(ids[0]).toBe(15);
    expect(ids.slice(-2)).toEqual([3096, 3097]);
    expect(ids).toEqual(expect.arrayContaining([2922, 2923, 2924, 2925, 2926]));
    expect(blocks[3].items.map((f) => f.k)).toEqual([...blocks[3].items.map((f) => f.k)].sort());
    // فائدة المقطع تحت عنوانه
    // (وقبلها فائدة الختمة الأولى عن سورة الكهف كلها)
    const kahf = fawaidBlocks(H, F, [h(18, 12)]).filter((b) => b.all);
    expect(kahf.map((b) => wholeHeading(H, b.verses))).toEqual(['سورة الكهف', 'الكهف ٩–٢٦']);
  });

  it('النسخ: جزء الآية، والقائل، والنص، والمصدر، وفي صفحات المحتوى الآيات قبلها', () => {
    const t = faidaPlain(byId(3141));
    expect(t.split('\n')[0]).toBe(`﴿${byId(3141).q}﴾`);
    expect(t.endsWith('\nتفسير ابن كثير')).toBe(true);
    expect(faidaPlain(byId(3096)).split('\n')[0]).toBe('قال السعدي رحمه الله:');
    const blocks = fawaidBlocks(H, F, [h(1, 5)]);
    const all = copyContent(
      H,
      'الفوائد',
      blocks.map((b) => ({ verses: b.verses, head: b.all ? wholeHeading(H, b.verses) : undefined, text: b.items.map(faidaPlain).join('\n\n') }))
    );
    expect(all.startsWith('الفوائد\n\nسورة الفاتحة\nقال ابن القيم رحمه الله:\n')).toBe(true);
    expect(all).toContain('ذَكر الاستعانة بعد العبادة');
  });

  it('ورش: فوائد آية ورش هي فوائد ما يقابلها من حفص، وآياتها بترقيم ورش', () => {
    // الفاتحة ١ في ورش = البسملة و«الحمد لله» في حفص
    const ids = fawaidIn(W, F, [w(1, 1)]).map((f) => f.id);
    expect(ids).toContain(3095);
    const f = byId(3093);
    const vs = faidaVerses(W, f);
    expect(W.verses[vs[0]]).toMatchObject({ s: 1, a: 1 });
    expect(W.verses[vs.at(-1)]).toMatchObject({ s: 1, a: 7 });
    expect(wholeHeading(W, vs)).toBe('سورة الفاتحة');
    // آية الكرسي تنقسم في ورش: الفائدة على جزئها الأول تظهر في الجزأين
    expect(fawaidIn(W, F, [w(2, 254)]).map((x) => x.id)).toContain(3141);
  });

  it('الكلمات الملوّنة في صورة الفائدة ⸨…⸩: تُفصل للعرض، وتُنسخ نصًّا بلا علامتيها', () => {
    expect(emphasisParts('⸨والعبادة:⸩ اسم جامع ⸨لكل⸩ ما يحبه')).toEqual([
      [true, 'والعبادة:'],
      [false, ' اسم جامع '],
      [true, 'لكل'],
      [false, ' ما يحبه'],
    ]);
    expect(emphasisParts('بلا تلوين')).toEqual([[false, 'بلا تلوين']]);
    expect(emphasisParts('⸨ناقص')).toEqual([[false, '⸨ناقص']]);
    const f = { t: '⸨والاستعانة:⸩ هي الاعتماد على الله', src: 'تفسير السعدي' };
    expect(faidaPlain(f)).toBe('والاستعانة: هي الاعتماد على الله\nتفسير السعدي');
  });

  it('رسالتا الغياب', () => {
    expect(NO_FAWAID).toBe('لا فوائد في هذه الآيات');
    expect(NO_FAWAID_VERSE).toBe('لا فوائد لهذه الآية');
  });
});
