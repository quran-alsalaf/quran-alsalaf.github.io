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
      expect([1, 3]).toContain(f.k);
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

  it('بترتيب المصحف، ثم الختمة الأولى قبل الثالثة على الآيات نفسها', () => {
    for (let i = 1; i < F.items.length; i++) {
      const [a, b] = [F.items[i - 1], F.items[i]];
      expect(b.v[0]).toBeGreaterThanOrEqual(a.v[0]);
      if (a.v.join() === b.v.join()) expect(b.k).toBeGreaterThanOrEqual(a.k);
    }
  });

  it('البناء يعيد الملف نفسه، وبلا مشكلات', () => {
    const one = buildKhatma(H, K1);
    const three = buildKhatma(H, K3);
    expect(one.problems).toEqual([]);
    expect(three.problems).toEqual([]);
    expect(one.items.length + three.items.length).toBe(F.items.length);
  });

  it('الفوائد بلا آية في أولها مربوطة بآياتها (FIXES)', () => {
    expect(byId(3093).v).toEqual([h(1, 1), h(1, 7)]);
    expect(byId(3443).v).toEqual([h(18, 9), h(18, 26)]);
    expect(byId(3443).title).toBe('قصة أصحاب الكهف');
    // فوائد عامة عن السورة أو مقطع منها
    expect(F.items.filter((f) => f.all).map((f) => f.id)).toEqual([3093, 3094, 3443]);
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
      expect(f.k).toBe(1);
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
  });

  it('الصور التي ليست فوائد لا تظهر', () => {
    for (const x of K1.images.filter((i) => i.skip)) expect(byId(x.id)).toBeUndefined();
  });
});

describe('العرض', () => {
  it('فوائد الآيات (في صفحات المحتوى) ومعها العامة عن السورة، وفي مربع الآية ما يخصّها وحده', () => {
    const ids = fawaidIn(H, F, [h(1, 3)]).map((f) => f.id);
    expect(ids).toEqual([3093, 3094]);
    expect(fawaidIn(H, F, [h(1, 3)], { own: true })).toEqual([]);
    expect(fawaidIn(H, F, [h(1, 5)], { own: true }).map((f) => f.id)).toEqual([3096, 3097]);
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
    expect(blocks[1]).toEqual({ verses: [h(1, 2)], items: [byId(3095)] });
    expect(blocks[2].verses).toEqual([h(1, 5)]);
    expect(blocks[2].items.map((f) => f.id)).toEqual([3096, 3097]);
    // فائدة المقطع تحت عنوانه
    const kahf = fawaidBlocks(H, F, [h(18, 12)]).find((b) => b.all);
    expect(wholeHeading(H, kahf.verses)).toBe('الكهف ٩–٢٦');
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
