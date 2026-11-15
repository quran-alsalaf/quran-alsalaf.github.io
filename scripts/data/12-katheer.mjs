// الخطوة ١٢: تفسير ابن كثير («تفسير القرآن العظيم») — ٢٠٢٦-١١-١٥
//
// المصدر: مشروع المصحف الإلكتروني «آيات» بجامعة الملك سعود (quran.ksu.edu.sa)، آيةً آية بالمؤلف «katheer»
// (الجلب في scripts/data/ksu.mjs، ويُحفظ في .cache/ksu/katheer). والناتج ملف لكل سورة في
// public/data/tafsir/katheer، يحمّله المستخدم بزرّ في قائمة التفاسير (src/lib/tafsirDownload.js).
//
// وسوم النسخة:
//   <span class="t3">( … )</span> اقتباس آية (المفسَّرة أو غيرها)
//   <span class="t1">" … "</span> نصّ منقول: حديث، أو قول، أو آية من موضع آخر
//   <span class="t2">[ … ]</span> زيادة المحقق، أو عزو الآية («[ البقرة : 255 ]»)
//
// عيب النسخة: كثير من اقتباسات الآيات سقط قوسها الغالق («( الحمد لله قال : حمدني عبدي …»)، فيمتد وسم
// t3 إلى أول قوس غالق بعده ولو بعد فقرات، أو سقط قوسها الفاتح («… من ربهم وبالآخرة هم يوقنون )»).
// والإصلاح بالمصحف نفسه لا بالتخمين: تُطابَق كلمات الاقتباس بنص المصحف الإملائي (quran.json، الحقل e)،
// فيُغلق الاقتباس بعد أطول ما يطابق المصحف من أوله، ويُفتح قبل أطول ما يطابقه من آخره. وما طابق المصحف
// يُكتب بقوسي الآية ﴿…﴾ (الوسم يقول إنه آية، والمصحف يصدّقه)، وما لم يطابق يبقى بقوسيه كما في النسخة.
// والمعالجة بعدها في الشكل وحده، كالبغوي: فقرات الأصل، والفاصلة والفاصلة المنقوطة اللاتينيتان بين
// الكلمات العربية عربيتين، ولا فراغ قبل علامة الترقيم، وتوحيد المسافات.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchAll, QURAN, writeSplit } from './ksu.mjs';

const AR = '؀-ۿ';
// أقل عدد كلمات يُقبل به طرف اقتباس مكسور (كلمة واحدة تطابق المصحف كثيرًا بالمصادفة)
const MIN_WORDS = 2;

// ---------- مطابقة نص المصحف ----------

// صورة الكلمة للمقارنة: بلا تشكيل ولا علامات وقف، والهمزات والألف المقصورة والتاء المربوطة موحّدة.
// والفروق بين رسم المصحف الإملائي والنسخة: «السموات» وفيها «السماوات»، و«يمحوا» وفيها «يمحو». ولا تُحذف
// الألف كلها، لئلا تشتبه «قال» بـ«قل».
export const normWord = (w) =>
  w
    .normalize('NFC')
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/سماو/g, 'سمو')
    .replace(/وا$/, 'و')
    .replace(/ى/g, 'ي')
    // التاء المربوطة، والمفتوحة آخر الكلمة في رسم المصحف («غيابت الجب»)
    .replace(/[ةت]$/, 'ه')
    // ياء المتكلم المحذوفة في رسم المصحف («أشركتمون» وفي النسخة «أشركتموني»)
    .replace(/ني$/, 'ن')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/[^ء-ي]/g, '');

// كلمة عربية خالصة (حروف وتشكيل) بلا علامة ترقيم ملتصقة
const isWord = (t) => /^[ء-يً-ٰٟۖ-ۭـ]+$/.test(t);
// علامة الترقيم المفردة داخل الاقتباس لا تقطعه ولا تُعدّ كلمة: النقطة بين آيتين متتاليتين
// («… وعيون . وزروع …»)، والنقطتان قبل القول («قالوا : بلى …»)، والفاصلة
const DOT = '.';
const PUNCT = new Set(['.', ':', '،', ',', '؛', '؟', '!']);

