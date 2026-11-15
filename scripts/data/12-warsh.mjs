// الخطوة ١٢: مصحف المدينة برواية ورش عن نافع (٢٠٢٦-١١-١٥، «الروايات» الجلسة ١)
//
// يُبنى بالبنية نفسها التي بُني بها مصحف حفص (quran.json وqcf4.json، الخطوتان ٢ و٥)، فيعرضه التطبيق
// بالمكوّنات نفسها: ٦٠٤ صفحات، ١٥ سطرًا، كل كلمة رمز من خط صفحتها مرسوم بيد الخطّاط بمدّاته.
//
// المصادر الثلاثة كلها من مجمع الملك فهد لطباعة المصحف الشريف (عن نسختين منقولتين على GitHub مثبتتين
// بإيداع محدد، لأن موقع المجمع لم يكن متاحًا من بيئة البناء؛ وبصمة كل ملف نصّي مكتوبة أدناه):
//   ١. بيانات ورش (warshData_v10): نص كل آية، وصفحتها، وسطر بدايتها ونهايتها — ٦٢١٤ آية بعدّ المدني الأول
//   ٢. ملف وورد مصحف ورش (UthmanicWarsh V21): النص مقسومًا على صفحات المطبوع وأسطره — منه يُعرف سطر كل كلمة
//   ٣. خطوط صفحات ورش (QCF4 Warsh، الإصدار الرابع): ٥٠ خطًّا، في كل منها رموز كلمات نحو ١٢ صفحة
//
// ربط الكلمة برمزها: رموز كل خط مرتبة بترتيب القراءة صفحةً بعد صفحة، وليس فيها ما يدل على الكلمة. فتُقرأ
// كلمات ملف الوورد بالترتيب ويأخذ كل منها الرمز التالي: الكلمة رمز، ورقم الآية رمز، وعلامة الربع ۞ رمز؛
// وعلامات الوقف والسجدة رموز مستقلة بلا عرض (أو بعرض ضئيل) تتبع الكلمة التي قبلها. وبعد آخر صفحة في الخط حشو بلا عرض،
// ثم رموز عامة مشتركة بين الخطوط (COMMON_TAIL)، فيُنتقل إلى الخط التالي.
//
// والتحقق مستقل عن الربط: (أ) نهاية كل آية في صفحتها وسطرها من ملف الوورد تطابق بيانات المجمع (١)؛
// (ب) أسطر الخطّاط الكاملة في كل صفحة متساوية العرض، فلو انزاح رمز واحد اختلّت أسطر الصفحة كلها؛
// (ج) رمز رقم الآية بعرض ثابت، ولا تقع كلمة على رمز بلا عرض.
//
// المخرجات:
//   public/data/warsh/quran.json      المصحف: suras، verses، pages، وqcf (بنية qcf4.json نفسها)
//   public/fonts/qcf4-warsh/p{N}.woff2 خط كل صفحة (ما يلزمها وحدها من خطّها)، يُنزَّل عند فتحها
//   public/fonts/warsh-basmala.woff2   خط المجمع العام لورش، بحروف البسملة وحدها (ليست في خطوط الصفحات)
//
// يُحفظ كل ما يُنزَّل في .cache/warsh، فإعادة التشغيل لا تعيد التنزيل.
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';
import JSZip from 'jszip';

const CACHE = '.cache/warsh';
const OUT_DIR = 'public/data/warsh';
const OUT = `${OUT_DIR}/quran.json`;
const FONTS_OUT = 'public/fonts/qcf4-warsh';
const HAFS = 'public/data/quran.json';
const HAFS_QCF = 'public/data/qcf4.json';

