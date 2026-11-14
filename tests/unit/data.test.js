// نظافة نصوص البيانات (scripts/data/07-tidy.mjs): التفسيران و«العمل بالآيات»، وتفسير السعدي (10-saadi.mjs)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tidyAction, tidyMukhtasar, tidyMuyassar } from '../../scripts/data/07-tidy.mjs';
import { cleanSaadi } from '../../scripts/data/10-saadi.mjs';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const MY = load('tafsir-muyassar');
const MK = load('tafsir-mukhtasar');
const SA = load('tafsir-saadi');
const ME = load('memos');
const QURAN = load('quran');
const ref = (i) => `${QURAN.verses[i].s}:${QURAN.verses[i].a}`;
// مواضع النصوص التي يطابقها النمط (للرسالة عند الفشل)
const where = (list, re) => list.map((s, i) => (re.test(s) ? i : null)).filter((i) => i != null);
const mkAll = [...MK.verses.filter(Boolean), ...Object.values(MK.fawaid).flat(), ...Object.values(MK.maqasid)];
const actions = ME.actions.map((a) => a.t);
const balanced = (s) => [['(', ')'], ['﴿', '﴾'], ['«', '»'], ['[', ']']].every(([o, c]) => s.split(o).length === s.split(c).length);

describe('قواعد التنظيف', () => {
  it('الميسّر: رقم الآية والنقطة في أول النص، والترقيم المكرر، والمسافة بعد النقطة', () => {
    expect(tidyMuyassar('99] وما أوقعنا')).toBe('وما أوقعنا');
    expect(tidyMuyassar('. واضمم يدك')).toBe('واضمم يدك');
    expect(tidyMuyassar('.والذين جحدوا')).toBe('والذين جحدوا');
    expect(tidyMuyassar('عن الحق.ً.')).toBe('عن الحق.');
    expect(tidyMuyassar('دار البوار،.')).toBe('دار البوار.');
    expect(tidyMuyassar('لتفلحوا،،')).toBe('لتفلحوا،');
    expect(tidyMuyassar('المارُّون بها..')).toBe('المارُّون بها.');
    expect(tidyMuyassar('قال ... ثم')).toBe('قال ... ثم');
    expect(tidyMuyassar('العبادة له ,وحده')).toBe('العبادة له وحده');
    expect(tidyMuyassar('سورة البقرة.هذا القرآن')).toBe('سورة البقرة. هذا القرآن');
    expect(tidyMuyassar('قوله تعالى:ﵡإِنَّكُمۡﵠ')).toBe('قوله تعالى: ﵡإِنَّكُمۡﵠ');
  });

  it('المختصر: لا مسافة قبل علامة الترقيم، ومسافة بعد الفاصلة، ويبقى «...»', () => {
    expect(tidyMukhtasar('صلى الله عليه وسلم .')).toBe('صلى الله عليه وسلم.');
    expect(tidyMukhtasar('موسى ، حيث')).toBe('موسى، حيث');
    expect(tidyMukhtasar('عليه السلام : إن')).toBe('عليه السلام: إن');
    expect(tidyMukhtasar('والجزاء،ولا')).toBe('والجزاء، ولا');
    expect(tidyMukhtasar('﴿بِالْأَمْنِ ...﴾')).toBe('﴿بِالْأَمْنِ ...﴾');
  });

  it('العمل بالآيات: الفاصلة والنقطة بعد قوس الآية', () => {
    expect(tidyAction('(٢٩)﴾ ،﴿وَمَا')).toBe('(٢٩)﴾، ﴿وَمَا');
    expect(tidyAction('أَلِيمٌ ﴾ .')).toBe('أَلِيمٌ ﴾.');
  });

  it('التنظيف لا يغيّر شيئًا إن أُعيد على البيانات', () => {
    expect(where(MY.verses, /./).filter((i) => tidyMuyassar(MY.verses[i]) !== MY.verses[i]).map(ref)).toEqual([]);
    expect(mkAll.filter((s) => tidyMukhtasar(s) !== s)).toEqual([]);
    expect(actions.filter((s) => tidyAction(s) !== s)).toEqual([]);
  });
});