// نص المصحف الإملائي (quran.json، الحقل e) مطبَّعًا متصلًا بلا مسافات، ومعه حدود الكلمات: فالمقارنة
// بالحروف لا بالكلمات، لأن الفصل والوصل يختلفان («يا أيها» في النسخة و«ياأيها» في المصحف، و«أولم» فيها
// و«أو لم» فيه).
export function quranIndex(quran) {
  let str = '';
  const bounds = new Set([0]);
  for (const v of quran.verses) {
    for (const w of v.e.split(/\s+/)) {
      const n = normWord(w);
      if (!n) continue;
      str += n;
      bounds.add(str.length);
    }
  }
  // أسماء السور لعزو الآيات («[ لقمان 14»)، الأطول أولًا
  const names = quran.suras.map((x) => x.name).sort((a, b) => b.length - a.length).join('|');
  return { str, bounds, names };
}

// هل في المصحف حروف الكلمات (مطبَّعة) متوالية، تبدأ عند حدّ كلمة (start) وتنتهي عند حدّ كلمة (end)؟
function found(Q, ns, { start = true, end = true } = {}) {
  const x = ns.join('');
  if (!x) return false;
  for (let i = Q.str.indexOf(x); i >= 0; i = Q.str.indexOf(x, i + 1)) {
    if ((!start || Q.bounds.has(i)) && (!end || Q.bounds.has(i + x.length))) return true;
  }
  return false;
}
const inQuran = (Q, ns) => found(Q, ns);

// كلمات المقطع: [{ t: نصّها, n: صورتها للمقارنة }]، والفاصل بين كل كلمتين في sep.
// وعلامة الترقيم وغير العربي والسطر الجديد تقطع المطابقة (n فارغ).
function tokens(s) {
  const t = s.trim();
  if (!t) return { toks: [], seps: [] };
  const parts = t.split(/(\s+)/);
  return {
    toks: parts.filter((_, i) => i % 2 === 0).map((w) => ({ t: w, n: isWord(w) ? normWord(w) : PUNCT.has(w) ? DOT : '' })),
    // seps[i] بين الكلمة i والكلمة i+1
    seps: parts.filter((_, i) => i % 2),
  };
}

// صور الكلمات للمطابقة، بلا علامات الترقيم
const norms = (toks) => toks.map((x) => x.n).filter((n) => n !== DOT);
// عدد الكلمات بلا علامات الترقيم
const words = (toks) => toks.filter((x) => x.n !== DOT).length;

// أطول عدد كلمات من أول toks يطابق المصحف (ولا تتجاوز سطرًا ولا علامة ترقيم)
function longestPrefix(Q, toks, seps) {
  let best = 0;
  for (let k = 1; k <= toks.length; k++) {
    if (!toks[k - 1].n || (k > 1 && seps[k - 2].includes('\n'))) break;
    // لا يبدأ الاقتباس ولا ينتهي بعلامة ترقيم
    if (toks[k - 1].n === DOT) {
      if (k === 1) break;
      continue;
    }
    const ns = norms(toks.slice(0, k));
    if (inQuran(Q, ns)) best = k;
    // لا يُعرف بعدُ حدّ الكلمة في المصحف («قل يا» من «قل ياعبادي»): يُمدّ ما دامت الحروف فيه
    else if (!found(Q, ns, { end: false })) break;
  }
  return best;
}

// أطول عدد كلمات من آخر toks يطابق المصحف
function longestSuffix(Q, toks, seps) {
  let best = 0;
  const n = toks.length;
  for (let k = 1; k <= n; k++) {
    const i = n - k;
    if (!toks[i].n || (k > 1 && seps[i].includes('\n'))) break;
    if (toks[i].n === DOT) {
      if (k === 1) break;
      continue;
    }
    const ns = norms(toks.slice(i));
    if (inQuran(Q, ns)) best = k;
    else if (!found(Q, ns, { start: false })) break;
  }
  return best;
}

const join = (toks, seps, from, to) => toks.slice(from, to).map((x, i) => (i ? seps[from + i - 1] : '') + x.t).join('');

// ---------- اقتباسات الآيات (t3) ----------

