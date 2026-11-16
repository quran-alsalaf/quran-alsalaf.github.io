// النسخة الاحتياطية والاستعادة: بناء الملف، والتحقق منه، والملخّص، والاستبدال الكامل، وسطر آخر نسخة
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_APP,
  BACKUP_KEYS,
  BACKUP_VERSION,
  LAST_BACKUP_KEY,
  backupFileName,
  backupText,
  buildBackup,
  lastBackupText,
  markBackup,
  parseBackup,
  readLastBackup,
  restoreBackup,
  summarizeBackup,
} from '../../src/lib/backup.js';
import * as U from '../../src/lib/userdata.js';
import { readLastPage } from '../../src/lib/position.js';
import { readReadingSpeed, readRubAlert } from '../../src/lib/settings.js';

beforeEach(() => localStorage.clear());

// بيانات مستخدم كاملة كما يكتبها التطبيق
function seed() {
  U.setNote(5, 'ملاحظة أولى');
  U.setNote(9, 'بآيتها', true);
  U.createBookmark({ name: 'أخطائي', multi: true }, 12);
  U.createBookmark({ name: 'وقفت هنا' }, 40);
  U.saveRange([1, 7]);
  U.saveContentRange([8]);
  localStorage.setItem('hq.khatmas', JSON.stringify([{ type: 'wird', created: '2026-11-01', mode: 'days', value: 30, from: 1, planStart: '2026-11-01', done: 3, doneBefore: 0, lastDone: '2026-11-03', finished: null }]));
  localStorage.setItem('hq.khatmasDone', JSON.stringify({ wird: 2 }));
  localStorage.setItem('hq.page', '77');
  localStorage.setItem('hq.riwayah', 'warsh');
  localStorage.setItem('hq.bg', 'black');
  localStorage.setItem('hq.accent', 'emerald');
  localStorage.setItem('hq.weeks', 'on');
  localStorage.setItem('hq.rubAlert', 'off');
  localStorage.setItem('hq.readSpeed', '12.5');
  localStorage.setItem('hq.tafsir', 'baghawy');
  localStorage.setItem('hq.listen', JSON.stringify({ reciter: 'husary', warshReciter: 'w-husary', verseRepeat: 3, rangeRepeat: 1 }));
  // ما لا يدخل النسخة
  localStorage.setItem('hq.searchHistory', JSON.stringify(['الرحمن']));
  localStorage.setItem('hq.offline', JSON.stringify({ husary: { status: 'done', count: 1, total: 1 } }));
  localStorage.setItem('hq.tafsirDownloads', JSON.stringify({ baghawy: { status: 'done', count: 114, total: 114 } }));
  localStorage.setItem('hq.sideTab', 'notes');
}

const snapshotKeys = () => Object.fromEntries(Object.keys(BACKUP_KEYS).map((k) => [k, localStorage.getItem(k)]));

describe('بناء النسخة', () => {
  it('تحوي بيانات المستخدم وإعداداته، بلا التحميلات وسجل البحث والتبويب وتاريخ آخر نسخة', () => {
    seed();
    markBackup(new Date('2026-11-10T10:00:00Z'));
    const b = buildBackup(new Date('2026-11-16T08:00:00Z'));
    expect(b.app).toBe(BACKUP_APP);
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.created).toBe('2026-11-16T08:00:00.000Z');
    expect(Object.keys(b.data).sort()).toEqual(Object.keys(BACKUP_KEYS).sort());
    expect(b.data['hq.page']).toBe(77);
    expect(b.data['hq.bg']).toBe('black');
    expect(b.data['hq.readSpeed']).toBe(12.5);
    expect(b.data['hq.bookmarks']).toHaveLength(2);
    expect(b.data['hq.notes']['9']).toEqual({ text: 'بآيتها', verse: true });
    for (const k of ['hq.searchHistory', 'hq.offline', 'hq.tafsirDownloads', 'hq.sideTab', LAST_BACKUP_KEY]) expect(b.data).not.toHaveProperty(k);
  });

  it('جهاز بلا بيانات: نسخة فارغة صالحة', () => {
    const b = buildBackup();
    expect(b.data).toEqual({});
    expect(parseBackup(backupText(b)).ok).toBe(true);
  });

  it('اسم الملف بتاريخ اليوم', () => {
    expect(backupFileName(new Date(2026, 10, 16, 23, 30))).toBe('quran-alsalaf-backup-2026-11-16.json');
  });
});

describe('الحفظ ثم الاستعادة على جهاز آخر', () => {
  it('تعود البيانات كلها كما كانت بالضبط', () => {
    seed();
    const before = snapshotKeys();
    const text = backupText(buildBackup());
    localStorage.clear();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    expect(restoreBackup(parsed.backup)).toBe(true);
    expect(snapshotKeys()).toEqual(before);
    // ويقرؤها التطبيق كما كانت
    expect(U.readBookmarks().map((b) => b.name)).toEqual(['أخطائي', 'وقفت هنا']);
    expect(U.noteOf(U.readNotes(), 9)).toEqual({ text: 'بآيتها', verse: true });
    expect(U.readRange()).toEqual([1, 7]);
    expect(readLastPage()).toBe(77);
    expect(readReadingSpeed()).toBe(12.5);
    expect(readRubAlert()).toBe(false);
  });

  it('الاستبدال كامل: ما ليس في النسخة يُمحى، وما ليس من بياناتها يبقى', () => {
    const text = backupText(buildBackup()); // نسخة من جهاز بلا بيانات
    seed();
    expect(restoreBackup(parseBackup(text).backup)).toBe(true);
    for (const k of Object.keys(BACKUP_KEYS)) expect(localStorage.getItem(k)).toBeNull();
    // سجل البحث والتحميلات خاصة بالجهاز
    expect(localStorage.getItem('hq.searchHistory')).not.toBeNull();
    expect(localStorage.getItem('hq.offline')).not.toBeNull();
  });

  it('الاستعادة لا تغيّر تاريخ آخر نسخة على هذا الجهاز', () => {
    markBackup(new Date('2026-11-01T10:00:00Z'));
    seed();
    restoreBackup(parseBackup(backupText(buildBackup())).backup);
    expect(readLastBackup()).toBe('2026-11-01T10:00:00.000Z');
  });
});

