// قرّاء رواية ورش (٢٠٢٦-١١-١٥، «الروايات» الجلسة ٣): بياناتهم (src/data/reciters.json وwarsh-audio.json)،
// وملفات كل آية والبسملة (src/lib/reciters.js)، والتشغيل بالمقاطع والقارئ المختار لكل رواية (src/lib/player.js)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  allFiles,
  basmalaFile,
  HAFS_COUNTS,
  RECITERS,
  reciterById,
  reciterFor,
  recitersOf,
  verseFiles,
  WARSH_COUNTS,
  WARSH_RECITERS,
} from '../../src/lib/reciters.js';

const load = (f) => JSON.parse(readFileSync(`public/data/${f}.json`, 'utf8'));
const H = load('quran');
const W = load('warsh/quran');
const w = (s, a) => W.verses.findIndex((v) => v.s === s && v.a === a);
const h = (s, a) => H.verses.findIndex((v) => v.s === s && v.a === a);
// اسم الملف من رابطه: «مجلد/سورةآية»
const name = (url) => url.match(/\/([^/]+)\/(\d{6})\.mp3$/).slice(1).join('/');
const files = (id, s, a) => verseFiles(reciterById(id), W, w(s, a)).map(name);

describe('القرّاء الخمسة', () => {
  it('بأسمائهم وترتيبهم، مرتّلون، ولا يختلطون بقرّاء حفص', () => {
    expect(WARSH_RECITERS.map((r) => r.name)).toEqual([
      'محمود خليل الحصري',
      'عبد الباسط عبد الصمد',
      'إبراهيم الدوسري',
      'ياسين الجزائري',
      'العيون الكوشي',
    ]);
    expect(WARSH_RECITERS.every((r) => r.riwayah === 'warsh' && r.group === 'murattal')).toBe(true);
    expect(recitersOf('warsh')).toBe(WARSH_RECITERS);
    expect(recitersOf('hafs')).toBe(RECITERS);
    expect(RECITERS).toHaveLength(37);
    expect(RECITERS.some((r) => r.riwayah === 'warsh')).toBe(false);
    // عبد الكريم الدغوش مؤجَّل (تسجيله مقطوع على غير تقسيم الآيات)
    expect(WARSH_RECITERS.some((r) => r.name.includes('الدغوش'))).toBe(false);
    const ids = [...RECITERS, ...WARSH_RECITERS].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('قارئ من غير الرواية يُستبدل بقارئها الافتراضي: الشريم لحفص، والحصري لورش', () => {
    expect(reciterFor('afasy', 'hafs').id).toBe('afasy');
    expect(reciterFor('w-kouchi', 'warsh').id).toBe('w-kouchi');
    expect(reciterFor('afasy', 'warsh').id).toBe('w-husary');
    expect(reciterFor('w-kouchi', 'hafs').id).toBe('shuraym');
    expect(reciterFor(undefined, 'warsh').id).toBe('w-husary');
  });

  it('لكلٍّ حجم تقريبي، ومقطع معاينة مبني مع التطبيق («الحمد لله رب العالمين»)', () => {
    for (const r of WARSH_RECITERS) {
      expect(r.mb, r.id).toBeGreaterThan(300);
      const f = `public/audio/preview/warsh/${r.id}.mp3`;
      expect(existsSync(f), r.id).toBe(true);
      expect(statSync(f).size, r.id).toBeGreaterThan(10_000);
    }
  });

  it('عدد آيات كل سورة بالترقيمين يطابق بيانات المصحفين', () => {
    const count = (q) => q.suras.map((x) => x.count);
    expect(WARSH_COUNTS).toEqual(count(W));
    expect(HAFS_COUNTS).toEqual(count(H));
    expect(WARSH_COUNTS.reduce((a, b) => a + b)).toBe(6214);
  });
});

describe('ملفات الآيات', () => {
  it('Quranpedia: ملف لكل آية بترقيم ورش', () => {
    expect(verseFiles(reciterById('w-husary'), W, w(2, 285))).toEqual(['https://files.quranpedia.net/recitations/261/002285.mp3']);
    expect(files('w-kouchi', 1, 1)).toEqual(['265/001001']);
    expect(files('w-jazairi', 114, 6)).toEqual(['263/114006']);
  });

  it('سورة الملك مقطوعة بتقسيم حفص: آيتا ورش ٩ و١٠ في ملف واحد، و٣١ في الملف ٣٠', () => {
    for (const id of ['w-husary', 'w-abdulbasit', 'w-jazairi', 'w-kouchi']) {
      expect(files(id, 67, 9)).toEqual(files(id, 67, 10));
      expect(files(id, 67, 9)[0]).toMatch(/\/067009$/);
      expect(files(id, 67, 11)[0]).toMatch(/\/067010$/);
      expect(files(id, 67, 31)[0]).toMatch(/\/067030$/);
    }
  });

  it('الدوسري بترقيم حفص: آية ورش من آيتين ملفّان، وآيتا ورش من آية واحدة ملف واحد', () => {
    expect(files('w-dosari', 1, 1)).toEqual(['warsh_ibrahim_aldosary_128kbps/001001', 'warsh_ibrahim_aldosary_128kbps/001002']);
    expect(files('w-dosari', 2, 1)).toEqual(['warsh_ibrahim_aldosary_128kbps/002001', 'warsh_ibrahim_aldosary_128kbps/002002']);
    expect(files('w-dosari', 2, 285)).toEqual(['warsh_ibrahim_aldosary_128kbps/002286']);
    expect(files('w-dosari', 1, 6)).toEqual(files('w-dosari', 1, 7));
  });

  it('الآية في ملف التي قبلها (same وmerge): الكوشي، الفاتحة ٧ في ملف ٦', () => {
    expect(files('w-kouchi', 1, 7)).toEqual(['265/001006']);
    const k = reciterById('w-kouchi');
    expect(k.same).toContain('1:7');
    expect(k.same.length).toBeGreaterThan(50);
    for (const x of k.same) {
      const [s, a] = x.split(':').map(Number);
      expect(files('w-kouchi', s, a)).toEqual(files('w-kouchi', s, a - 1).slice(-1));
    }
  });

  it('البدائل: ملف من everyayah، أو مقطع قُطع من ملف السورة ويُبنى مع التطبيق', () => {
    expect(verseFiles(reciterById('w-abdulbasit'), W, w(9, 41))).toEqual([
      'https://everyayah.com/data/warsh/warsh_Abdul_Basit_128kbps/009041.mp3',
    ]);
    const cuts = { 'w-husary': ['16:61'], 'w-jazairi': ['22:4', '26:26', '88:26'], 'w-kouchi': ['3:140'] };
    for (const [id, list] of Object.entries(cuts)) {
      for (const x of list) {
        const [s, a] = x.split(':').map(Number);
        const [url] = verseFiles(reciterById(id), W, w(s, a));
        const path = new URL(url).pathname;
        expect(path).toBe(`/audio/warsh/${id}/${String(s).padStart(3, '0')}${String(a).padStart(3, '0')}.mp3`);
        expect(statSync(`public${path}`).size, x).toBeGreaterThan(30_000);
      }
    }
  });

  it('البسملة: ملف لكل سورة لقرّاء Quranpedia (والفاتحة معها)، والفاتحة ١:١ للدوسري، ولا بسملة قبل التوبة ولا القلم', () => {
    const b = (id, s) => {
      const u = basmalaFile(reciterById(id), W, w(s, 1));
      return u && name(u);
    };
    expect(b('w-husary', 1)).toBe('261/001000');
    expect(b('w-husary', 2)).toBe('261/002000');
    expect(b('w-kouchi', 114)).toBe('265/114000');
    expect(b('w-dosari', 2)).toBe('warsh_ibrahim_aldosary_128kbps/001001');
    expect(b('w-dosari', 1)).toBe(null); // البسملة في ملف الفاتحة ١:١ نفسه
    for (const r of WARSH_RECITERS) {
      expect(b(r.id, 9)).toBe(null);
      expect(b(r.id, 68)).toBe(null); // قرؤوها وصلًا بـ«نۤ» في ملف الآية
    }
    // وفي غير أول السورة لا بسملة
    expect(basmalaFile(reciterById('w-husary'), W, w(2, 2))).toBe(null);
  });

  it('ملفات القارئ كلها للتحميل: بلا تكرار، وفيها كل ما يُقرأ به المصحف والبسملة', () => {
    for (const r of WARSH_RECITERS) {
      const all = allFiles(r);
      expect(new Set(all).size, r.id).toBe(all.length);
      const set = new Set(all);
      for (let v = 0; v < W.verses.length; v++) {
        for (const f of verseFiles(r, W, v)) expect(set.has(f), `${r.id} ${W.verses[v].s}:${W.verses[v].a}`).toBe(true);
        const bm = basmalaFile(r, W, v);
        if (bm) expect(set.has(bm), r.id).toBe(true);
      }
    }
    expect(allFiles(reciterById('w-dosari'))).toHaveLength(6236);
    // الحصري: ٦٢١٤ آية − آية واحدة من الملك (٣٠ ملفًّا لـ٣١ آية) + ١١٣ بسملة
    expect(allFiles(reciterById('w-husary'))).toHaveLength(6214 - 1 + 113);
  });
});

// ---------- التشغيل ----------
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
    return this.attrs.src ?? '';
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

describe('التشغيل في مصحف ورش', () => {
  let P;
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    globalThis.Audio = FakeAudio;
    window.Audio = FakeAudio;
    P = await import('../../src/lib/player.js');
  });
  const ended = () => FakeAudio.last.dispatchEvent(new Event('ended'));
  const last = () => name(FakeAudio.srcs.at(-1));
  const label = (vs) => vs.map((v) => `${W.verses[v].s}:${W.verses[v].a}`);

  it('القارئ الافتراضي في ورش الحصري، وفي حفص الشريم، ولكل رواية قارئها المختار', () => {
    expect(P.chosenReciter(W).id).toBe('w-husary');
    expect(P.chosenReciter(H).id).toBe('shuraym');
    expect(P.reciterKey(W)).toBe('warshReciter');
    expect(P.reciterKey(H)).toBe('reciter');
    P.setSettings({ warshReciter: 'w-kouchi' });
    expect(P.chosenReciter(W).id).toBe('w-kouchi');
    expect(P.chosenReciter(H).id).toBe('shuraym');
    P.setSettings({ reciter: 'afasy' });
    expect(P.chosenReciter(W).id).toBe('w-kouchi');
    expect(JSON.parse(localStorage.getItem('hq.listen'))).toMatchObject({ reciter: 'afasy', warshReciter: 'w-kouchi' });
  });

  it('يقرأ بقارئ ورش: البسملة ثم الآيات، ويظلّل آيات المقطع', () => {
    P.play(W, [w(2, 1), w(2, 2)]);
    expect(last()).toBe('261/002000');
    expect(label(P.playerState().vs)).toEqual(['2:1']);
    ended();
    expect(last()).toBe('261/002001');
    ended();
    expect(last()).toBe('261/002002');
    expect(label(P.playerState().vs)).toEqual(['2:2']);
    ended();
    expect(P.playerState().status).toBe('idle');
  });

  it('آيتان في ملف واحد تُقرآن مرة وتُظلَّلان معًا (الملك ٩ و١٠)', () => {
    P.play(W, [w(67, 8), w(67, 9), w(67, 10), w(67, 11)]);
    expect(last()).toBe('261/067008');
    ended();
    expect(last()).toBe('261/067009');
    expect(label(P.playerState().vs)).toEqual(['67:9', '67:10']);
    ended();
    expect(last()).toBe('261/067010');
    expect(label(P.playerState().vs)).toEqual(['67:11']);
  });

  it('تشغيل آية وحدها في ملف معه جارتها: تُظلَّل الجارة معها (الملك ٩ ⇐ ٩ و١٠، والكوشي الفاتحة ٧ ⇐ ٦ و٧)', () => {
    P.play(W, [w(67, 9)]);
    expect(last()).toBe('261/067009');
    expect(label(P.playerState().vs)).toEqual(['67:9', '67:10']);
    P.play(W, [w(67, 10)]);
    expect(last()).toBe('261/067009');
    expect(label(P.playerState().vs)).toEqual(['67:9', '67:10']);
    P.setSettings({ warshReciter: 'w-kouchi' });
    P.play(W, [w(1, 7)]);
    expect(last()).toBe('265/001006');
    expect(label(P.playerState().vs)).toEqual(['1:6', '1:7']);
    // ولا يمتد إلى ما لا يشاركه ملفه
    P.play(W, [w(1, 5)]);
    expect(label(P.playerState().vs)).toEqual(['1:5']);
  });

  it('آية في ملفين تُقرأ بهما متتاليين (الدوسري، البقرة ١ = الم + ذلك الكتاب)، وتكرار الآية يعيدهما', () => {
    P.setSettings({ warshReciter: 'w-dosari', verseRepeat: 2 });
    P.play(W, [w(2, 1)]);
    const seq = [last()];
    for (let i = 0; i < 8 && P.playerState().status !== 'idle'; i++) {
      ended();
      if (P.playerState().status !== 'idle') seq.push(last());
    }
    const d = (x) => `warsh_ibrahim_aldosary_128kbps/${x}`;
    expect(seq).toEqual([d('001001'), d('002001'), d('002002'), d('002001'), d('002002')]);
    expect(label(P.playerState().vs ?? [])).toEqual([]);
  });

  it('تغيير قارئ ورش أثناء التشغيل يعيد الآية الجارية بصوته، ولا يمسّ قارئ حفص', () => {
    P.play(W, [w(1, 2), w(1, 3)]);
    expect(last()).toBe('261/001002');
    expect(P.setSettings({ warshReciter: 'w-jazairi' })).toBe(true);
    expect(last()).toBe('263/001002');
    expect(P.playerState().settings.reciter).toBe('shuraym');
    // تغيير قارئ حفص لا يقطع تلاوة ورش
    const n = FakeAudio.srcs.length;
    P.setSettings({ reciter: 'afasy' });
    expect(FakeAudio.srcs.length).toBe(n);
  });

  it('معاينة قارئ ورش من مقطعه المبني مع التطبيق', () => {
    P.previewReciter('w-kouchi');
    expect(FakeAudio.last.src).toBe('/audio/preview/warsh/w-kouchi.mp3');
  });
});
