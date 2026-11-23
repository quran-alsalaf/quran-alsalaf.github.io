// صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): ترتيب المحتوى على صور بمقاس واحد — منطق خالص بلا رسم.
//
// المدخل «مواصفة» (spec): { title, ref, verse?: نص الآية, units: [وحدات المحتوى], credit? }
// والوحدات:
//   { type: 'para', runs: [{ t, s }], size?: 'text' | 'small', bullet?, bar?, align?: 'center', keepNext? }
//       فقرة: أجزاء نصّ بأنماطها (s: text · quote · em · bold · muted)، والبند بنقطة بلون التطبيق (bullet)،
//       والتوجيه الدعوي بخطّ بلون التطبيق في أوله (bar). keepNext: لا تنفصل عمّا بعدها (العنوان والقائل).
//   { type: 'pair', word, meaning }   سطر من معاني الكلمات: الكلمة بخط المصحف، ومعناها
//   { type: 'rule' }                  خط فاصل (بين فقرات التفسير، وبين الفوائد)
//
// القياس يأتي من خارج (measure(نص، نمط، حجم) ⇐ عرضه): في التطبيق من لوحة الرسم، وفي الاختبارات تقدير ثابت.
// والنتيجة صفحات، في كلٍّ عناصر بمواضعها من أعلى المتن (y) — يرسمها src/lib/shareImage.js.
//
// قواعد التقسيم (بقرار صاحب المشروع):
//   • المحتوى القصير صورة واحدة بأكبر خط يسعه (من SIZES)، في وسطها.
//   • وما لا يسعه صورة واحدة بأصغرها يُقسم على صور، حتى MAX_IMAGES وحدها؛ وما زاد لا يُشارَك، وفي آخر
//     الأخيرة سطر «التتمة في تطبيق قرآن السلف».
//   • الانتقال إلى الصورة التالية عند نهاية فقرة أو نهاية جملة («.» «؟» «!» «؛» خارج ﴿…﴾)، لا في وسط جملة؛
//     إلا جملة لا تسعها صورة كاملة فتُقسم عند آخر سطر يسعها.
//   • الآية في أول الصورة الأولى، ولا تنفرد عن أول محتواها.
//
// صفحات المحتوى (الجلسة ٢، ٢٠٢٦-١١-٢٣): مقدار آيات، كلٌّ في مربعها ثم محتواها — وحدات بمجموعاتها (group):
//   { type: 'verse', text, group }   مربع آية (أو آيات متتالية لها محتوى واحد) في أول مجموعتها
//   وكل وحدة بعدها group مجموعتها. وقواعدها (بقرار صاحب المشروع):
//   • الانتقال إلى الصورة التالية عند نهاية آية ومحتواها: المجموعة التي لا تسعها بقية الصورة وتسعها صورة كاملة
//     تبدأ بها التالية، والأطول من صورة كاملة تُقسم كما سبق (عند نهاية جملة).
//   • ما زاد على MAX_IMAGES لا يُشارَك: تُشارَك المجموعات التي تسعها الصور كاملة، وتُحذف المقطوعة (إلا الأولى
//     فيُشارك أولها)؛ والنتيجة shown عدد المجموعات المشارَكة كاملة، وpartial إن قُطعت الأولى.

export const MAX_IMAGES = 4;
export const MORE_TEXT = 'التتمة في تطبيق قرآن السلف';

// أحجام خط المحتوى بالبكسل في صورة عرضها ١٠٨٠، من الأكبر؛ والأخير حجم التقسيم على صور
export const SIZES = [58, 52, 47, 43, 40];

// الأنماط: الخط (content: خط المحتوى، quran: خط المصحف)، ووزنه، وحجمه (مفتاح في metrics)، ولونه
export const STYLES = {
  text: { font: 'content', weight: 400, size: 'text', color: 'ink' },
  quote: { font: 'content', weight: 400, size: 'text', color: 'accent' },
  em: { font: 'content', weight: 400, size: 'text', color: 'accent' },
  bold: { font: 'content', weight: 700, size: 'text', color: 'ink' },
  muted: { font: 'content', weight: 400, size: 'small', color: 'muted' },
  verse: { font: 'quran', weight: 400, size: 'verse', color: 'ink' },
  word: { font: 'quran', weight: 400, size: 'word', color: 'accent' },
};

