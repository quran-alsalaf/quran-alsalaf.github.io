// تحميل التفاسير الكبيرة بزرّ (src/lib/tafsirDownload.js، ٢٠٢٦-١١-١٥): ملفاتها وحجمها، والتحميل
// والإيقاف والاستئناف، واستقلاله عن تحميل القرّاء، ولا يُختار التفسير قبل اكتماله — بذاكرة وشبكة محاكاتين
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAFSIR_SOURCES } from '../../src/data/tafsirs.js';

const QURAN = JSON.parse(readFileSync('public/data/quran.json', 'utf8'));
const DOWNLOADABLE = TAFSIR_SOURCES.filter((s) => s.bytes).map((s) => s.id);
// ملف السورة من المستودع لرابطه في التطبيق (…/data/tafsir/{id}/{س}.json)
const fileOf = (url) => `public/${new URL(url).pathname.replace(/^\/+/, '')}`;

function fakeCaches() {
  const store = new Map();
  const api = {
    store,
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      return {
        async put(url, res) {
          m.set(String(url), await res.text());
        },
        async keys() {
          return [...m.keys()].map((url) => ({ url }));
        },
      };
    },
    async has(name) {
      return store.has(name);
    },
    async delete(name) {
      return store.delete(name);
    },
    async match(url, { cacheName }) {
      const text = store.get(cacheName)?.get(url);
      return text === undefined ? undefined : new Response(text);
    },
  };
  return api;
}

let T;
let C;
let fetched;
let fetchImpl;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  C = fakeCaches();
  globalThis.caches = C;
  fetched = [];
  fetchImpl = async (url) =>
    /\/data\/tafsir\//.test(url) ? new Response(readFileSync(fileOf(url), 'utf8')) : new Response(new Blob(['mp3']));
  globalThis.fetch = vi.fn((url, opts) => {
    fetched.push(url);
    return fetchImpl(url, opts);
  });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  T = await import('../../src/lib/tafsirDownload.js');
});

describe('ملفات التفاسير التي تُحمَّل بزرّ', () => {
  it('السعدي والبغوي يُحمَّلان بزرّ، والميسّر والمختصر مبنيان مع التطبيق', () => {
    expect(DOWNLOADABLE).toEqual(['saadi', 'baghawy']);
  });

  it.each(DOWNLOADABLE)('%s: ١١٤ ملفًّا، آياتها بعدد آيات كل سورة، وحجمها المكتوب يطابق مجموع الملفات', (id) => {
    const dir = `public/data/tafsir/${id}`;
    const files = readdirSync(dir);
    expect(files).toHaveLength(114);
    const counts = Array(114).fill(0);
    for (const v of QURAN.verses) counts[v.s - 1]++;
    let bytes = 0;
    for (let s = 1; s <= 114; s++) {
      const { verses } = JSON.parse(readFileSync(`${dir}/${s}.json`, 'utf8'));
      expect(verses, `${id} ${s}`).toHaveLength(counts[s - 1]);
      bytes += statSync(`${dir}/${s}.json`).size;
    }
    expect(TAFSIR_SOURCES.find((s) => s.id === id).bytes).toBe(bytes);
  });

  it('روابط الملفات: سورة لكل رابط بترتيب المصحف', () => {
    const urls = T.tafsirUrls('baghawy');
    expect(urls).toHaveLength(114);
    expect(new Set(urls).size).toBe(114);
    expect(urls[0]).toMatch(/\/data\/tafsir\/baghawy\/1\.json$/);
    expect(urls.at(-1)).toMatch(/\/data\/tafsir\/baghawy\/114\.json$/);
  });
});