// نصّ وسم t3: «( آية )» أو مكسور «( آية … ( آية … )». يعيد النص بقوسي الآية لما طابق المصحف.
// stats يُحصي ما أُصلح للتقرير.
export function fixQuotes(Q, inner, stats = {}) {
  const s = inner.trim();
  const closed = /\)$/.test(s);
  const body = s.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
  // الاقتباس لا يبدأ بقوس: يبقى كما هو
  if (!/^\(/.test(s)) return s;
  const segs = body.split(/\s*\(\s*/);
  return segs
    .map((seg, i) => {
      const last = i === segs.length - 1;
      const isClosed = last && closed;
      const { toks, seps } = tokens(seg);
      if (!toks.length) return '(' + (isClosed ? ')' : '');
      const plain = toks.every((x) => x.n) && !seps.some((x) => x.includes('\n'));
      // الاقتباس كله آية
      if (isClosed && plain && inQuran(Q, norms(toks))) {
        stats.whole = (stats.whole ?? 0) + 1;
        return `﴿${seg.trim()}﴾`;
      }
      const p = longestPrefix(Q, toks, seps);
      if (isClosed && plain) {
        // اقتباس سليم القوسين يطابق المصحف أوله وآخره، وبينهما كلمة أو كلمتان برسم آخر أو قراءة أخرى
        // («ثم أرسلنا رسلنا تترا كل ما جاء…» وفي المصحف «تترى»): آية كله
        const q = p ? longestSuffix(Q, toks.slice(p), seps.slice(p)) : 0;
        if (p && q && words(toks.slice(p, toks.length - q)) <= 2 && words(toks) >= 4) {
          stats.whole = (stats.whole ?? 0) + 1;
          stats.log?.push(`~   ﴿${seg.trim()}﴾`);
          return `﴿${seg.trim()}﴾`;
        }
        // وإلا فالقصير يبقى بقوسيه كما في النسخة (قراءة أخرى، أو رسم مختلف «فإن لم» و«فإلم»)، لا يُقسم
        if (words(toks) <= 15) {
          stats.kept = (stats.kept ?? 0) + 1;
          return `(${seg.trim()})`;
        }
      }
      if (words(toks.slice(0, p)) < MIN_WORDS) {
        stats.kept = (stats.kept ?? 0) + 1;
        return `(${seg.trim()}${isClosed ? ')' : ''}`;
      }
      stats.closedAfter = (stats.closedAfter ?? 0) + 1;
      stats.log?.push(`t3> ﴿${join(toks, seps, 0, p)}﴾ ${join(toks, seps, p, Math.min(toks.length, p + 6))}`);
      let out = `﴿${join(toks, seps, 0, p)}﴾`;
      if (p === toks.length) return out;
      const restToks = toks.slice(p);
      const restSeps = seps.slice(p);
      if (isClosed) {
        const q = longestSuffix(Q, restToks, restSeps);
        if (words(restToks.slice(restToks.length - q)) >= MIN_WORDS && q < restToks.length) {
          stats.openedBefore = (stats.openedBefore ?? 0) + 1;
          const cut = restToks.length - q;
          stats.log?.push(`t3< ${join(restToks, restSeps, Math.max(0, cut - 6), cut)} ﴿${join(restToks, restSeps, cut, restToks.length)}﴾`);
          return `${out}${seps[p - 1]}${join(restToks, restSeps, 0, cut)}${restSeps[cut - 1]}﴿${join(restToks, restSeps, cut, restToks.length)}﴾`;
        }
        stats.stray = (stats.stray ?? 0) + 1;
        return `${out}${seps[p - 1]}${join(restToks, restSeps, 0, restToks.length)})`;
      }
      out += seps[p - 1] + join(restToks, restSeps, 0, restToks.length);
      return out;
    })
    .join(' ');
}

// أقواس بلا قرين خارج الوسوم، في الفقرة الواحدة:
//   • «) آية )» قوس الفتح مقلوب ← ﴿آية﴾ إن طابقت المصحف، وإلا «(كلمة)» إن قصرت
//   • «… من ربهم وبالآخرة هم يوقنون )» غالق بلا فاتح ← يُفتح قبل أطول ما يطابق المصحف من آخر الكلام قبله
//   • «( الحمد لله وهو مبتدأ …» فاتح بلا غالق ← يُغلق بعد أطول ما يطابق المصحف من أول الكلام بعده
// وما لم يطابق يبقى كما هو.
const BRACKETS = /[()﴿﴾[\]"]/;
export function fixStray(Q, para, stats = {}) {
  let s = para;
  // مواضع القوسين بلا قرين
  const loneOf = () => {
    const open = [];
    const lone = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') open.push(i);
      else if (s[i] === ')') {
        if (open.length) open.pop();
        else lone.push(i);
      }
    }
    return [lone, open];
  };
  // «) آية )»: غالقان بلا قرين بينهما آية
  let [closes] = loneOf();
  for (let k = closes.length - 2; k >= 0; k--) {
    const [i, j] = [closes[k], closes[k + 1]];
    const t = s.slice(i + 1, j);
    if (BRACKETS.test(t) || t.includes('\n')) continue;
    const { toks } = tokens(t);
    if (!toks.length || !toks.every((x) => x.n)) continue;
    if (inQuran(Q, norms(toks))) {
      stats.reversed = (stats.reversed ?? 0) + 1;
      stats.log?.push(`rev ${s.slice(Math.max(0, i - 30), i)}﴿${t.trim()}﴾`);
      s = s.slice(0, i) + '﴿' + t.trim() + '﴾' + s.slice(j + 1);
      k--;
    } else if (words(toks) <= 4) {
      // كلمة أو كلمتان برسم آخر أو قراءة أخرى («) ذرياتهم )»): القوسان يُعدَلان ويبقيان قوسين
      stats.reversed = (stats.reversed ?? 0) + 1;
      s = s.slice(0, i) + '(' + t.trim() + ')' + s.slice(j + 1);
      k--;
    }
  }
  const [lone, open] = loneOf();
  lone.push(...open);
  lone.sort((a, b) => b - a);
  // من الآخر إلى الأول، لتبقى المواضع صحيحة
  for (const i of lone) {
    if (s[i] === ')') {
      const before = s.slice(0, i);
      let start = before.length;
      while (start > 0 && !BRACKETS.test(before[start - 1])) start--;
      const seg = before.slice(start);
      const { toks, seps } = tokens(seg);
      const q = longestSuffix(Q, toks, seps);
      if (words(toks.slice(toks.length - q)) < MIN_WORDS) {
        stats.stray = (stats.stray ?? 0) + 1;
        continue;
      }
      stats.openedBefore = (stats.openedBefore ?? 0) + 1;
      const cut = toks.length - q;
      stats.log?.push(`<   ${join(toks, seps, Math.max(0, cut - 6), cut)} ﴿${join(toks, seps, cut, toks.length)}﴾`);
      const lead = seg.match(/^\s*/)[0];
      const pre = cut ? join(toks, seps, 0, cut) + seps[cut - 1] : '';
      s = before.slice(0, start) + lead + pre + '﴿' + join(toks, seps, cut, toks.length) + '﴾' + s.slice(i + 1);
    } else {
      const after = s.slice(i + 1);
      let end = 0;
      while (end < after.length && !BRACKETS.test(after[end])) end++;
      const seg = after.slice(0, end);
      const { toks, seps } = tokens(seg);
      const p = longestPrefix(Q, toks, seps);
      if (words(toks.slice(0, p)) < MIN_WORDS) {
        stats.stray = (stats.stray ?? 0) + 1;
        continue;
      }
      stats.closedAfter = (stats.closedAfter ?? 0) + 1;
      stats.log?.push(`>   ﴿${join(toks, seps, 0, p)}﴾ ${join(toks, seps, p, Math.min(toks.length, p + 6))}`);
      const rest = p < toks.length ? seps[p - 1] + join(toks, seps, p, toks.length) : '';
      const trail = seg.match(/\s*$/)[0];
      s = s.slice(0, i) + '﴿' + join(toks, seps, 0, p) + '﴾' + rest + trail + after.slice(end);
    }
  }
  return s;
}

// مواضع الأقواس بلا قرين في النص: { [i]: true }
function loneSet(s, o, c) {
  const open = [];
  const lone = new Set();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === o) open.push(i);
    else if (s[i] === c) {
      if (open.length) open.pop();
      else lone.add(i);
    }
  }
  for (const i of open) lone.add(i);
  return lone;
}