// المقاسات كلها من حجم خط المحتوى s
export function metrics(s) {
  const small = Math.round(s * 0.78);
  const verse = Math.round(s * 1.22);
  const word = Math.round(s * 1.1);
  return {
    size: { text: s, small, verse, word },
    lh: { text: Math.round(s * 1.9), small: Math.round(small * 1.85), verse: Math.round(verse * 2.05), word: Math.round(word * 1.95) },
    gap: Math.round(s * 0.45), // بين الفقرات
    rule: Math.round(s * 1.3), // ارتفاع الخط الفاصل بمسافتيه
    bulletIndent: Math.round(s * 0.95),
    barIndent: Math.round(s * 0.7),
    versePad: Math.round(s * 0.55), // حشو مربع الآية من فوقه وتحته
    verseSide: Math.round(s * 0.7), // ومن جانبيه
    verseGap: Math.round(s * 0.9), // بعد مربع الآية
    pairPad: Math.round(s * 0.3),
    pairGap: Math.round(s * 0.6), // بين عمودي الكلمة ومعناها
  };
}

// ---------- الكلمات ----------
// أجزاء الفقرة ⇐ كلمات، كلٌّ أجزاء بأنماطها (فالكلمة تجمع نمطين إن لم تفصل بينهما مسافة: «﴿الحمد لله﴾،»)
export function toWords(runs) {
  const words = [];
  let glue = false; // آخر ما كُتب بلا مسافة بعده: الجزء التالي يكمل كلمته
  for (const { t, s = 'text' } of runs) {
    if (!t) continue;
    const parts = t.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        glue = false;
        continue;
      }
      if (glue && words.length) words.at(-1).push({ t: p, s });
      else words.push([{ t: p, s }]);
      glue = true;
    }
  }
  return words;
}

const wordText = (w) => w.map((x) => x.t).join('');

