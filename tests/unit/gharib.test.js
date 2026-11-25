// معاني الكلمات من «الميسّر في غريب القرآن الكريم» للسور التي لا معاني لها في المذكرات (٢٠٢٦-١١-٢٥):
// بناؤها (scripts/data/20-muyassar-gharib.mjs) ودمجها في فهرس المعاني (src/lib/study.js ← memoIndex)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { build, fixMeaning, fixRows, gharibSuras, locate, readSource } from '../../scripts/data/20-muyassar-gharib.mjs';
import { skeleton } from '../../scripts/data/13-warsh-map.mjs';
import { memoIndex } from '../../src/lib/study.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const H = { ...load('quran'), memos: load('memos'), gharib: load('muyassar') };
const W = { ...load('warsh/quran'), memos: load('warsh/memos'), gharib: load('warsh/muyassar') };
const at = (q, s, a) => q.verses.findIndex((v) => v.s === s && v.a === a);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('بناء معاني الميسّر', () => {
  it('السور: ما لا معاني له في المذكرات، الأعراف إلى التحريم', () => {
    expect(gharibSuras(H, H.memos)).toEqual(range(7, 66));
    expect(H.gharib.suras).toEqual(range(7, 66));
    expect(W.gharib.suras).toEqual(range(7, 66));
  });

  it('الملف المبني يطابق البناء من المصدر', () => {
    const rows = readSource(readFileSync('scripts/data/gharib/muyassar.tsv', 'utf8'));
    expect(rows.length).toBe(11361);
    const { data, unplaced, missing } = build(H, H.memos, rows);
    expect(missing).toEqual([]);
    expect(unplaced.length).toBeLessThanOrEqual(2);
    expect(H.gharib.meanings).toEqual(data.meanings);
    expect(data.meanings.length).toBe(7600);
  });

  it('كل كلمة في سورة من سور الميسّر', () => {
    const suras = new Set(H.gharib.suras);
    for (const [v] of H.gharib.meanings) expect(suras.has(H.verses[v].s)).toBe(true);
  });

  it('موضع الكلمة: التطابق التام قبل الحرف الملتصق، وحروف العطف والجر وحدها', () => {
    // الأحقاف ١٠: «وَشَهِدَ شَاهِدࣱ» — المعنى لـ«شَاهِدࣱ» لا «وَشَهِدَ»
    const t = H.verses[at(H, 46, 10)].t;
    const [from] = locate(t, 'شَاهِدࣱ');
    expect(t[from]).toBe('شَاهِدٞ');
    // البقرة ٥٣: «وَٱلۡفُرۡقَانَ» في المصحف و«ٱلۡفُرۡقَانَ» في الكتاب
    const b = H.verses[at(H, 2, 53)].t;
    expect(b[locate(b, 'ٱلۡفُرۡقَانَ')[0]]).toBe('وَٱلۡفُرۡقَانَ');
    // يونس ٢٠: «ءَايَةࣱ» لا تلتصق بـ«عَلَيۡهِ»
    const y = H.verses[at(H, 10, 20)].t;
    expect(y[locate(y, 'ءَايَةࣱ')[0]]).toBe('ءَايَةٞ');
  });

  it('مسافة زائدة أو ناقصة، واختلاف رسم الهمزة', () => {
    const y = H.verses[at(H, 12, 51)].t;
    const [a, b] = locate(y, 'حَصۡحَصَٱلۡحَقُّ');
    expect(b - a).toBe(1);
    expect(y.slice(a, b + 1).map(skeleton)).toEqual(['حصحص', 'لحق']);
    const h = H.verses[at(H, 11, 10)].t;
    expect(skeleton(h[locate(h, 'ٱلسَّئَِّاتُ')[0]])).toBe(skeleton('ٱلسَّيِّـَٔاتُ'));
    expect(locate(h, 'ٱلسَّئَِّاتُ')).not.toBeNull();
  });

  it('تصحيح الحزمة: كلمات فاطر ١٠–١١ المكتوبة «الأنفال»، والمكرر لآيتين', () => {
    const rows = [
      { s: 35, a: 10, word: 'يَصۡعَدُ', meaning: 'يَرْتَقِي.' },
      { s: 8, a: 10, word: 'يَبُورُ', meaning: 'يَفسُدُ.' },
      { s: 8, a: 11, word: 'مُّعَمَّرࣲ', meaning: 'طَوِيلِ العُمُرِ.' },
      { s: 35, a: 12, word: 'فُرَاتࣱ', meaning: 'حُلْوٌ.' },
      { s: 42, a: 1, word: 'حمٓ عٓسٓقٓ', meaning: 'سبق.' },
      { s: 42, a: 2, word: 'حمٓ عٓسٓقٓ', meaning: 'سبق.' },
      { s: 89, a: 15, word: 'ٱبۡتَلَىٰهُ', meaning: 'اختَبَره.' },
      { s: 89, a: 16, word: 'ٱبۡتَلَىٰهُ', meaning: 'اختَبَره.' },
    ];
    const { rows: out, fixed, dropped } = fixRows(rows, H);
    expect(out.map((r) => r.s).slice(0, 4)).toEqual([35, 35, 35, 35]);
    expect(fixed).toHaveLength(2);
    expect(dropped).toEqual(['42:2 «حمٓ عٓسٓقٓ»']); // «ٱبۡتَلَىٰهُ» في الآيتين كلتيهما فيبقى
  });

  it('تصحيح الضبط دون تغيير الصياغة', () => {
    expect(fixMeaning('ماَلَتْ.')).toBe('مالَتْ.');
    expect(fixMeaning('لاَ تْلتَمِسُوا الأَعْذارَ.')).toBe('لا تَلْتَمِسُوا الأَعْذارَ.');
    expect(fixMeaning('أي: مِنَ الَملاَئِكَةِ.')).toBe('أي: مِنَ الملائِكَةِ.');
    expect(fixMeaning('الَّذِي يَخْتفِي')).toBe('الَّذِي يَخْتفِي');
    expect(fixMeaning('أَنصاراً كالشياطين')).toBe('أَنصاراً كالشياطين');
    expect(fixMeaning('ربِّه ، ويَرْجُو')).toBe('ربِّه، ويَرْجُو');
  });
});