describe('البيانات نظيفة', () => {
  it('الميسّر: لا رقم آية في أول النص، ولا ترقيم مكرر أو لاتيني، ولا جملتان ملتصقتان', () => {
    expect(where(MY.verses, /^\s*[\d٠-٩]+\]|^\./).map(ref)).toEqual([]);
    expect(where(MY.verses, /،[.،]|\.ً|,|(?<!\.)\.\.(?!\.)/).map(ref)).toEqual([]);
    expect(where(MY.verses, /[؀-ۿ]\.[؀-ۿ]/).map(ref)).toEqual([]);
  });

  it('المختصر وفوائده ومقاصده: لا مسافة قبل علامة الترقيم ولا فاصلة ملتصقة بما بعدها', () => {
    expect(mkAll.filter((s) => / [،؛:]| \.(?!\.)|،[؀-ۿ]/.test(s))).toEqual([]);
  });

  it('العمل بالآيات: الأقواس متوازنة في كل نص، وأصلحت المواضع الأربعة', () => {
    expect(actions.filter((s) => !balanced(s))).toEqual([]);
    expect(actions.filter((s) => /﴾ [،.](?!\.)/.test(s))).toEqual([]);
    expect(actions.some((s) => s.startsWith('(كُن في الدنيا كأنك غريب أو عابر سبيل)،'))).toBe(true);
    expect(actions.some((s) => s.includes('(ذو العرش المجيد'))).toBe(false);
  });
});

describe('تفسير السعدي', () => {
  it('التنظيف: الاقتباس ﴿…﴾، والفقرات، والفاصلة العربية، وزيادة المحقق، وبقايا النسخة', () => {
    expect(cleanSaadi('الم|||<p>الحروف المقطعة <span class="t2">[من غير مستند شرعي]</span>, مع الجزم.</p>')).toBe(
      'الحروف المقطعة [من غير مستند شرعي]، مع الجزم.'
    );
    expect(cleanSaadi('x|||<p><span class="t4">{ بِسْمِ اللَّهِ }</span> أي: أبتدئ</p><p>واعلم</p>')).toBe('﴿بِسْمِ اللَّهِ﴾ أي: أبتدئ\nواعلم');
    expect(cleanSaadi('x|||<p>\u200f{\u200fذَلِكُمْ\u200f}\u200f العذاب</p>')).toBe('﴿ذَلِكُمْ﴾ العذاب');
    expect(cleanSaadi('x|||<p>جَهَنَّمُ ْ} أي: من</p>')).toBe('جَهَنَّمُ﴾ أي: من');
    expect(cleanSaadi('x|||<p>لكونه &; 1-599 &; شركا</p>')).toBe('لكونه شركا');
    expect(cleanSaadi('x|||<p>فدل على أن النسخ; لأن فضله</p>')).toBe('فدل على أن النسخ؛ لأن فضله');
    expect(cleanSaadi('طسم|||<p></p>')).toBe('');
  });

  it('لكل آيات المصحف، في مواضعها، بلا وسوم ولا بقايا', () => {
    expect(SA.verses).toHaveLength(QURAN.verses.length);
    expect(where(SA.verses, /[<>{}\u200f]|&[a-z]*;/).map(ref)).toEqual([]);
    expect(where(SA.verses, /[؀-ۿ] ?, ?[؀-ۿ]/).map(ref)).toEqual([]);
    // في موضعه: البقرة ١٠٦ تفسير النسخ نفسه (كان في نسخة Quran.com مزاحًا إلى ١٠٨)، والنساء ٦٠ كالمطبوع
    expect(SA.verses[QURAN.verses.findIndex((x) => x.s === 2 && x.a === 106)]).toMatch(/^النسخ: هو النقل.+فأخبر الله تعالى عن حكمته في النسخ/);
    expect(SA.verses[QURAN.verses.findIndex((x) => x.s === 4 && x.a === 60)]).toMatch(/^يعجب تعالى عباده من حالة المنافقين/);
    expect(SA.verses[0]).toMatch(/^﴿[^﴾]+﴾ أي: أبتدئ بكل اسم لله تعالى/);
  });

  it('الآيات التي لا كلام خاصًّا بها قليلة ومعروفة (النساء ٦١ داخلة في تفسير ٦٠–٦٣)', () => {
    const empty = where(SA.verses, /^$/).map(ref);
    expect(empty.length).toBeLessThanOrEqual(50);
    expect(empty).toContain('4:61');
  });
});