// أقواس المعقوف والقوس الغالق الزائد، في الفقرة الواحدة، بعد إصلاح اقتباسات الآيات:
//   • عزو آية بلا معقوف غالق («[ لقمان 14.») ← «[لقمان: 14].»
//   • معقوفان مقلوبان («حديث ] آخر [ فيه») ← «حديث [آخر] فيه»
//   • بقايا قوسين بلا قرين بعد آية أو معقوف أو رقم آية («﴾ ])»، «[وما خلفها] )»، «﴾ (121) )») تُحذف
export function fixSquare(names, para, stats = {}) {
  let s = para.replace(new RegExp(`\\[ ?(${names}) ?:? ?(\\d+(?: ?[-،,] ?\\d+)*)(?! ?[\\d\\]])`, 'g'), (m, n, d, i, all) => {
    if (!loneSet(all, '[', ']').has(i)) return m;
    stats.square = (stats.square ?? 0) + 1;
    return `[${n}: ${d}]`;
  });
  for (let again = true; again; ) {
    again = false;
    const lone = loneSet(s, '[', ']');
    const m = [...s.matchAll(/\] ?([^[\]()﴿﴾\n]{1,40}?) ?\[ ?/g)].find((x) => lone.has(x.index) && lone.has(x.index + x[0].trimEnd().length - 1));
    if (m) {
      stats.square = (stats.square ?? 0) + 1;
      s = s.slice(0, m.index) + `[${m[1].trim()}] ` + s.slice(m.index + m[0].length);
      again = true;
    }
  }
  const sq = loneSet(s, '[', ']');
  const pa = loneSet(s, '(', ')');
  // «﴾ ])»: المعقوف والقوس كلاهما بلا قرين
  s = s.replace(/﴾ ?\]\)/g, (m, i) => {
    const j = i + m.indexOf(']');
    if (!sq.has(j) || !pa.has(j + 1)) return m;
    stats.square = (stats.square ?? 0) + 1;
    return '﴾';
  });
  const pa2 = loneSet(s, '(', ')');
  s = s.replace(/(\]|\(\d+\)) ?\)/g, (m, pre, i) => {
    if (!pa2.has(i + m.length - 1)) return m;
    stats.square = (stats.square ?? 0) + 1;
    return pre;
  });
  return s;
}