describe('فهرس المعاني مع الميسّر', () => {
  const ih = memoIndex(H);

  it('كل آيات المصحف لها مصدر معانٍ', () => {
    expect(H.verses.every((_, v) => ih.meaningsCovered[v] === 1)).toBe(true);
  });

  it('سور الميسّر: معانيه بلفظ المصحف، وسور المذكرات كما هي', () => {
    const a = at(H, 7, 26);
    expect(ih.gharibOf[a]).toBe(1);
    const words = ih.meaningsOf.get(a);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.src === 'muyassar')).toBe(true);
    expect(words.map((w) => w.mushaf)).toContain('وَرِيشٗاۖ');
    // البقرة والملك من المذكرات وحدها
    for (const [s, n] of [[2, 286], [67, 30]]) {
      for (let x = 1; x <= n; x++) {
        const v = at(H, s, x);
        expect(ih.gharibOf[v]).toBe(0);
        for (const w of ih.meaningsOf.get(v) ?? []) expect(w.src).toBe('memos');
      }
    }
  });

  it('بلا ملف الميسّر يبقى الفهرس كما كان', () => {
    const plain = memoIndex({ ...H, gharib: undefined });
    expect(plain.meaningsCovered[at(H, 7, 26)]).toBe(0);
    expect(plain.meaningsCovered[at(H, 2, 2)]).toBe(1);
  });

  it('ورش: معاني الميسّر على الآيات المقابلة، وكل آياته مغطّاة', () => {
    const iw = memoIndex(W);
    expect(W.verses.every((_, v) => iw.meaningsCovered[v] === 1)).toBe(true);
    const words = iw.meaningsOf.get(at(W, 7, 26)) ?? [];
    expect(words.some((w) => w.src === 'muyassar' && w.mushaf)).toBe(true);
    const placed = W.gharib.meanings.filter((m) => m.length === 5).length;
    expect(placed / W.gharib.meanings.length).toBeGreaterThan(0.99);
  });
});
