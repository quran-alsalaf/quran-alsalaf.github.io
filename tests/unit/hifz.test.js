// ختمة الحفظ (٢٠٢٦-١١-١٦): الأسطر، وتقسيم الأوراد في الاتجاهين، والمحفوظ وما قبل البداية، والمراجعتان،
// واقتراح المراجعة البعيدة والتنبيه على إهمالها، والإتمام والتعديل، واجتماعها مع ختمة الورد — src/lib/hifz.js
// ومعها التسميع على آيات معيّنة — src/lib/recite.js
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as H from '../../src/lib/hifz.js';
import * as K from '../../src/lib/khatma.js';
import { allRevealed, reveal, revealedVerses, scopedWords } from '../../src/lib/recite.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const Q = { ...load('quran'), qcf: load('qcf4') };
const at = (s, a) => Q.verses.findIndex((v) => v.s === s && v.a === a);
const suraFirst = (s) => at(s, 1);
const suraLast = (s) => at(s, Q.suras[s - 1].count);
const LAST = Q.verses.length - 1;
const label = (v) => `${Q.verses[v].s}:${Q.verses[v].a}`;
const wordsOf = (a, b) => b - a + 1;

beforeEach(() => localStorage.clear());

// ختمة محفوظة كما ينشئها startHifz، بما يُمرَّر
const make = (over = {}) => ({
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

describe('الأسطر', () => {
  it('أسطر المصحف كله بعدد أسطر الآيات في الصفحات (بلا أسماء السور والبسملة)، والصفحة ١٥ سطرا', () => {
    const textLines = Q.pages.reduce((n, p) => n + p.filter((l) => l.g).length, 0);
    expect(H.totalLines(Q)).toBeCloseTo(textLines, 6);
    // الصفحة ٣٠٠ أسطرها كلها آيات: ١٥ سطرا
    const vs = Q.verses.map((v, i) => [v.p, i]).filter(([p]) => p === 300).map(([, i]) => i);
    const firstFull = Q.pages[299].every((l) => l.g) && Q.pages[299][0].g[0][1] === 0;
    if (firstFull) expect(H.linesOf(Q, vs[0], vs.at(-1))).toBeCloseTo(15, 0);
  });

  it('نصوص المقدار اليومي: «نصف وجه» و«وجه» و«وجهان» وما سواها بالأسطر', () => {
    expect(H.LINE_PRESETS.map(H.linesText)).toEqual(['٣ أسطر', '٥ أسطر', 'نصف وجه', 'وجه', 'وجهان']);
    expect(H.linesText(45)).toBe('٤٥ سطرا');
    expect(H.wirdsText(5)).toBe('٥ أوراد');
  });
});

describe('الخطة: البداية والنهاية والاتجاه', () => {
  it('المتقدم: النهاية بعد البداية', () => {
    expect(H.validPlan(Q, 'forward', 0, LAST)).toBe(true);
    expect(H.validPlan(Q, 'forward', 100, 99)).toBe(false);
    expect(H.validPlan(Q, 'forward', 100, 100)).toBe(true);
  });

  it('العكسي: سورة النهاية قبل سورة البداية، أو هي هي والنهاية بعد البداية فيها', () => {
    expect(H.validPlan(Q, 'reverse', suraFirst(114), suraLast(1))).toBe(true);
    expect(H.validPlan(Q, 'reverse', suraFirst(114), suraLast(2))).toBe(true);
    expect(H.validPlan(Q, 'reverse', suraFirst(2), suraFirst(114))).toBe(false);
    expect(H.validPlan(Q, 'reverse', at(67, 1), at(67, 30))).toBe(true);
    expect(H.validPlan(Q, 'reverse', at(67, 10), at(67, 5))).toBe(false);
  });

  it('قطع العكسي: السور من الآخر، وكل سورة من أولها إلى آخرها، وأول سورة البداية من آيتها', () => {
    const b = H.planBlocks(Q, 'reverse', at(112, 2), suraLast(110));
    expect(b.map(([a, z, whole]) => [label(a), label(z), whole])).toEqual([
      ['112:2', '112:4', false],
      ['111:1', '111:5', true],
      ['110:1', '110:3', true],
    ]);
  });
});

// يتحقق أن كل ورد أقرب إلى المطلوب: بلا آخر آية فيه كان أبعد، وبزيادة الآية بعده يصير أبعد (أو أبعد سواء)
function closest(wirds, target, lastOfBlock) {
  for (const [a, b] of wirds.slice(0, -1)) {
    const L = H.linesOf(Q, a, b);
    if (a < b) {
      const without = H.linesOf(Q, a, b - 1);
      expect(Math.abs(L - target)).toBeLessThanOrEqual(Math.abs(without - target) + 1e-9);
    }
    if (!lastOfBlock(b)) {
      const more = H.linesOf(Q, a, b + 1);
      expect(Math.abs(more - target)).toBeGreaterThanOrEqual(Math.abs(L - target) - 1e-9);
    }
  }
}

describe('تقسيم الأوراد بالأسطر', () => {
  it('المتقدم: أوراد متتابعة بلا فجوة تغطي الخطة، وكل ورد أقرب ما يكون إلى المطلوب', () => {
    for (const target of [3, 7.5, 15, 30]) {
      const w = H.splitHifz(Q, 'forward', 0, LAST, target);
      expect(w[0][0]).toBe(0);
      expect(w.at(-1)[1]).toBe(LAST);
      for (let i = 1; i < w.length; i++) expect(w[i][0]).toBe(w[i - 1][1] + 1);
      // أول ما يُحفظ من الورد أوله
      expect(w.every(([a, , first]) => first === a)).toBe(true);
      closest(w, target, () => false);
    }
  });

  it('المتقدم: وجه يومياً ⇐ نحو ٥٩٠ وردا، أولها الفاتحة إلى البقرة ٦', () => {
    const w = H.splitHifz(Q, 'forward', 0, LAST, 15);
    expect(w.length).toBeGreaterThan(560);
    expect(w.length).toBeLessThan(620);
    expect([label(w[0][0]), label(w[0][1])]).toEqual(['1:1', '2:6']);
  });

  it('العكسي: كل ورد قطعة متصلة في المصحف، داخل سورة واحدة أو سورًا كاملة، وتغطي الخطة مرة واحدة', () => {
    for (const target of [5, 15, 30]) {
      const w = H.splitHifz(Q, 'reverse', suraFirst(114), suraLast(1), target);
      const seen = new Set();
      for (const [a, b] of w) {
        const [s1, s2] = [Q.verses[a].s, Q.verses[b].s];
        if (s1 !== s2) {
          expect(a).toBe(suraFirst(s1));
          expect(b).toBe(suraLast(s2));
        }
        for (let v = a; v <= b; v++) {
          expect(seen.has(v)).toBe(false);
          seen.add(v);
        }
      }
      expect(seen.size).toBe(Q.verses.length);
    }
  });

  it('العكسي: السور من الآخر وكل سورة من أولها، وأول ما يُحفظ من ورد السور الكاملة آخرها في المصحف', () => {
    const w = H.splitHifz(Q, 'reverse', suraFirst(114), suraLast(2), 15);
    // أول ورد: النصر إلى الناس (١٥ سطرا)، يُبدأ فيه بالناس
    expect([label(w[0][0]), label(w[0][1]), label(w[0][2])]).toEqual(['110:1', '114:6', '114:1']);
    // ترتيب الحفظ: سورة كل ورد لا تأتي بعد سورة الورد الذي قبله في المصحف
    for (let i = 1; i < w.length; i++) expect(Q.verses[w[i][2]].s).toBeLessThanOrEqual(Q.verses[w[i - 1][2]].s);
    // البقرة آخرها: تُحفظ من أولها إلى آخرها
    const baqara = w.filter(([a]) => Q.verses[a].s === 2);
    expect(baqara[0][0]).toBe(suraFirst(2));
    expect(baqara.at(-1)[1]).toBe(suraLast(2));
    for (let i = 1; i < baqara.length; i++) expect(baqara[i][0]).toBe(baqara[i - 1][1] + 1);
    expect(w.at(-1)[1]).toBe(suraLast(2));
  });

  it('التقسيم بلا ذاكرة: من أول ما يُحفظ من أي ورد تخرج الأوراد التالية نفسها', () => {
    for (const dir of ['forward', 'reverse']) {
      const [s, e] = dir === 'forward' ? [0, LAST] : [suraFirst(114), suraLast(1)];
      const all = H.splitHifz(Q, dir, s, e, 7.5);
      for (const i of [1, 5, 40, 200, all.length - 1]) expect(H.splitHifz(Q, dir, all[i][2], e, 7.5)).toEqual(all.slice(i));
    }
  });
});

describe('المحفوظ وما قبل البداية', () => {
  it('المتقدم: ما قبل البداية في المصحف', () => {
    const start = at(10, 1); // يونس (أول الجزء ١١ تقريبا)
    expect(H.beforeRanges(Q, 'forward', start)).toEqual([[0, start - 1]]);
    expect(H.beforeRanges(Q, 'forward', 0)).toEqual([]);
  });

  it('العكسي: السور بعد سورة البداية، وأول سورتها إلى ما قبلها', () => {
    expect(H.beforeRanges(Q, 'reverse', suraFirst(114))).toEqual([]);
    expect(H.beforeRanges(Q, 'reverse', at(67, 10))).toEqual([
      [suraFirst(67), at(67, 9)],
      [suraFirst(68), LAST],
    ]);
  });

  it('المحفوظ: ما قبل البداية وما حُفظ من الخطة، وبلا ما قبل البداية مع «لا أحفظ ما قبل البداية»', () => {
    const k = make({ dir: 'reverse', start: suraFirst(78), end: suraLast(1), next: at(12, 50) });
    // الحفظ من النبأ إلى الفاتحة، والموضع يوسف ٥٠
    expect(H.memorizedRanges(Q, k).map(([a, b]) => [label(a), label(b)])).toEqual([
      ['12:1', '12:49'],
      ['13:1', '114:6'],
    ]);
    expect(H.memorizedRanges(Q, { ...k, known: false }).map(([a, b]) => [label(a), label(b)])).toEqual([
      ['12:1', '12:49'],
      ['13:1', '78:40'],
    ]);
  });
});

describe('المراجعة البعيدة', () => {
  // المثال الذي ذكره صاحب المشروع: يحفظ من الناس، والدرس الآن يوسف ٥٠
  const yusuf = make({ dir: 'reverse', start: suraFirst(114), end: suraLast(1), next: at(12, 50), far: 'juz' });

  it('تبدأ من أول المحفوظ في اتجاه الخطة: جزء عمّ ثم تبارك، وكل جزء من أوله', () => {
    const r = H.farReview(Q, yusuf);
    expect(r.name).toBe('الجزء ٣٠');
    expect(r.ranges.map(([a, b]) => [label(a), label(b)])).toEqual([['78:1', '114:6']]);
    const after = H.farReview(Q, { ...yusuf, farNext: r.ranges[0][0] - 1 });
    expect(after.name).toBe('الجزء ٢٩');
  });

  it('في الجزء الذي فيه الدرس يُراجَع المحفوظ وحده، ثم تعود المراجعة إلى البداية', () => {
    const j13 = Q.verses.findIndex((v) => v.j === 13);
    const r13 = H.farReview(Q, { ...yusuf, farNext: j13 });
    expect(r13.name).toBe('الجزء ١٣');
    expect(r13.ranges.map(([a, b]) => [label(a), label(b)])).toEqual([['13:1', '14:52']]);
    const j12 = Q.verses.findIndex((v) => v.j === 12);
    const r12 = H.farReview(Q, { ...yusuf, farNext: j12 });
    expect(r12.name).toBe('الجزء ١٢');
    expect(r12.ranges.map(([a, b]) => [label(a), label(b)])).toEqual([['12:1', '12:49']]);
    // بعد الجزء ١٢ لا محفوظ: تعود إلى جزء عمّ
    const back = H.farReview(Q, { ...yusuf, farNext: j12 - 1 });
    expect(back.name).toBe('الجزء ٣٠');
    expect(back.wrapped).toBe(true);
  });

  it('المتقدم بلا ما قبل البداية: تبدأ من أول ما حُفظ في الختمة', () => {
    const start = at(10, 1);
    const k = make({ start, next: at(11, 1), known: false, far: 'hizb' });
    const r = H.farReview(Q, k);
    expect(r.ranges[0][0]).toBe(start);
    expect(r.ranges.at(-1)[1]).toBeLessThan(at(11, 1));
  });

  it('لا محفوظ ⇐ لا مراجعة بعيدة', () => {
    expect(H.farReview(Q, make({ known: true, start: 0, next: 0 }))).toBeNull();
  });

  it('الوحدات: ٢٤٠ ربعا، ٦٠ حزبا، ٣٠ جزءا، ١٥ زوجا، تغطي المصحف بلا فجوة', () => {
    for (const [u, count] of [['rub', 240], ['hizb', 60], ['juz', 30], ['juz2', 15]]) {
      const units = H.farUnits(Q, u);
      expect(units).toHaveLength(count);
      expect(units[0][0]).toBe(0);
      expect(units.at(-1)[1]).toBe(LAST);
      for (let i = 1; i < units.length; i++) expect(units[i][0]).toBe(units[i - 1][1] + 1);
    }
    expect(H.farUnits(Q, 'juz2')[14][2]).toBe('الجزءان ٢٩ و٣٠');
    expect(H.farUnits(Q, 'hizb')[59][2]).toBe('الحزب ٦٠');
  });

  it('المقترح: حزب لمن يحفظ أقل من نصف القرآن، وجزء لمن يحفظ نصفه فأكثر', () => {
    expect(H.suggestFar(Q, [])).toBe('hizb');
    expect(H.suggestFar(Q, [[0, at(10, 1)]])).toBe('hizb');
    expect(H.suggestFar(Q, [[0, at(19, 1)]])).toBe('juz');
  });

  it('إتمامها ينقلها إلى الوحدة التالية، ويُسجَّل لليوم وحده', () => {
    H.startHifz({ dir: 'forward', start: at(19, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-16');
    let s = H.hifzState(Q, H.readHifz(), '2026-11-16');
    expect(s.far.name).toBe('الحزب ١');
    expect(s.farDone).toBe(false);
    H.completeReview(Q, 'far', '2026-11-16');
    s = H.hifzState(Q, H.readHifz(), '2026-11-16');
    expect(s.far.name).toBe('الحزب ٢');
    expect(s.farDone).toBe(true);
    expect(H.hifzState(Q, H.readHifz(), '2026-11-17').farDone).toBe(false);
  });
});

describe('الإتمام والتقدّم والتعديل', () => {
  it('حفظ الورد ينقل الموضع إلى الورد التالي، ويُبقي آخر الأوراد للمراجعة القريبة', () => {
    H.startHifz({ dir: 'reverse', start: suraFirst(114), end: suraLast(1), known: true, lines: 7.5, near: 2, far: 'hizb' }, '2026-11-16');
    const first = H.hifzState(Q, H.readHifz(), '2026-11-16').current;
    expect(H.completeHifz(Q, '2026-11-16')).toBe('next');
    let k = H.readHifz();
    let s = H.hifzState(Q, k, '2026-11-16');
    expect(s.doneToday).toBe(true);
    expect(s.index).toBe(2);
    expect(H.nearReview(k)).toEqual([first.slice(0, 2)]);
    // المحفوظ هو الورد الأول وحده
    expect(s.ranges).toEqual([first.slice(0, 2)]);
    H.completeHifz(Q, '2026-11-17');
    H.completeHifz(Q, '2026-11-18');
    k = H.readHifz();
    expect(H.nearReview(k)).toHaveLength(2);
    // آخر ورد أولًا؟ لا: بترتيب الحفظ، أقدمها أولًا
    expect(Q.verses[H.nearReview(k)[0][0]].s).toBeGreaterThanOrEqual(Q.verses[H.nearReview(k)[1][0]].s);
    s = H.hifzState(Q, k, '2026-11-18');
    expect(s.far.name).toBe('الحزب ٦٠');
  });

  it('الختم: بعد آخر ورد تُختم الختمة ويزيد عدد ختمات الحفظ', () => {
    H.startHifz({ dir: 'forward', start: at(114, 1), end: LAST, known: true, lines: 30, near: 0, far: 'juz' }, '2026-11-16');
    expect(H.completeHifz(Q, '2026-11-16')).toBe('finished');
    expect(H.readHifz().finished).toBe('2026-11-16');
    expect(K.readDoneCount('hifz')).toBe(1);
    expect(K.readDoneCount('wird')).toBe(0);
  });

  it('التأخر والتقدّم بالإنجاز لا بالتاريخ', () => {
    H.startHifz({ dir: 'forward', start: 0, end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-10');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-16').behind).toBe(6);
    for (let d = 10; d <= 16; d++) H.completeHifz(Q, `2026-11-${d}`);
    for (let d = 0; d < 3; d++) H.completeHifz(Q, '2026-11-16');
    const s = H.hifzState(Q, H.readHifz(), '2026-11-16');
    expect(s.behind).toBe(0);
    expect(s.ahead).toBe(3);
  });

  it('تعديل الخطة: يبقى الموضع وما حُفظ، ويتغيّر الحفظ اليومي والمراجعتان، ويبدأ من الغد إن حُفظ ورد اليوم', () => {
    H.startHifz({ dir: 'forward', start: 0, end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-16');
    H.completeHifz(Q, '2026-11-16');
    const before = H.readHifz();
    H.editHifz({ lines: 5, near: 1, far: 'juz' }, '2026-11-16');
    const k = H.readHifz();
    expect(k.next).toBe(before.next);
    expect([k.lines, k.near, k.far]).toEqual([5, 1, 'juz']);
    expect(k.planStart).toBe('2026-11-17');
    expect(k.doneBefore).toBe(1);
    const s = H.hifzState(Q, k, '2026-11-17');
    expect(s.index).toBe(2);
    expect(H.linesOf(Q, s.current[0], s.current[1])).toBeLessThan(8);
  });

  it('اقتراح زيادة المراجعة إذا تجاوز المحفوظ النصف ووحدتها دون الجزء، ويُغلق بـ«ليس الآن»', () => {
    H.startHifz({ dir: 'forward', start: at(19, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-16');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-16').suggest).toBe('juz');
    H.dismissHint('juz');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-16').suggest).toBeNull();
    // ومن يحفظ أقل من النصف لا يُقترح عليه
    localStorage.clear();
    H.startHifz({ dir: 'forward', start: at(10, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-16');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-16').suggest).toBeNull();
  });

  it('التنبيه على إهمال المراجعة: ثلاثة أيام بلا مراجعة بعيدة', () => {
    H.startHifz({ dir: 'forward', start: at(10, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-10');
    H.completeHifz(Q, '2026-11-10');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-12').neglected).toBe(false);
    expect(H.hifzState(Q, H.readHifz(), '2026-11-13').neglected).toBe(true);
    H.completeReview(Q, 'far', '2026-11-13');
    expect(H.hifzState(Q, H.readHifz(), '2026-11-14').neglected).toBe(false);
  });

  it('المحفوظ بالأجزاء تقريبا', () => {
    expect(H.memorizedText(Q, 0)).toBe('أقل من جزء');
    expect(H.memorizedText(Q, H.totalLines(Q))).toBe('القرآن كله');
    expect(H.memorizedText(Q, (H.totalLines(Q) / 30) * 12.4)).toBe('١٢ جزءا');
  });
});

describe('اجتماع الختمتين', () => {
  it('ختمة الورد وختمة الحفظ تجتمعان، وحذف إحداهما أو تغييرها لا يمس الأخرى', () => {
    K.startWird('days', 30, '2026-11-16');
    H.startHifz({ dir: 'forward', start: 0, end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-16');
    expect(K.readKhatmas().map((k) => k.type).sort()).toEqual(['hifz', 'wird']);
    K.completeWird('2026-11-16');
    expect(H.readHifz().next).toBe(0);
    H.completeHifz(Q, '2026-11-16');
    expect(K.readWird().done).toBe(1);
    K.removeWird();
    expect(H.readHifz()).not.toBeNull();
    H.removeHifz();
    expect(K.readKhatmas()).toEqual([]);
  });
});

describe('التسميع على آيات معيّنة', () => {
  it('لا يُكشف ولا يُعدّ إلا كلمات آيات النطاق، وتبقى بقية الصفحة', () => {
    // صفحة ٦٠٤: الإخلاص والفلق والناس، والنطاق الفلق والناس
    const scope = new Set(Array.from({ length: wordsOf(suraFirst(113), LAST) }, (_, i) => suraFirst(113) + i));
    const all = scopedWords(Q, 604, null);
    const some = scopedWords(Q, 604, scope);
    expect(some.length).toBeLessThan(all.length);
    expect(some.every((v) => scope.has(v))).toBe(true);
    let state = {};
    state = reveal(Q, [604], state, Infinity, scope);
    expect(revealedVerses(Q, [604], state, scope)).toEqual([suraFirst(113)]);
    while (!allRevealed(Q, [604], state, scope)) state = reveal(Q, [604], state, Infinity, scope);
    expect(state[604]).toBe(some.length);
    expect(reveal(Q, [604], state, 2, scope)).toBeNull();
  });
});