// ---------- إصلاحات النسخة يدويًّا ----------

// أخطاء في النسخة نفسها، تُصلح في الجواب قبل التنظيف (موضعها: [النص الخطأ، الصواب]). ونسخة «آيات» هي
// طبعة دار طيبة بتحقيق سامي سلامة، وكل إصلاح هنا طوبق بها في الشاملة (الكتاب 8473).
// والأكثر في أول السور: النسخة تُسقط عنوان «تفسير سورة …» (عنوانٌ في الطبعة)، فتبدأ مقدمة السورة مبتورة
// («مكية»، «وهي مكية»، «وصدرها إلى…»)، فيُعاد العنوان سطرًا قبلها. والسور التي يبدأ تفسيرها بكلام تام
// بلا عنوان تبقى كما هي.
const heading = (name, rest) => [`|||<p>${rest}`, `|||<p>تفسير سورة ${name}</p><p>${rest}`];
export const FIXES = {
  '2:1': [heading('البقرة', 'خمسة وعشرون ألفا')],
  // الطبعة: «هي مدنية؛ لأن صدرها إلى ثلاث وثمانين آية»
  '3:1': [['|||<p>وصدرها إلى', '|||<p>تفسير سورة آل عمران</p><p>هي مدنية؛ لأن صدرها إلى']],
  '8:1': [heading('الأنفال', 'وهي مدنية')],
  '29:1': [heading('العنكبوت', 'مكية</p>')],
  '30:1': [heading('الروم', 'مكية .</p>')],
  '32:1': [heading('السجدة', 'وهي مكية</p>')],
  '34:1': [heading('سبأ', 'وهي مكية</p>')],
  // الطبعة: «[وهي] مكية»
  '36:1': [['|||<p>وهي ] مكية', '|||<p>تفسير سورة يس</p><p>[وهي] مكية']],
  '46:1': [heading('الأحقاف', 'مكية</p>')],
  // العنوان مكرر
  '48:1': [['تفسير سورة الفتح وهي مكية تفسير سورة الفتح وهي مكية', 'تفسير سورة الفتح وهي مكية']],
  '101:1': [heading('القارعة', 'مكية</p>')],
  '104:1': [['|||<p>فسير سورة', '|||<p>تفسير سورة']],
  '107:1': [heading('الماعون', 'مكية</p>')],
};
export function applyFixes(key, raw) {
  let s = raw;
  for (const [from, to] of FIXES[key] ?? []) {
    if (!s.includes(from)) throw new Error(`إصلاح ${key} لم يجد نصّه: ${from}`);
    s = s.replace(from, to);
  }
  return s;
}

