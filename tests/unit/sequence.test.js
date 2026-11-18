// ترتيب التلاوة مشترك بين مشغّل الموقع (src/lib/player.js) ومشغّل أندرويد (Sequencer.java، ٢٠٢٦-١١-١٨):
// حالات ثابتة في tests/fixtures/sequence.json — مقاطع المقدار كما تُرسل إلى المشغّل الأصلي (nativeItems) وما يُتلى
// بالترتيب. هنا يُتحقق أن مشغّل الموقع يتلوها كذلك، وفي android/app/src/test (SequencerTest) أن Sequencer.java
// يتلوها كذلك؛ فلا يختلف ترتيب التلاوة في التطبيق عن الموقع.
// إن تغيّر منطق الترتيب عن قصد: UPDATE_FIXTURES=1 npx vitest run tests/unit/sequence.test.js ثم راجع الفرق.
import { readFileSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const FIXTURE = 'tests/fixtures/sequence.json'; // من جذر المستودع (حيث يعمل vitest)

class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.paused = true;
    this.attrs = {};
    FakeAudio.last = this;
    FakeAudio.srcs = [];
  }
  set src(v) {
    this.attrs.src = v;
    FakeAudio.srcs.push(v);
  }
  get src() {
    return this.attrs.src;
  }
  getAttribute(n) {
    return this.attrs[n] ?? null;
  }
  removeAttribute(n) {
    delete this.attrs[n];
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
}

// المصحف المصغّر نفسه في tests/unit/player.test.js: الفاتحة (٧)، البقرة (٥)، التوبة (٣)
function miniQuran() {
  const verses = [];
  const add = (s, n, p) => {
    for (let a = 1; a <= n; a++) verses.push({ s, a, p });
  };
  add(1, 7, 1);
  add(2, 5, 2);
  add(9, 3, 187);
  const suras = Array.from({ length: 114 }, (_, i) => ({ n: i + 1, name: `س${i + 1}` }));
  return { verses, suras };
}
const q = miniQuran();
const idx = (s, a) => q.verses.findIndex((v) => v.s === s && v.a === a);
const range = (s, a, b) => Array.from({ length: b - a + 1 }, (_, i) => idx(s, a + i));
// اسم الملف المختصر: «001002»
const label = (url) => url.match(/(\d{6})\.mp3$/)[1];

// الحالات: verses المقدار، والإعدادات، وcont للاستماع المتتابع، وskipAt: { رقم الملف: السابق -١ أو التالي ١ }
const CASES = [
  { name: 'المقدار مرة واحدة', verses: range(1, 2, 3) },
  { name: 'تكرار الآية مرتين والمقدار مرتين', verses: range(1, 2, 3), verseRepeat: 2, rangeRepeat: 2 },
  { name: 'البسملة قبل أول البقرة', verses: [idx(1, 7), idx(2, 1), idx(2, 2)] },
  { name: 'لا بسملة قبل الفاتحة ولا التوبة', verses: [idx(1, 1), idx(9, 1)] },
  { name: 'تكرار الآية لا يعيد البسملة وتكرار المقدار يعيدها', verses: [idx(2, 1)], verseRepeat: 2, rangeRepeat: 2 },
  { name: 'الاستماع المتتابع لا يكرّر المقدار', verses: range(1, 6, 7), rangeRepeat: 3, cont: true },
  { name: 'تكرار المقدار بلا نهاية', verses: [idx(1, 7), idx(2, 1)], rangeRepeat: 0, limit: 12 },
  { name: 'التالي والسابق آيةً آية ومن البسملة', verses: [idx(1, 7), idx(2, 1), idx(2, 2)], verseRepeat: 2, skipAt: { 2: 1, 3: -1, 4: -1 } },
  { name: 'السابق والتالي دائريّان ولا يغيّران عدّاد المقدار', verses: range(2, 1, 3), rangeRepeat: 2, skipAt: { 3: 1, 4: -1 } },
];

let P;
let R;
let NA;
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  globalThis.Audio = FakeAudio;
  window.Audio = FakeAudio;
  P = await import('../../src/lib/player.js');
  R = await import('../../src/lib/reciters.js');
  NA = await import('../../src/lib/nativeAudio.js');
});

// ما يتلوه مشغّل الموقع في الحالة c
function webSequence(c) {
  P.setSettings({ verseRepeat: c.verseRepeat ?? 1, rangeRepeat: c.rangeRepeat ?? 1 });
  P.play(q, c.verses, !!c.cont);
  const seq = [];
  const limit = c.limit ?? 60;
  for (let i = 0; i < limit; i++) {
    seq.push(label(FakeAudio.srcs.at(-1)));
    const before = FakeAudio.srcs.length;
    if (c.skipAt?.[i] != null) P.skip(c.skipAt[i]);
    else FakeAudio.last.dispatchEvent(new Event('ended'));
    if (FakeAudio.srcs.length === before) break;
  }
  return seq;
}

// المقاطع كما تُرسل إلى المشغّل الأصلي، بأسماء الملفات المختصرة
function items(c) {
  const r = R.reciterById('shuraym');
  return NA.nativeItems(q, r, P.unitsOf(q, r, c.verses)).map((it) => ({ f: it.f.map(label), b: it.b && label(it.b) }));
}

function build() {
  return {
    note: 'يُولَّد من tests/unit/sequence.test.js، ويقرؤه android/app/src/test/.../SequencerTest.java',
    cases: CASES.map((c) => ({
      name: c.name,
      items: items(c),
      verseRepeat: c.verseRepeat ?? 1,
      rangeRepeat: c.rangeRepeat ?? 1,
      continuous: !!c.cont,
      limit: c.limit ?? 60,
      skipAt: c.skipAt ?? {},
      expected: webSequence(c),
    })),
  };
}

describe('ترتيب التلاوة: حالات مشتركة مع مشغّل أندرويد', () => {
  it('الحالات الثابتة تطابق مشغّل الموقع', () => {
    const built = build();
    if (process.env.UPDATE_FIXTURES) writeFileSync(FIXTURE, `${JSON.stringify(built, null, 2)}\n`);
    const saved = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    expect(saved).toEqual(built);
  });

  it('الحالات تغطي البسملة والتكرار والسابق والتالي', () => {
    const { cases } = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    const byName = Object.fromEntries(cases.map((c) => [c.name, c.expected]));
    expect(byName['البسملة قبل أول البقرة']).toEqual(['001007', '001001', '002001', '002002']);
    expect(byName['تكرار الآية لا يعيد البسملة وتكرار المقدار يعيدها']).toEqual(['001001', '002001', '002001', '001001', '002001', '002001']);
    // التالي أثناء البسملة إلى البقرة ٢ (لا بسملة)، والسابق منها إلى البقرة ١ ببسملتها، والسابق من البسملة إلى الفاتحة ٧
    // بعدّاد تكرار جديد (تُقرأ مرتين)
    expect(byName['التالي والسابق آيةً آية ومن البسملة']).toEqual([
      '001007', '001007', '001001', '002002', '001001', '001007', '001007', '001001', '002001', '002001', '002002', '002002',
    ]);
    // التالي من آخر آية إلى أول المقدار ببسملته، والسابق منها إلى آخره، ثم يُعاد المقدار مرة ثانية فقط
    expect(byName['السابق والتالي دائريّان ولا يغيّران عدّاد المقدار']).toEqual([
      '001001', '002001', '002002', '002003', '001001', '002003', '001001', '002001', '002002', '002003',
    ]);
  });
});