describe('التحميل', () => {
  it('قبل التحميل لا يُختار، وبعده يُقرأ من ذاكرته ويبلّغ باكتماله', async () => {
    const { onDownloadNotice } = await import('../../src/lib/downloader.js');
    const S = await import('../../src/lib/study.js');
    const notes = [];
    onDownloadNotice((t) => notes.push(t));
    S.saveTafsirSource('baghawy');
    expect(T.isTafsirReady('baghawy')).toBe(false);
    expect(T.isTafsirReady('muyassar')).toBe(true);
    expect(S.readTafsirSource()).toBe('muyassar');

    expect(await T.startTafsirDownload('baghawy')).toBe('done');
    expect(fetched).toHaveLength(114);
    expect(C.store.get('tafsir-baghawy').size).toBe(114);
    expect(T.tafsirDownloads().items.baghawy).toEqual({ status: 'done', count: 114, total: 114 });
    expect(JSON.parse(localStorage.getItem('hq.tafsirDownloads')).baghawy.status).toBe('done');
    expect(notes.at(-1)).toMatch(/اكتمل تحميل تفسير البغوي/);
    expect(T.isTafsirReady('baghawy')).toBe(true);
    expect(S.readTafsirSource()).toBe('baghawy');

    // يُقرأ من الذاكرة بلا شبكة: آيات المصحف كلها بترتيبها
    fetched = [];
    const t = await S.loadTafsir('baghawy');
    expect(fetched).toHaveLength(0);
    expect(t.verses).toHaveLength(QURAN.verses.length);
    const first = JSON.parse(readFileSync('public/data/tafsir/baghawy/1.json', 'utf8')).verses;
    expect(t.verses.slice(0, 7)).toEqual(first);
  });

  it('الإيقاف المؤقت يُبقي ما حُمِّل، والاستئناف يكمل الناقص وحده', async () => {
    let n = 0;
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const real = fetchImpl;
    fetchImpl = async (url, opts) => {
      if (++n > 20) {
        await Promise.race([
          gate,
          new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')))),
        ]);
      }
      return real(url);
    };
    const running = T.startTafsirDownload('saadi');
    await vi.waitFor(() => expect(T.tafsirDownloads().items.saadi.count).toBe(20));
    expect(T.tafsirDownloads().items.saadi.status).toBe('downloading');
    T.pauseTafsirDownload();
    expect(await running).toBe('paused');
    release();
    expect(T.tafsirDownloads().items.saadi).toMatchObject({ status: 'paused', count: 20 });
    expect(T.isTafsirReady('saadi')).toBe(false);

    fetched = [];
    fetchImpl = real;
    expect(await T.startTafsirDownload('saadi')).toBe('done');
    expect(fetched).toHaveLength(114 - 20);
  });

  it('تفسير واحد في كل مرة، لكنه مستقل عن تحميل صوت القارئ', async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const real = fetchImpl;
    fetchImpl = async (url) => {
      if (/everyayah/.test(url)) await gate;
      return real(url);
    };
    const O = await import('../../src/lib/offline.js');
    const reciter = O.startDownload('shuraym');
    expect(O.offlineState().active).toBe('shuraym');
    // القارئ يُحمَّل، والتفسير يُحمَّل معه
    expect(await T.startTafsirDownload('baghawy')).toBe('done');
    release();
    expect(await reciter).toBe('done');

    // تفسيران معًا: الثاني مرفوض حتى ينتهي الأول
    let hold;
    const gate2 = new Promise((r) => {
      hold = r;
    });
    fetchImpl = async (url) => {
      await gate2;
      return real(url);
    };
    const first = T.startTafsirDownload('saadi');
    expect(await T.startTafsirDownload('baghawy')).toBe('busy');
    hold();
    expect(await first).toBe('done');
  });

  it('تفسير سُجِّل محمَّلًا ثم مسح المتصفح ملفاته: يرجع زرّ التحميل، والاختيار إلى الميسّر', async () => {
    localStorage.setItem('hq.tafsirDownloads', JSON.stringify({ saadi: { status: 'done', count: 114, total: 114 } }));
    localStorage.setItem('hq.tafsir', 'saadi');
    vi.resetModules();
    T = await import('../../src/lib/tafsirDownload.js');
    const S = await import('../../src/lib/study.js');
    expect(S.readTafsirSource()).toBe('saadi');
    await T.verifyTafsirDownloads();
    expect(T.tafsirDownloads().items.saadi).toBeUndefined();
    expect(T.isTafsirReady('saadi')).toBe(false);
    expect(S.readTafsirSource()).toBe('muyassar');
  });

  it('لا حذف لما حُمِّل (بطلب صاحب المشروع)', () => {
    expect(Object.keys(T).filter((k) => /delete|remove/i.test(k))).toEqual([]);
  });
});