// يحذف الفراغ بعد القوس الفاتح وقبل القوس الغالق في نص الوسم الواحد
const trimInside = (t) => t.replace(/^\s*([("[])\s+/, '$1').replace(/\s+([)"\]])\s*$/, '$1').trim();

// نص التفسير من جواب «آيات» (ما بعد «|||»)، مصدَّرة لتختبرها tests/unit/data.test.js
export function cleanKatheer(Q, raw, stats = {}) {
  const names = Q.names;
  const i = raw.indexOf('|||');
  if (i < 0) throw new Error('جواب بلا فاصل «|||»');
  let s = raw
    .slice(i + 3)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/‏/g, '');
  // الوسوم من الداخل إلى الخارج (في النسخة وسم داخل وسم)
  const span = /<span class="t(\d)">((?:(?!<span)[\s\S])*?)<\/span>/g;
  while (span.test(s)) {
    s = s.replace(span, (_, k, t) => (k === '3' ? fixQuotes(Q, t, stats) : trimInside(t)));
  }
  s = s.replace(/<[^>]+>/g, '');
  return s
    .split('\n')
    .map((p) =>
      fixSquare(names, fixStray(Q, p.replace(/[ \t  ]+/g, ' '), stats), stats)
        // الفاصلة والفاصلة المنقوطة اللاتينيتان في النص العربي
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?, ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1، ')
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?; ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1؛ ')
        // لا فراغ قبل علامة الترقيم («قال :» ← «قال:»)، إلا «...»
        .replace(/ ([،؛:.؟!])(?!\.)/g, '$1')
        // علامة ترقيم ملتصقة بما بعدها («قال:وقيل») تفصلها مسافة
        .replace(new RegExp(`([،؛:؟!])(?=[${AR}﴿«(])`, 'g'), '$1 ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

// أقواس غير متوازنة في النص (للتقرير ولاختبار البيانات)
export const unbalanced = (t) => [['(', ')'], ['﴿', '﴾'], ['[', ']']].some(([o, c]) => t.split(o).length !== t.split(c).length);

async function main() {
  const quran = JSON.parse(await readFile(QURAN, 'utf8'));
  const Q = quranIndex(quran);
  const raws = await fetchAll('katheer', quran);

  const stats = {};
  const verses = raws.map((raw, i) => cleanKatheer(Q, applyFixes(`${quran.verses[i].s}:${quran.verses[i].a}`, raw), stats));
  const ref = (i) => `${quran.verses[i].s}:${quran.verses[i].a}`;
  const empty = verses.map((t, i) => (t ? null : ref(i))).filter(Boolean);
  const leftover = verses.map((t, i) => (/[<>{}]|&[a-z]+;/.test(t) ? ref(i) : null)).filter(Boolean);
  const odd = verses.map((t, i) => (unbalanced(t) ? ref(i) : null)).filter(Boolean);
  const bytes = await writeSplit('katheer', quran, verses);

  console.log('═══ تقرير تفسير ابن كثير ═══');
  console.log(`الآيات: ${verses.length} · بلا تفسير: ${empty.length} ${empty.slice(0, 80).join(' ')}`);
  console.log(`اقتباسات الآيات: كاملة ${stats.whole ?? 0} · أُغلقت بعد ما طابق المصحف ${stats.closedAfter ?? 0} · فُتحت قبل ما طابقه ${stats.openedBefore ?? 0} · بقيت كما هي ${stats.kept ?? 0} · قوس فتحها مقلوب ${stats.reversed ?? 0} · قوس بقي بلا قرين ${stats.stray ?? 0} · معقوفات أُصلحت ${stats.square ?? 0}`);
  console.log(`نصوص فيها بقايا وسوم: ${leftover.length} ${leftover.slice(0, 40).join(' ')}`);
  console.log(`نصوص أقواسها غير متوازنة: ${odd.length} ${odd.slice(0, 80).join(' ')}`);
  console.log(`حجم الملفات الناتجة: ${bytes} بايت → public/data/tafsir/katheer (اكتبه في src/data/tafsirs.js)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