const KF = 'https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/281dbbe8eed1370daa5a023b6cd81655cbfd6473';
const QPC = 'https://raw.githubusercontent.com/nuqayah/qpc-fonts/8a4f39d563ea69c994416a1692827e38156c548d';
const SOURCES = {
  data: { url: `${KF}/warsh/data/warshData_v10.json`, sha256: 'f05d0dc6' },
  docx: { url: `${QPC}/text-mushafs/UthmanicWarsh_V21/UthmanicWarsh%20V21.docx` },
  text: { url: `${QPC}/text-mushafs/UthmanicWarsh_V21/UthmanicWarsh%20V21.ttf` },
};
const PAGE_FONT = (n) => `${QPC}/mushaf-v4-warsh/QCF4_Warsh_${String(n).padStart(2, '0')}_W.ttf`;
const FONT_COUNT = 50;
const COMMON_TAIL = 85;
// رموز العلامات بلا عرض أو بعرض ضئيل (١ أو ١٣ وحدة من ٢٥٠٠)، وأضيق كلمة أعرض من ألف وحدة
const isMark = (w) => w < 50;
// رمز رقم الآية بعرض واحد في الخطوط كلها (em واحد)
const MARK_W = 2500;
const NARROW_MARK_W = 2150;
const NARROW_MARK_COST = 0.25;
const SPLIT_COST = 1;
// وقد يقع عرض كلمة على عرض رقم الآية اتفاقًا، أو يُرسم رقم بعرض آخر: يُقبل كلاهما بكلفة عالية
const MARKER_AS_WORD = 5;
// أكبر كلفة مقبولة لربط خط واحد (بضع كلمات مرسومة برمزين أو بعرض رقم الآية)؛ وما زاد فالربط خطأ
const MAX_FONT_COST = 30;
// السطر الموسّط (آخر السورة) دون ٩٣٪ من أعرض سطر في صفحته (كما في src/lib/layout.js)، والأسطر الكاملة
// متقاربة العرض: الفرق بين أعرضها وأضيقها في الصفحة دون ٦٪
const SHORT_FILL = 0.93;
const WIDTH_SPREAD = 0.06;
// سطر يزيد أو ينقص عن أسطر صفحته بأكثر من ٤٪ ففيه رمز ليس منه
const LINE_TOLERANCE = 0.04;

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(url, file) {
  if (!(await exists(file))) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        break;
      } catch (err) {
        if (attempt === 5) throw new Error(`${url}: ${err.message}`);
        await sleep(600 * 2 ** attempt);
      }
    }
  }
  return readFile(file);
}

// ---------- ملف الوورد: صفحات وأسطر ----------
// السطر ينتهي بنهاية الفقرة أو بفاصل سطر، والصفحة بفاصل صفحة. وتُحذف علامة الاتجاه (U+200F، في «يَٰٓأَيُّهَا اَ۬لنَّبِے»)
export async function docxPages(buf) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const body = xml.slice(xml.indexOf('<w:body>'));
  const re = /<w:p[ >]|<\/w:p>|<w:br w:type="page"\/>|<w:br\/>|<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
  const pages = [[]];
  let line = '';
  const endLine = () => {
    pages.at(-1).push(line);
    line = '';
  };
  for (let m; (m = re.exec(body)); ) {
    const s = m[0];
    if (s.startsWith('<w:t')) line += m[1];
    else if (s === '</w:p>' || s === '<w:br/>') endLine();
    else if (s.includes('type="page"')) {
      endLine();
      pages.push([]);
    }
  }
  endLine();
  const unescape = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return pages
    .map((p) => p.map((l) => unescape(l).replace(/\u200f/g, '')).filter((l) => l.trim()))
    .filter((p) => p.length);
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (s) => Number([...s].map((c) => AR_DIGITS.indexOf(c)).join(''));
const IS_NUM = /^[٠-٩]+$/;
const RUB = '۞';
const SURA_LINE = /^سُورَةُ /;
// بسم الله الرحمن الرحيم كما في ملف الوورد (مكتوبة برموزها: ترتيب الشدة والفتحة فيها يغيّره المحرّر)
export const BASMALA = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0650\u06EC\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0650\u06EC\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0650\u06EC\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
const BASMALA_LINE = new RegExp(`^${BASMALA}\u06D6?$`);