describe('التحقق من الملف', () => {
  const valid = () => ({ app: BACKUP_APP, version: 1, created: '2026-11-16T08:00:00.000Z', data: { 'hq.page': 5 } });
  const parse = (x) => parseBackup(typeof x === 'string' ? x : JSON.stringify(x));

  it('نص ليس JSON، أو ملف من تطبيق آخر، أو بلا بيانات: غير صالح', () => {
    expect(parse('ليس ملفًا')).toEqual({ ok: false, error: 'invalid' });
    expect(parse('[]')).toEqual({ ok: false, error: 'invalid' });
    expect(parse({ ...valid(), app: 'other' })).toEqual({ ok: false, error: 'invalid' });
    expect(parse({ ...valid(), data: undefined })).toEqual({ ok: false, error: 'invalid' });
    expect(parse({ ...valid(), version: '1' })).toEqual({ ok: false, error: 'invalid' });
    expect(parse({ ...valid(), created: 'أمس' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('قيمة من غير نوعها: الملف تالف فلا يُستعاد منه شيء', () => {
    expect(parse({ ...valid(), data: { 'hq.bookmarks': 'علامات' } }).ok).toBe(false);
    expect(parse({ ...valid(), data: { 'hq.page': 999 } }).ok).toBe(false);
    expect(parse({ ...valid(), data: { 'hq.riwayah': 'qalun' } }).ok).toBe(false);
    expect(parse({ ...valid(), data: { 'hq.notes': [] } }).ok).toBe(false);
  });

  it('نسخة من إصدار أحدث: رسالة التحديث', () => {
    expect(parse({ ...valid(), version: BACKUP_VERSION + 1 })).toEqual({ ok: false, error: 'newer' });
  });

  it('المفاتيح التي لا يعرفها هذا الإصدار تُترك ولا تمنع الاستعادة', () => {
    const r = parse({ ...valid(), data: { 'hq.page': 5, 'hq.tadabbur': { any: 1 } } });
    expect(r.ok).toBe(true);
    expect(r.backup.data).toEqual({ 'hq.page': 5 });
  });

  it('الملف الفاسد لا يمسّ البيانات الحالية', () => {
    seed();
    const before = snapshotKeys();
    expect(parse('{').ok).toBe(false);
    expect(snapshotKeys()).toEqual(before);
  });
});

describe('ملخّص النسخة', () => {
  it('التاريخ والرواية والأعداد', () => {
    seed();
    const s = summarizeBackup(buildBackup(new Date(2026, 10, 16, 12)));
    expect(s.riwayah).toBe('ورش عن نافع');
    expect(s.counts).toEqual({ notes: 2, bookmarks: 2, khatmas: 1 });
    expect(s.lines).toEqual(['علامتان', 'ملاحظتان', 'ختمة واحدة']);
    expect(s.date).toContain('٢٠٢٦');
    expect(s.hijri).toMatch(/هـ$/);
  });

  it('بلا بيانات: «لا علامات» وأخواتها، وبلا رواية', () => {
    const s = summarizeBackup(buildBackup());
    expect(s.lines).toEqual(['لا علامات', 'لا ملاحظات', 'لا ختمات']);
    expect(s.riwayah).toBeNull();
  });
});

describe('سطر آخر نسخة', () => {
  const now = new Date(2026, 10, 16, 9);
  it('لم تحفظ نسخة بعد', () => {
    expect(lastBackupText(null, now)).toBe('لم تحفظ نسخة بعد');
    expect(lastBackupText(undefined)).toBe('لم تحفظ نسخة بعد');
  });
  it('اليوم، أمس، والأيام بصيغة العدد', () => {
    expect(lastBackupText(new Date(2026, 10, 16, 1).toISOString(), now)).toBe('آخر نسخة: اليوم');
    expect(lastBackupText(new Date(2026, 10, 15, 23).toISOString(), now)).toBe('آخر نسخة: أمس');
    expect(lastBackupText(new Date(2026, 10, 14).toISOString(), now)).toBe('آخر نسخة: قبل يومين');
    expect(lastBackupText(new Date(2026, 10, 13).toISOString(), now)).toBe('آخر نسخة: قبل ٣ أيام');
    expect(lastBackupText(new Date(2026, 10, 1).toISOString(), now)).toBe('آخر نسخة: قبل ١٥ يوما');
  });
  it('يُحفظ تاريخ الحفظ ويُقرأ', () => {
    markBackup(new Date('2026-11-16T08:00:00Z'));
    expect(readLastBackup()).toBe('2026-11-16T08:00:00.000Z');
  });
});
