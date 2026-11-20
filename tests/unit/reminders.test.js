// تذكير الختمة اليومي (تطبيق أندرويد، الجلسة ٣ أ): أيام الإشعارات ونصوصها، وتخطّي يومٍ أُتمّ فيه ما عليه،
// وأن تغيير التذكير لا يمسّ الخطة — src/lib/reminders.js
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as H from '../../src/lib/hifz.js';
import * as K from '../../src/lib/khatma.js';
import * as R from '../../src/lib/reminders.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const Q = { ...load('quran'), qcf: load('qcf4') };
const at = (s, a) => Q.verses.findIndex((v) => v.s === s && v.a === a);
const LAST = Q.verses.length - 1;

beforeEach(() => localStorage.clear());
// وقت محلي في يوم الاختبار
const time = (h, m = 0, day = '2026-11-20') => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};

describe('الوقت', () => {
  it('«HH:MM» صحيح أو لا', () => {
    expect(R.isTime('20:00')).toBe(true);
    expect(R.isTime('05:30')).toBe(true);
    expect(R.isTime('5:30')).toBe(false);
    expect(R.isTime('24:00')).toBe(false);
    expect(R.isTime(null)).toBe(false);
  });

  it('يُعرض بنظام ١٢ ساعة بالأرقام العربية', () => {
    expect(R.timeText('20:00')).toBe('٨:٠٠ م');
    expect(R.timeText('05:30')).toBe('٥:٣٠ ص');
    expect(R.timeText('00:05')).toBe('١٢:٠٥ ص');
    expect(R.timeText('12:15')).toBe('١٢:١٥ م');
  });

  it('ملغى افتراضيًّا: الختمة الجديدة بلا تذكير', () => {
    expect(K.startWird('days', 30, '2026-11-20').reminder).toBe(null);
    expect(H.startHifz({ dir: 'forward', start: 0, end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-20').reminder).toBe(null);
  });
});

describe('ختمة الورد', () => {
  it('بلا تذكير: لا إشعارات', () => {
    const k = K.startWird('days', 30, '2026-11-20');
    expect(R.reminderItems('wird', k, null, time(10))).toEqual([]);
  });

  it('قبل الوقت: من اليوم، ثلاثون يومًا متتابعة بالوقت نفسه ونص الورد الحالي', () => {
    const k = K.startWird('days', 30, '2026-11-20', '20:30');
    const items = R.reminderItems('wird', k, null, time(10));
    expect(items).toHaveLength(R.REMINDER_DAYS);
    expect(items[0]).toEqual({ day: '2026-11-20', time: '20:30', title: 'حان وقت وردك', body: 'الورد ١ من ٣٠، من الصفحة ١ إلى ٢٠' });
    expect(items[1].day).toBe('2026-11-21');
    expect(items.at(-1).day).toBe('2026-12-19');
    // الورد يتبع الإنجاز لا التاريخ: من لم يقرأ يبقى عليه الورد نفسه
    expect(new Set(items.map((x) => x.body)).size).toBe(1);
  });

  it('بعد الوقت: من الغد', () => {
    const k = K.startWird('days', 30, '2026-11-20', '20:30');
    expect(R.reminderItems('wird', k, null, time(20, 30))[0].day).toBe('2026-11-21');
    expect(R.reminderItems('wird', k, null, time(20, 29))[0].day).toBe('2026-11-20');
  });

  it('أتمّ ورده قبل الوقت: لا إشعار اليوم، ومن الغد بالورد التالي', () => {
    K.startWird('days', 30, '2026-11-20', '20:30');
    K.completeWird('2026-11-20');
    const k = K.readWird();
    const items = R.reminderItems('wird', k, null, time(9));
    expect(items[0].day).toBe('2026-11-21');
    expect(items[0].body).toBe('الورد ٢ من ٣٠، من الصفحة ٢١ إلى ٤٠');
    expect(R.doneToday('wird', k, null, time(9))).toBe(true);
    expect(R.doneToday('wird', k, null, time(9, 0, '2026-11-21'))).toBe(false);
  });

  it('ورد من صفحة واحدة: «الصفحة ٥»', () => {
    const k = K.startWird('pages', 1, '2026-11-20', '05:00');
    expect(R.wirdText(k, '2026-11-20').body).toBe('الورد ١ من ٦٠٤، الصفحة ١');
  });

  it('بعد الختم: لا إشعارات', () => {
    K.startWird('days', 1, '2026-11-20', '20:30');
    K.completeWird('2026-11-20');
    expect(R.reminderItems('wird', K.readWird(), null, time(9))).toEqual([]);
    expect(R.doneToday('wird', K.readWird(), null, time(9))).toBe(true);
  });
});

describe('ختمة الحفظ', () => {
  // من مريم، وما قبلها محفوظ: فيها مراجعة بعيدة من أول يوم، والقريبة تبدأ بعد أول ورد
  const start = (reminder = '17:00') =>
    H.startHifz({ dir: 'forward', start: at(19, 1), end: LAST, known: true, lines: 15, near: 3, far: 'hizb', reminder }, '2026-11-20');

  it('بلا عمل اليوم: «عليك اليوم» بخطواته كلها', () => {
    const k = start();
    const items = R.reminderItems('hifz', k, Q, time(9));
    expect(items).toHaveLength(R.REMINDER_DAYS);
    expect(items[0]).toEqual({ day: '2026-11-20', time: '17:00', title: 'حان وقت الحفظ', body: 'عليك اليوم: المراجعة البعيدة وحفظ الورد' });
  });

  it('أتمّ بعض الخطوات: «بقي عليك اليوم» بما بقي، والغد بالخطوات كلها (ومعها المراجعة القريبة)', () => {
    start();
    H.completeHifz(Q, '2026-11-20');
    const items = R.reminderItems('hifz', H.readHifz(), Q, time(12));
    expect(items[0].day).toBe('2026-11-20');
    expect(items[0].body).toBe('بقي عليك اليوم: المراجعة البعيدة والمراجعة القريبة');
    expect(items[1].body).toBe('عليك اليوم: المراجعة البعيدة، والمراجعة القريبة، وحفظ الورد');
  });

  it('أتمّ خطوات اليوم كلها: لا إشعار اليوم، ومن الغد', () => {
    start();
    H.completeReview(Q, 'far', '2026-11-20');
    H.completeHifz(Q, '2026-11-20');
    H.completeReview(Q, 'near', '2026-11-20');
    const k = H.readHifz();
    expect(R.doneToday('hifz', k, Q, time(12))).toBe(true);
    expect(R.reminderItems('hifz', k, Q, time(12))[0].day).toBe('2026-11-21');
  });

  it('بلا مصحف حفص بعد (لم يُحمَّل): لا شيء', () => {
    expect(R.reminderItems('hifz', start(), null, time(9))).toEqual([]);
  });
});

describe('تغيير التذكير', () => {
  it('لا يمسّ خطة الورد ولا تقدّمها', () => {
    K.startWird('days', 30, '2026-11-18');
    K.completeWird('2026-11-18');
    const before = K.readWird();
    K.setReminder('wird', '06:15');
    expect(K.readWird()).toEqual({ ...before, reminder: '06:15' });
    K.setReminder('wird', null);
    expect(K.readWird()).toEqual({ ...before, reminder: null });
  });

  it('ولا خطة الحفظ، ولا الختمة الأخرى', () => {
    K.startWird('days', 30, '2026-11-18', '20:00');
    H.startHifz({ dir: 'forward', start: 0, end: LAST, known: true, lines: 15, near: 3, far: 'hizb' }, '2026-11-18');
    const before = H.readHifz();
    K.setReminder('hifz', '17:45');
    expect(H.readHifz()).toEqual({ ...before, reminder: '17:45' });
    expect(K.readWird().reminder).toBe('20:00');
  });

  it('في الموقع: لا تذكير، ولا يُرسل شيء', () => {
    expect(R.remindersAvailable()).toBe(false);
    expect(() => R.syncReminders({ wird: K.startWird('days', 30, '2026-11-20', '20:00'), hifz: null, hafs: Q })).not.toThrow();
  });
});