// مواضع الانتقال المسموح بها في الفقرة: بعد كلمة تنتهي بها جملة، خارج الاقتباس القرآني ﴿…﴾.
// clauses: بعد الفاصلة أيضًا («،») — حين تبقى في الصورة مساحة كبيرة لا تسعها جملة كاملة (جمل الميسّر والسعدي
// طويلة موصولة بالفواصل)، فلا يُترك ثلثها فارغًا
const SENTENCE_END = /[.؟!؛?]["»)\]]?$/;
const CLAUSE_END = /[.؟!؛?،,]["»)\]]?$/;
export function sentenceEnds(words, { clauses = false } = {}) {
  const end = clauses ? CLAUSE_END : SENTENCE_END;
  const out = [];
  let depth = 0;
  words.forEach((w, i) => {
    const t = wordText(w);
    for (const c of t) {
      if (c === '﴿') depth++;
      else if (c === '﴾') depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && end.test(t) && !/\.\.$/.test(t) && i < words.length - 1) out.push(i + 1);
  });
  return out;
}

// ---------- السطور ----------
// تقسيم الكلمات أسطرًا لا يتجاوز كلٌّ منها width. measureWord(w) ⇐ عرض الكلمة، space عرض المسافة
export function wrap(words, width, measureWord, space) {
  const lines = [];
  let cur = [];
  let w = 0;
  for (const word of words) {
    const ww = measureWord(word);
    if (cur.length && w + space + ww > width) {
      lines.push({ words: cur, width: w });
      cur = [];
      w = 0;
    }
    w += (cur.length ? space : 0) + ww;
    cur.push(word);
  }
  if (cur.length) lines.push({ words: cur, width: w });
  return lines;
}

// ---------- الترتيب ----------
/*
  layoutShare(spec, measure, opts) ⇐ { size, pages: [{ els, height }], truncated, single }
    measure(text, style, px) ⇐ العرض بالبكسل
    opts: { width: عرض المتن, height: ارتفاعه في كل صورة, tail: ارتفاع سطر «التتمة», maxPages, sizes }
  والعناصر:
    { kind: 'verse', y, h, lines, lh }        مربع الآية (أسطره في وسطه)
    { kind: 'line', y, h, words, width, unit, first, last, justify }   سطر من فقرة
    { kind: 'pair', y, h, wordLines, meaningLines, top }               سطر من المعاني (top: أول المعاني في الصورة)
    { kind: 'rule', y, h }
    { kind: 'tail', y, h }                    «التتمة في تطبيق قرآن السلف» (آخر الصورة الأخيرة إن قُطع المحتوى)
*/
export function layoutShare(spec, measure, opts) {
  const sizes = opts.sizes ?? SIZES;
  for (const s of sizes) {
    // صورة واحدة: بلا مكان لسطر «التتمة» (ما لا يسعها يُقسم على صور)
    const r = layoutAt(spec, measure, s, { ...opts, maxPages: 1, tail: 0 });
    if (!r.truncated) return { ...r, size: s, single: true };
  }
  const s = sizes.at(-1);
  return { ...layoutAt(spec, measure, s, opts), size: s, single: false };
}

function layoutAt(spec, measure, s, { width, height, tail, maxPages = MAX_IMAGES }) {
  const m = metrics(s);
  const space = {};
  const spaceOf = (style) => (space[style] ??= measure(' ', style, m.size[STYLES[style].size]));
  const measureWord = (w) => w.reduce((sum, x) => sum + measure(x.t, x.s, m.size[STYLES[x.s].size]), 0);

  // الوحدات بكلماتها
  const units = [];
  if (spec.verse) units.push({ type: 'verse', words: toWords([{ t: spec.verse, s: 'verse' }]), keepNext: true });
  for (const u of spec.units) {
    if (u.type === 'para') units.push({ ...u, words: toWords(u.runs) });
    else if (u.type === 'verse') units.push({ ...u, words: toWords([{ t: u.text, s: 'verse' }]), keepNext: true });
    else units.push(u);
  }
  if (spec.credit) units.push({ type: 'para', runs: [], words: toWords([{ t: spec.credit, s: 'muted' }]), size: 'small', align: 'center', credit: true });

  const indentOf = (u) => (u.bullet ? m.bulletIndent : 0) + (u.bar ? m.barIndent : 0);
  const lhOf = (u) => (u.type === 'verse' ? m.lh.verse : m.lh[u.size ?? 'text']);
  const styleOfLine = (u) => (u.type === 'verse' ? 'verse' : (u.words[0]?.[0]?.s ?? 'text'));

  // أسطر وحدة (فقرة أو آية) وارتفاعها
  function linesOf(u, words = u.words) {
    const w = u.type === 'verse' ? width - 2 * m.verseSide : width - indentOf(u);
    return wrap(words, w, measureWord, spaceOf(styleOfLine(u)));
  }
  const heightOf = (u, lines) => (u.type === 'verse' ? lines.length * m.lh.verse + 2 * m.versePad : lines.length * lhOf(u));

  function pairOf(u) {
    const wordW = Math.round(width * 0.34);
    const meanW = width - wordW - m.pairGap;
    const wordLines = wrap(toWords([{ t: u.word, s: 'word' }]), wordW, measureWord, spaceOf('word'));
    const meaningLines = wrap(toWords([{ t: u.meaning, s: 'text' }]), meanW, measureWord, spaceOf('text'));
    const h = Math.max(wordLines.length * m.lh.word, meaningLines.length * m.lh.text) + 2 * m.pairPad;
    return { wordLines, meaningLines, h, wordW };
  }

  // أول ما يلزم من الوحدة التالية حتى لا تنفرد الوحدة keepNext عنها (سطرها الأول)
  function firstHeight(u) {
    if (!u) return 0;
    if (u.type === 'rule') return 0;
    if (u.type === 'pair') return pairOf(u).h;
    if (u.type === 'verse') return m.lh.verse + 2 * m.versePad;
    return lhOf(u);
  }
  const gapBefore = (u, prev) => {
    if (!prev || u.type === 'rule' || prev.type === 'rule') return 0;
    if (prev.type === 'verse') return m.verseGap;
    if (u.type === 'verse') return m.verseGap;
    if (u.type === 'pair' && prev.type === 'pair') return 0;
    return m.gap;
  };

  const pages = [{ els: [], height: 0 }];
  let truncated = false;
  let y = 0;
  let prev = null; // آخر وحدة في الصورة الجارية
  const page = () => pages.at(-1);
  const cap = () => (pages.length === maxPages ? height - tail : height);
  function newPage() {
    // لا خط فاصل في آخر صورة
    while (page().els.at(-1)?.kind === 'rule') {
      const r = page().els.pop();
      y = r.y;
    }
    page().height = y;
    if (pages.length === maxPages) {
      truncated = true;
      return false;
    }
    pages.push({ els: [], height: 0 });
    y = 0;
    prev = null;
    return true;
  }

  function placeLines(u, lines, gap, { endsUnit }) {
    y += gap;
    if (u.type === 'verse') {
      const h = heightOf(u, lines);
      page().els.push({ kind: 'verse', y, h, lines, lh: m.lh.verse, pad: m.versePad, group: u.group });
      y += h;
      return;
    }
    const lh = lhOf(u);
    lines.forEach((line, i) => {
      const last = i === lines.length - 1;
      page().els.push({
        kind: 'line',
        y,
        h: lh,
        words: line.words,
        width: line.width,
        unit: u,
        first: i === 0 && !u.continued,
        last: last && endsUnit,
        // ضبط السطر بين الحافتين إلا آخر سطر الفقرة، أو سطرًا قصيرًا جدًّا
        justify: !(last) && u.align !== 'center' && line.width > (width - indentOf(u)) * 0.72,
        indent: indentOf(u),
        group: u.group,
      });
      y += lh;
    });
  }

  const queue = [...units];

  // ارتفاع المجموعة كلها من أولها (u) في صورة واحدة: وحداتها بفواصلها
  function groupHeight(u) {
    const end = queue.findIndex((x) => x.group !== u.group);
    const list = [u, ...(end < 0 ? queue : queue.slice(0, end))];
    let h = 0;
    let p = null;
    for (const x of list) {
      h += p ? gapBefore(x, p) : 0;
      if (x.type === 'rule') h += m.rule;
      else if (x.type === 'pair') h += pairOf(x).h;
      else h += heightOf(x, linesOf(x));
      p = x;
    }
    return h;
  }
  let pending = null; // الوحدة التي وقف عندها الترتيب (لا صورة بعد الأخيرة)

  // u لا تسعها الصورة الجارية فتبدأ بها التالية، ومعها ما قبلها مما لا ينفرد عنها (عنوان الفائدة وقائلها)،
  // ما لم تفرغ منه الصورة الجارية. false: لا صورة بعد الأخيرة
  function moveOn(u) {
    const els = page().els;
    const moved = [];
    let i = els.length;
    while (i > 0 && els[i - 1].kind === 'line' && els[i - 1].unit.keepNext && !els[i - 1].unit.continued) {
      const unit = els[i - 1].unit;
      while (i > 0 && els[i - 1].kind === 'line' && els[i - 1].unit === unit) i--;
      moved.unshift(unit);
    }
    if (moved.length && i > 0) {
      els.length = i;
      y = els[i - 1].y + els[i - 1].h;
    } else moved.length = 0;
    if (!newPage()) return false;
    queue.unshift(...moved, u);
    return true;
  }

  while (queue.length) {
    const u = queue.shift();
    const empty = page().els.length === 0;
    // أول مجموعة (آية ومحتواها) لا تسعها بقية الصورة وتسعها صورة كاملة: تبدأ بها التالية
    if (u.type === 'verse' && u.group != null && !u.continued && !empty) {
      const g = groupHeight(u);
      if (y + gapBefore(u, prev) + g > cap() && g <= height - (pages.length + 1 === maxPages ? tail : 0)) {
        if (!newPage()) {
          pending = u;
          break;
        }
        queue.unshift(u);
        continue;
      }
    }
    if (u.type === 'rule') {
      if (!empty && y + m.rule <= cap()) {
        page().els.push({ kind: 'rule', y, h: m.rule, group: u.group });
        y += m.rule;
        prev = u;
      }
      continue;
    }
    const gap = empty ? 0 : gapBefore(u, prev);
    const next = u.keepNext ? firstHeight(queue.find((x) => x.type !== 'rule')) + m.gap : 0;
    const room = cap() - y - gap;

    if (u.type === 'pair') {
      const p = pairOf(u);
      if (p.h + next <= room || empty) {
        y += gap;
        page().els.push({ kind: 'pair', y, h: p.h, wordLines: p.wordLines, meaningLines: p.meaningLines, wordW: p.wordW, top: prev?.type !== 'pair', pad: m.pairPad, lhWord: m.lh.word, lhText: m.lh.text, group: u.group });
        y += p.h;
        prev = u;
        continue;
      }
      if (!moveOn(u)) {
        pending = u;
        break;
      }
      continue;
    }

    const lines = linesOf(u);
    const h = heightOf(u, lines);
    // والوحدة التي لا تنفرد عمّا بعدها تُوضع في صورة فارغة ولو لم يسعهما معًا
    if (h <= room && (h + next <= room || empty)) {
      placeLines(u, lines, gap, { endsUnit: true });
      prev = u;
      continue;
    }

    // لا تسعها الصورة الجارية: ما يسعها منها حتى نهاية جملة، والباقي في التالية
    // (وعند الفاصلة إن بقي في الصورة أكثر من ثلثها؛ وأقل من سطرين لا يُبدأ فيه شيء)
    let placed = false;
    const tries = u.type === 'verse' || room < 2 * lhOf(u) ? [] : room > height * 0.3 ? [false, true] : [false];
    for (const clauses of tries) {
      const breaks = sentenceEnds(u.words, { clauses });
      for (let k = breaks.length - 1; k >= 0; k--) {
        const head = u.words.slice(0, breaks[k]);
        const hl = linesOf(u, head);
        if (heightOf(u, hl) <= room) {
          placeLines(u, hl, gap, { endsUnit: false });
          queue.unshift({ ...u, words: u.words.slice(breaks[k]), continued: true });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (placed) {
      if (!newPage()) break;
      continue;
    }
    // ولا جملة واحدة: في صورة فارغة يُقسم عند آخر سطر يسعها (جملة أطول من صورة، أو آية طويلة)
    if (empty || u.type === 'verse') {
      const fixed = u.type === 'verse' ? 2 * m.versePad : 0;
      const n = Math.floor((room - fixed) / lhOf(u));
      if (n >= 1 && (empty || n >= 2)) {
        const used = lines.slice(0, n);
        placeLines(u, used, gap, { endsUnit: false });
        const rest = used.reduce((c, l) => c + l.words.length, 0);
        queue.unshift({ ...u, words: u.words.slice(rest), continued: true });
        if (!newPage()) break;
        continue;
      }
    }
    if (!moveOn(u)) {
      pending = u;
      break;
    }
  }
  if (!truncated) page().height = y;

  // مجموعات: تُحذف المقطوعة (ما بقي منها شيء لم يُرتَّب) إن سبقتها مجموعة كاملة
  const stop = truncated ? (pending ?? queue[0])?.group : undefined;
  const first = units.find((u) => u.group != null)?.group;
  let shown;
  let partial = false;
  if (first != null) {
    const all = new Set(units.filter((u) => u.group != null).map((u) => u.group)).size;
    shown = all;
    if (stop != null && stop > first) {
      for (const p of pages) p.els = p.els.filter((el) => !(el.group >= stop));
      while (pages.length > 1 && !pages.at(-1).els.length) pages.pop();
      const last = pages.at(-1);
      while (last.els.at(-1)?.kind === 'rule') last.els.pop();
      const end = last.els.at(-1);
      last.height = end ? end.y + end.h : 0;
      shown = [...new Set(units.filter((u) => u.group != null && u.group < stop).map((u) => u.group))].length;
    } else if (stop != null) {
      shown = 1;
      partial = true;
    }
  }

  // «التتمة» في آخر الصورة الأخيرة إن بقي من المحتوى شيء
  if (truncated) {
    const last = page();
    last.els.push({ kind: 'tail', y: last.height, h: tail });
    last.height += tail;
  }
  return { pages, truncated, ...(shown != null ? { shown, partial } : {}) };
}

// ---------- النص المرافق للصور ----------
// يظهر تحت الصور في واتساب وتليجرام، والرابط فيه يُضغط (بقرار صاحب المشروع)
export const shareCaption = (link) => `من تطبيق قرآن السلف\n${link}`;