// كلمات سطر من ملف الوورد بالترتيب (والفاصل بين الكلمة ورقم آيتها مسافة لا تنكسر).
// ورقم الآية ملتصق بآخر كلمة في موضع واحد (النحل ١٢٣؛ أصلحه المجمع في بيانات ورش لا في ملف الوورد)
export const splitWords = (text) =>
  text
    .replace(/([^\s\u00a0٠-٩])([٠-٩]+)/g, '$1 $2')
    .replace(/\u00a0/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

// النص الإملائي للبحث: بلا تشكيل ولا علامات ضبط ولا وقف (ويكمل src/lib/search.js تطبيعه)
export const plain = (words) =>
  words
    .join(' ')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/ے/g, 'ي') // ے ← ي
    .replace(/ٱ/g, 'ا') // ٱ ← ا
    .replace(/\s+/g, ' ')
    .trim();

// ---------- البناء ----------
async function main() {
  await mkdir(`${CACHE}/fonts`, { recursive: true });
  console.log('تنزيل بيانات ورش وملف الوورد والخطوط…');
  const dataBuf = await download(SOURCES.data.url, `${CACHE}/warshData_v10.json`);
  if (!sha256(dataBuf).startsWith(SOURCES.data.sha256)) throw new Error('بصمة بيانات ورش لا توافق المتوقَّع');
  const data = JSON.parse(dataBuf.toString('utf8'));
  const pagesText = await docxPages(await download(SOURCES.docx.url, `${CACHE}/UthmanicWarsh_V21.docx`));
  const textFont = await download(SOURCES.text.url, `${CACHE}/UthmanicWarsh_V21.ttf`);
  const fontBufs = [];
  for (let n = 1; n <= FONT_COUNT; n++) fontBufs.push(await download(PAGE_FONT(n), `${CACHE}/fonts/${n}.ttf`));

  const hafs = JSON.parse(await readFile(HAFS, 'utf8'));
  const hafsQcf = JSON.parse(await readFile(HAFS_QCF, 'utf8'));
  if (pagesText.length !== 604) throw new Error(`عدد صفحات ملف الوورد ${pagesText.length} لا ٦٠٤`);
  if (data.length !== 6214) throw new Error(`عدد آيات ورش ${data.length} لا ٦٢١٤`);

  // الخطوط: رموزها بترتيب نقاطها، مجموعةً «وحدات»: رمز بعرض ومعه ما يتبعه من رموز العلامات (بلا عرض).
  // ونهاية رموز الصفحات أول حشو (٦ رموز متتالية بعرض صفر تمامًا)، وبعده رموز عامة مشتركة (COMMON_TAIL)
  const fonts = fontBufs.map((buf) => {
    const f = fontkit.create(buf);
    const codes = f.characterSet.filter((c) => c >= 0xf100 && c < 0xffff).sort((a, b) => a - b);
    const widths = codes.map((c) => f.glyphForCodePoint(c).advanceWidth);
    let end = codes.length - COMMON_TAIL;
    for (let i = 0; i + 6 <= end; i++) {
      if (widths.slice(i, i + 6).every((w) => w === 0)) {
        end = i;
        break;
      }
    }
    const units = [];
    for (let i = 0; i < end; i++) {
      if (isMark(widths[i])) {
        if (!units.length) throw new Error('خط يبدأ برمز علامة');
        units.at(-1).codes.push(codes[i]);
        units.at(-1).w += widths[i];
      } else units.push({ codes: [codes[i]], w: widths[i] });
    }
    return { buf, upm: f.unitsPerEm, units };
  });

  // أسطر الوورد: عنوان سورة، أو بسملة، أو أسطر نصّ بكلماتها
  const report = { ayahEnds: 0, endMismatch: [], widthOff: [], splits: 0, merges: 0, fontCosts: [], moved: [], suraLines: 0, basmalaLines: 0 };
  const docLines = []; // { p, li, kind: 'h'|'b'|'t', sura, toks: [رقم الكلمة في tokens] }
  const tokens = []; // { tok, kind: 'num'|'rub'|'word', sajda, p, line: رقم السطر في docLines, units: [] }
  const pageEndToken = []; // صفحة ← عدد الكلمات حتى آخرها
  let sura = 0;
  pagesText.forEach((lines, pi) => {
    lines.forEach((raw, li) => {
      const text = raw.trim();
      if (SURA_LINE.test(text)) {
        sura++;
        report.suraLines++;
        docLines.push({ p: pi + 1, li, kind: 'h', sura });
      } else if (BASMALA_LINE.test(text)) {
        report.basmalaLines++;
        docLines.push({ p: pi + 1, li, kind: 'b', sura });
      } else {
        const line = { p: pi + 1, li, kind: 't', toks: [] };
        for (const tok of splitWords(text)) {
          line.toks.push(tokens.length);
          const kind = IS_NUM.test(tok) ? 'num' : tok === RUB ? 'rub' : 'word';
          tokens.push({ tok, kind, sajda: tok.includes('۩'), line: docLines.length, units: [] });
        }
        docLines.push(line);
      }
    });
    pageEndToken.push(tokens.length);
  });

  // ربط الكلمات بالوحدات، خطًّا خطًّا، بمحاذاة تسلسلين (برمجة ديناميكية): رقم الآية يقابل رمز رقم الآية
  // وحده (وعرضه ثابت MARK_W)، وما سواه يقابل غيره. والأصل كلمة لوحدة، وفي الخطوط كلمات قليلة مرسومة
  // برمزين («لَّوْمَا») أو كلمتان برمز، فلكلٍّ منهما كلفة، ويُختار أقل الربط كلفة. وعلامة السجدة ۩ وحدة
  // مستقلة بعد كلمتها. وينتهي كل خط عند آخر صفحة فيه، فيُختار من نهايات الصفحات ما تنتهي عنده الوحدات
  const pageFont = [];
  let ti = 0;
  let page = 1;
  for (let fi = 0; fi < fonts.length; fi++) {
    const U = fonts[fi].units;
    const lastPage = Math.min(604, page + 20);
    const T = tokens.slice(ti, pageEndToken[lastPage - 1]);
    const L = T.length;
    const W = U.length + 1;
    const INF = 1e9;
    const cost = new Float64Array((L + 1) * W).fill(INF);
    const back = new Int32Array((L + 1) * W); // (كم كلمة، كم وحدة) مضغوطان
    cost[0] = 0;
    const isMarker = (j) => U[j].w === MARK_W;
    const relax = (i, j, di, dj, c) => {
      const to = (i + di) * W + j + dj;
      const nc = cost[i * W + j] + c;
      if (nc < cost[to]) {
        cost[to] = nc;
        back[to] = di * 16 + dj;
      }
    };
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < U.length; j++) {
        if (cost[i * W + j] >= INF) continue;
        const t = T[i];
        if (t.kind === 'num') {
          // وفي قصار السور (الخطوط ٤٧–٥٠) يضيق رقم الآية في الأسطر المزدحمة (٢٢٢٩–٢٣٧٠ وحدة)، فيُقبل بكلفة يسيرة؛
          // وبغير ذلك من العروض بكلفة عالية
          const w = U[j].w;
          relax(i, j, 1, 1, isMarker(j) ? 0 : w >= NARROW_MARK_W && w < MARK_W ? NARROW_MARK_COST : MARKER_AS_WORD);
          continue;
        }
        const mk = (jj) => (isMarker(jj) ? MARKER_AS_WORD : 0);
        if (t.kind === 'rub') {
          relax(i, j, 1, 1, mk(j));
          continue;
        }
        // كلمة: وحدة أو اثنتان أو ثلاث (والسجدة وحدة زائدة بلا كلفة)
        const base = t.sajda ? 1 : 0;
        let extra = 0;
        for (let n = 1; n <= 3 + base && j + n <= U.length; n++) {
          extra += mk(j + n - 1);
          relax(i, j, 1, n, Math.abs(n - 1 - base) * SPLIT_COST + extra);
        }
        // كلمتان في سطر واحد بوحدة واحدة
        const u = T[i + 1];
        if (u && u.kind === 'word' && !t.sajda && !u.sajda && u.line === t.line) relax(i, j, 2, 1, SPLIT_COST + mk(j));
      }
    }
    // نهاية الخط: نهاية صفحة استُنفدت عندها الوحدات كلها، بأقل كلفة
    let best = null;
    for (let pg = page; pg <= lastPage; pg++) {
      const e = pageEndToken[pg - 1] - ti;
      const c = cost[e * W + U.length];
      if (c < INF && (!best || c < best.c)) best = { pg, e, c };
    }
    if (!best || best.c > MAX_FONT_COST) {
      let reach = 0;
      for (let i = 0; i <= L; i++) for (let j = 0; j <= U.length; j++) if (cost[i * W + j] < INF) reach = Math.max(reach, i);
      const t = T[Math.min(reach, L - 1)];
      if (process.env.WARSH_DEBUG) {
        const js = [];
        for (let j = 0; j <= U.length; j++) if (cost[reach * W + j] < INF) js.push(j);
        console.log('reach', reach, 'units', js.join(','));
        console.log(T.slice(reach - 12, reach + 3).map((x) => x.tok).join(' '));
        console.log(U.slice(js[0] - 14, js.at(-1) + 6).map((u) => u.w).join(' '));
      }
      throw new Error(`تعذّر ربط كلمات الخط ${fi + 1} (من الصفحة ${page})، وأبعد كلمة: «${t.tok}» صفحة ${docLines[t.line].p} سطر ${docLines[t.line].li + 1}`);
    }
    // تتبّع الربط إلى أوله
    for (let i = best.e, j = U.length; i > 0 || j > 0; ) {
      const b = back[i * W + j];
      const di = Math.floor(b / 16);
      const dj = b % 16;
      const t = T[i - di];
      t.units = U.slice(j - dj, j);
      if (di === 2) report.merges++;
      else if (dj > 1 + (t.sajda ? 1 : 0)) report.splits++;
      i -= di;
      j -= dj;
    }
    if (best.c) report.fontCosts.push(`${fi + 1}:${best.c}`);
    for (let pg = page; pg <= best.pg; pg++) pageFont.push(fi);
    ti += best.e;
    page = best.pg + 1;
  }
  if (page !== 605 || ti !== tokens.length) throw new Error(`انتهت الخطوط عند الصفحة ${page - 1}`);

  // ---------- المصحف بأسطره ----------
  const verses = data.map((d) => ({ s: d.sura_no, a: d.aya_no, p: 0, j: d.jozz, t: [], e: '' }));
  const pages = Array.from({ length: 604 }, () => []);
  const qcfPages = Array.from({ length: 604 }, () => []);
  let vi = 0;
  let widest = 0;
  for (const line of docLines) {
    const { p, li } = line;
    if (line.kind !== 't') {
      pages[p - 1].push(line.kind === 'h' ? { h: line.sura } : { b: line.sura });
      qcfPages[p - 1].push(null);
      continue;
    }
    const g = [];
    const k = [];
    let units = 0;
    for (const n of line.toks) {
      const { tok, units: us } = tokens[n];
      const v = verses[vi];
      if (!v) throw new Error(`كلمة بعد آخر آية: صفحة ${p}`);
      const idx = v.t.length;
      v.t.push(tok);
      v.p ||= p;
      if (g.at(-1)?.[0] === vi) g.at(-1)[2] = idx;
      else g.push([vi, idx, idx]);
      for (const u of us) {
        k.push([vi, String.fromCodePoint(...u.codes)]);
        units += u.w;
      }
      if (IS_NUM.test(tok)) {
        // التحقق (أ): نهاية الآية برقمها في صفحتها وسطرها كما في بيانات المجمع
        const d = data[vi];
        const dataPage = Number(String(d.page).split(/\D/).at(-1));
        report.ayahEnds++;
        if (arNum(tok) !== d.aya_no || dataPage !== p || d.line_end !== li + 1) {
          report.endMismatch.push(`${d.sura_no}:${d.aya_no} (${p}:${li + 1} ≠ ${d.page}:${d.line_end})`);
        }
        v.e = plain(v.t.slice(0, -1));
        vi++;
      }
    }
    pages[p - 1].push({ g });
    qcfPages[p - 1].push({ w: Math.round((units / fonts[pageFont[p - 1]].upm) * 1000) / 1000, k });
  }
  if (vi !== verses.length) throw new Error(`قُرئت ${vi} آية من ${verses.length}`);
  // إصلاح موضع الكلمة المرسومة برمزين (أو الرمز الجامع لكلمتين) عند فاصل السطر: الربط لا يعرف أي كلمة
  // من الآية هي المقسومة، فإن وقعت في سطر غير سطرها طال سطر وقصر الذي يجاوره بقدر رمز. فيُنقل الرمز
  // الذي على الفاصل إلى السطر المجاور إن كان من الآية نفسها وصار السطران به بعرض أسطر الصفحة
  const median = (xs) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const em = (u, p) => u / fonts[pageFont[p - 1]].upm;
  const unitW = (p, code) => {
    const f = fontkit.create(fonts[pageFont[p - 1]].buf);
    return [...code].reduce((sum, ch) => sum + f.glyphForCodePoint(ch.codePointAt(0)).advanceWidth, 0);
  };
  qcfPages.forEach((lines, i) => {
    const p = i + 1;
    if (p <= 2) return;
    const target = median(lines.filter(Boolean).map((l) => l.w));
    const near = (w) => Math.abs(w - target) / target < LINE_TOLERANCE;
    for (let n = 0; n + 1 < lines.length; n++) {
      const [a, b] = [lines[n], lines[n + 1]];
      if (!a || !b || (near(a.w) && near(b.w))) continue;
      const moves = [
        () => (a.k.at(-1)[0] === b.k[0][0] ? ['down', a.k.at(-1)] : null),
        () => (b.k[0][0] === a.k.at(-1)[0] ? ['up', b.k[0]] : null),
      ];
      for (const m of moves) {
        const r = m();
        if (!r) continue;
        const w = Math.round(em(unitW(p, r[1][1]), p) * 1000) / 1000;
        const [na, nb] = r[0] === 'down' ? [a.w - w, b.w + w] : [a.w + w, b.w - w];
        if (near(na) && near(nb)) {
          if (r[0] === 'down') b.k.unshift(a.k.pop());
          else a.k.push(b.k.shift());
          a.w = Math.round(na * 1000) / 1000;
          b.w = Math.round(nb * 1000) / 1000;
          report.moved.push(`${p}:${n + 1}`);
          break;
        }
      }
    }
  });

  // التحقق (ب): لا يطول سطر عن أسطر صفحته الكاملة، والأسطر الكاملة متقاربة العرض (من الصفحة ٣؛ الأوليان
  // موسّطتان). والأسطر الأقصر من غيرها أواخر السور وحدها، فلا تُعدّ
  qcfPages.forEach((lines, i) => {
    if (i < 2) return;
    const ws = lines.filter(Boolean).map((l) => l.w);
    const max = Math.max(...ws);
    const full = ws.filter((w) => w >= SHORT_FILL * max);
    const mid = median(full);
    const min = Math.min(...full);
    if (max > mid * (1 + LINE_TOLERANCE) || (max - min) / max > WIDTH_SPREAD) report.widthOff.push(`${i + 1} (${min}–${max})`);
    widest = Math.max(widest, max);
  });

  // ---------- السور: الاسم والنزول كحفص، والعدد بعدّ ورش ----------
  const suras = hafs.suras.map((s) => {
    const first = verses.findIndex((v) => v.s === s.n);
    return { ...s, count: verses.filter((v) => v.s === s.n).length, page: verses[first].p };
  });

  // ---------- الكتابة ----------
  // WARSH_SKIP_FONTS=1: البيانات وحدها بلا إعادة كتابة الخطوط (أسرع عند تعديل الربط)
  if (!process.env.WARSH_SKIP_FONTS) await rm(FONTS_OUT, { recursive: true, force: true });
  await mkdir(FONTS_OUT, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  let fontBytes = 0;
  for (let p = 1; p <= 604 && !process.env.WARSH_SKIP_FONTS; p++) {
    const chars = [...new Set(qcfPages[p - 1].filter(Boolean).flatMap((l) => [...l.k.map((x) => x[1]).join('')]))].join('');
    const woff2 = await subsetFont(fonts[pageFont[p - 1]].buf, chars, { targetFormat: 'woff2' });
    fontBytes += woff2.length;
    await writeFile(`${FONTS_OUT}/p${p}.woff2`, woff2);
  }
  const basmala = await subsetFont(textFont, BASMALA, { targetFormat: 'woff2' });
  await writeFile('public/fonts/warsh-basmala.woff2', basmala);

  const out = {
    riwayah: 'warsh',
    v: 1,
    source: 'مجمع الملك فهد لطباعة المصحف الشريف — مصحف المدينة برواية ورش (warshData_v10، UthmanicWarsh V21، خطوط QCF4 Warsh)',
    suras,
    verses,
    pages,
    rubs: [],
    qcf: {
      widest: Math.round(widest * 1000) / 1000,
      headerEm: hafsQcf.headerEm,
      header: hafsQcf.header,
      // البسملة ليست في خطوط الصفحات: تُكتب نصًّا بخط المجمع العام لورش (public/fonts/warsh-basmala.woff2)
      basmala: null,
      basmalaText: BASMALA,
      pages: qcfPages,
    },
  };
  const json = JSON.stringify(out);
  await writeFile(OUT, json);

  // ---------- التقرير ----------
  console.log('═══ تقرير مصحف ورش ═══');
  console.log(`الآيات: ${verses.length} · نهايات الآيات المطابقة لبيانات المجمع: ${report.ayahEnds - report.endMismatch.length}/${report.ayahEnds}`);
  console.log(`لا تطابق: ${report.endMismatch.length}  ${report.endMismatch.slice(0, 10).join(' ')}`);
  console.log(`صفحات أسطرها الكاملة غير متساوية العرض: ${report.widthOff.length}  ${report.widthOff.slice(0, 10).join(' ')}`);
  console.log(`كلمات مرسومة برمزين أو أكثر: ${report.splits} · كلمتان برمز: ${report.merges} · كلفة الربط (خط:كلفة): ${report.fontCosts.join(' ')}`);
  console.log(`رموز نُقلت إلى السطر المجاور: ${report.moved.length}  ${report.moved.join(' ')}`);
  console.log(`عناوين السور: ${report.suraLines} · البسملات: ${report.basmalaLines} · أعرض سطر: ${out.qcf.widest}em`);
  console.log(`الخطوط المستعملة: ${new Set(pageFont).size}/${FONT_COUNT} · خطوط الصفحات ${(fontBytes / 1048576).toFixed(1)} م.ب · ${OUT} ${(json.length / 1048576).toFixed(2)} م.ب`);
  const bad =
    report.endMismatch.length || report.widthOff.length ||
    report.suraLines !== 114 || report.basmalaLines !== 113 || new Set(pageFont).size !== FONT_COUNT;
  if (bad) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
