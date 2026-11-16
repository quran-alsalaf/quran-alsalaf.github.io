// ختمة الحفظ (٢٠٢٦-١١-١٦، بطلب صاحب المشروع): يحفظ المستخدم كل يوم وردًا جديدًا بالأسطر، ويسمّعه بوضع
// التسميع، ومعه مراجعتان: قريبة (آخر ما حفظه من الأوراد) وبعيدة (المحفوظ كله دورةً بعد دورة).
//
// • الخطة بترقيم حفص ومصحفه (أسطره)، كبقية بيانات المستخدم، وتُعرض في ورش بما يقابلها.
// • الاتجاه: من أول المصحف إلى آخره، أو من آخره إلى أوله. وفي العكسي تُرتَّب السور من الآخر، وكل سورة
//   تُحفظ من أولها إلى آخرها (بقرار صاحب المشروع). والبداية والنهاية آيتان يختارهما المستخدم.
// • الورد قطعة متصلة في المصحف تنتهي عند نهاية آية، أقرب ما تكون إلى الأسطر المطلوبة. وفي العكسي لا يجمع
//   الورد آخر سورة مع أول السورة التي قبلها (متباعدتان في المصحف)، أما السور الكاملة المتجاورة فتجتمع.
// • التقسيم لا ذاكرة له: يُعاد من أول آية لم تُحفظ (next) فيعطي الأوراد نفسها، فيُحفظ موضع الحفظ وحده.
// • ما قبل البداية في اتجاه الخطة يُعدّ محفوظًا (للمراجعة البعيدة وحساب النصف)، إلا أن يختار المستخدم
//   «لا أراجع ما قبل البداية».
// • الورد يتبع الإنجاز لا التاريخ كختمة الورد (src/lib/khatma.js)، والمراجعة لا توقف الخطة.
import { addDays, dayKey, daysBetween, readKhatmas, saveKhatma, bumpDoneCount } from './khatma.js';
import { toArabicDigits } from '../data/quran.js';
import { rubName } from './rubs.js';
import { countText } from './count.js';

const n = toArabicDigits;

// ---------- الخيارات ----------
// الحفظ اليومي بالأسطر (٧٫٥ نصف وجه، و١٥ وجه)
export const LINE_PRESETS = [3, 5, 7.5, 15, 30];
export const DEFAULT_LINES = 7.5;
export const MAX_LINES = 150; // «عدد آخر»: إلى عشرة أوجه
// المراجعة القريبة: عدد الأوراد السابقة (٠ بلا مراجعة قريبة)
export const NEAR_PRESETS = [0, 1, 3, 5];
export const DEFAULT_NEAR = 3;
export const MAX_NEAR = 20;
// المراجعة البعيدة: ربع حزب، حزب، جزء، جزءان
export const FAR_UNITS = ['rub', 'hizb', 'juz', 'juz2'];
export const FAR_NAMES = { rub: 'ربع حزب', hizb: 'حزب', juz: 'جزء', juz2: 'جزءان' };

export const LINES = { one: 'سطر واحد', two: ['سطران', 'سطرين'], plural: 'أسطر', acc: 'سطرا' };
export const WIRDS = { one: 'ورد واحد', two: ['وردان', 'وردين'], plural: 'أوراد', acc: 'وردا' };
export const JUZS = { one: 'جزء واحد', two: ['جزءان', 'جزأين'], plural: 'أجزاء', acc: 'جزءا' };

// «٣ أسطر» · «نصف وجه» · «وجه» · «وجهان» · «٤٥ سطرا»
export function linesText(lines) {
  if (lines === 7.5) return 'نصف وجه';
  if (lines === 15) return 'وجه';
  if (lines === 30) return 'وجهان';
  return countText(lines, LINES, n, true);
}
export const wirdsText = (c, nominative = true) => countText(c, WIRDS, n, nominative);

// ---------- السور والأسطر ----------
const cache = new WeakMap();
// لكل مصحف: بداية كل سورة ونهايتها، ووزن كل آية بالأسطر (حصتها من كل سطر بعدد كلماتها فيه)، ومجموعها التراكمي
function index(quran) {
  let x = cache.get(quran);
  if (x) return x;
  const count = quran.verses.length;
  const suraFirst = [];
  const suraLast = [];
  quran.verses.forEach((v, i) => {
    if (suraFirst[v.s] == null) suraFirst[v.s] = i;
    suraLast[v.s] = i;
  });
  const weight = new Float64Array(count);
  for (const page of quran.pages) {
    for (const line of page) {
      if (!line.g) continue;
      const words = line.g.reduce((s, [, from, to]) => s + to - from + 1, 0);
      for (const [v, from, to] of line.g) weight[v] += (to - from + 1) / words;
    }
  }
  const prefix = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) prefix[i + 1] = prefix[i] + weight[i];
  x = { count, suraFirst, suraLast, weight, prefix, total: prefix[count] };
  cache.set(quran, x);
  return x;
}

// أسطر الآيات من a إلى b
export const linesOf = (quran, a, b) => {
  const { prefix } = index(quran);
  return prefix[b + 1] - prefix[a];
};
export const totalLines = (quran) => index(quran).total;
const linesOfRanges = (quran, ranges) => ranges.reduce((s, [a, b]) => s + linesOf(quran, a, b), 0);

// ---------- الخطة ----------
// هل البداية والنهاية صالحتان في هذا الاتجاه؟ في المتقدم: النهاية بعد البداية. وفي العكسي: سورة النهاية
// قبل سورة البداية، أو هي هي والنهاية بعد البداية فيها
export function validPlan(quran, dir, start, end) {
  if (start == null || end == null) return false;
  if (dir === 'forward') return start <= end;
  const [S, E] = [quran.verses[start].s, quran.verses[end].s];
  return E < S || (E === S && start <= end);
}

// قطع الخطة بترتيب حفظها: [أول آية، آخر آية، أهي سورة كاملة]. والآيات داخل كل قطعة بترتيب المصحف
export function planBlocks(quran, dir, start, end) {
  if (!validPlan(quran, dir, start, end)) return [];
  if (dir === 'forward') return [[start, end, false]];
  const { suraFirst, suraLast } = index(quran);
  const S = quran.verses[start].s;
  const E = quran.verses[end].s;
  if (S === E) return [[start, end, start === suraFirst[S] && end === suraLast[S]]];
  const out = [[start, suraLast[S], start === suraFirst[S]]];
  for (let s = S - 1; s > E; s--) out.push([suraFirst[s], suraLast[s], true]);
  out.push([suraFirst[E], end, end === suraLast[E]]);
  return out;
}

// تقسيم آيات متصلة من a إلى b أورادًا بالأسطر: يُضاف إلى الورد آية بعد آية ما دام دون المطلوب، والآية التي
// تتجاوزه تُضاف إن كان الورد بها أقرب إلى المطلوب منه بدونها
function chunks(quran, a, b, target) {
  const { weight } = index(quran);
  const out = [];
  let i = a;
  while (i <= b) {
    const first = i;
    let total = 0;
    while (i <= b) {
      const w = weight[i];
      if (total === 0 || total + w <= target) {
        total += w;
        i++;
        continue;
      }
      if (total + w - target < target - total) i++;
      break;
    }
    out.push([first, i - 1]);
  }
  return out;
}

// أوراد الخطة من آية البداية إلى النهاية: [[أول آية، آخر آية، أول آية في ترتيب الحفظ], ...] بترتيب الحفظ.
// والثالثة تختلف عن الأولى في ورد يجمع سورًا كاملة في الاتجاه العكسي: أوله في المصحف أول أقدم سوره، وأول
// ما يُحفظ منه أول آخر سوره (الناس قبل الفلق). وبها يُعرف موضع الحفظ بعد إتمامه (next)
export function splitHifz(quran, dir, start, end, target) {
  const blocks = planBlocks(quran, dir, start, end);
  if (dir === 'forward') return blocks.length ? chunks(quran, blocks[0][0], blocks[0][1], target).map(([a, b]) => [a, b, a]) : [];
  const { suraFirst } = index(quran);
  const out = [];
  let group = null; // سور كاملة متجاورة في ورد واحد: { a, b, lines }
  const close = () => {
    if (group) out.push([group.a, group.b, suraFirst[quran.verses[group.b].s]]);
    group = null;
  };
  for (const [a, b, whole] of blocks) {
    const lines = linesOf(quran, a, b);
    if (group && whole) {
      // السورة التي قبل المجموعة في المصحف: تُضمّ إليها إن كان الورد بها أقرب إلى المطلوب
      if (group.lines + lines <= target || group.lines + lines - target < target - group.lines) {
        group = { a, b: group.b, lines: group.lines + lines };
        continue;
      }
    }
    close();
    const parts = chunks(quran, a, b, target);
    if (whole && parts.length === 1) group = { a, b, lines };
    else out.push(...parts.map(([x, y]) => [x, y, x]));
  }
  close();
  return out;
}

// ما يُعدّ محفوظًا قبل البداية في اتجاه الخطة: في المتقدم ما قبلها في المصحف، وفي العكسي السور بعد سورتها
// وأولُ سورتها إلى ما قبلها
export function beforeRanges(quran, dir, start) {
  const { count, suraFirst, suraLast } = index(quran);
  if (dir === 'forward') return start > 0 ? [[0, start - 1]] : [];
  const S = quran.verses[start].s;
  const out = [];
  if (start > suraFirst[S]) out.push([suraFirst[S], start - 1]);
  if (suraLast[S] < count - 1) out.push([suraLast[S] + 1, count - 1]);
  return out;
}

// دمج مقادير متداخلة أو متجاورة، بترتيب المصحف
export function mergeRanges(ranges) {
  const sorted = ranges.filter(([a, b]) => a <= b).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// المحفوظ الآن: ما قبل البداية (إلا «لا أراجع ما قبل البداية») وما حُفظ من الخطة إلى ما قبل next
export function memorizedRanges(quran, k) {
  const out = k.known ? beforeRanges(quran, k.dir, k.start) : [];
  const blocks = planBlocks(quran, k.dir, k.start, k.end);
  if (k.next == null) out.push(...blocks.map(([a, b]) => [a, b]));
  else {
    for (const [a, b] of blocks) {
      if (k.next >= a && k.next <= b) {
        if (k.next > a) out.push([a, k.next - 1]);
        break;
      }
      out.push([a, b]);
    }
  }
  return mergeRanges(out);
}

// المراجعة البعيدة المقترحة: حزب لمن يحفظ أقل من نصف القرآن، وجزء لمن يحفظ نصفه فأكثر (بطلب صاحب المشروع)
export const suggestFar = (quran, ranges) => (linesOfRanges(quran, ranges) * 2 >= totalLines(quran) ? 'juz' : 'hizb');

// ---------- وحدات المراجعة البعيدة ----------
// [أول آية، آخر آية، الاسم] بترتيب المصحف
const unitsCache = new WeakMap();
export function farUnits(quran, unit) {
  let byUnit = unitsCache.get(quran);
  if (!byUnit) unitsCache.set(quran, (byUnit = {}));
  if (byUnit[unit]) return byUnit[unit];
  const { count } = index(quran);
  let starts;
  let name;
  if (unit === 'rub' || unit === 'hizb') {
    const every = unit === 'rub' ? 1 : 4;
    starts = quran.rubs.filter((_, i) => i % every === 0);
    name = (i) => (unit === 'rub' ? rubName(i) : `الحزب ${n(i + 1)}`);
  } else {
    const juz = [];
    quran.verses.forEach((v, i) => {
      if (juz.length < v.j) juz.push(i);
    });
    const every = unit === 'juz' ? 1 : 2;
    starts = juz.filter((_, i) => i % every === 0);
    name = (i) => (unit === 'juz' ? `الجزء ${n(i + 1)}` : `الجزءان ${n(i * 2 + 1)} و${n(i * 2 + 2)}`);
  }
  const out = starts.map((a, i) => [a, (starts[i + 1] ?? count) - 1, name(i)]);
  byUnit[unit] = out;
  return out;
}

// المحفوظ من آيات الوحدة [a, b]
const intersect = (ranges, a, b) => ranges.map(([x, y]) => [Math.max(x, a), Math.min(y, b)]).filter(([x, y]) => x <= y);

// وحدة المراجعة البعيدة الحالية: من الوحدة التي فيها farNext (أو أول الوحدات) بترتيب الخطة، أول وحدة فيها
// محفوظ؛ فإن لم تبقَ وحدة فيها محفوظ عادت إلى أول الدورة. والنتيجة { name, ranges، index } أو null (لا محفوظ)
export function farReview(quran, k, ranges = memorizedRanges(quran, k)) {
  if (!ranges.length) return null;
  const units = farUnits(quran, k.far);
  const order = k.dir === 'forward' ? units.map((_, i) => i) : units.map((_, i) => units.length - 1 - i);
  let from = 0;
  if (k.farNext != null) {
    const at = order.findIndex((i) => units[i][0] <= k.farNext && k.farNext <= units[i][1]);
    if (at >= 0) from = at;
  }
  for (const pass of [order.slice(from), order]) {
    for (const i of pass) {
      const [a, b, name] = units[i];
      const part = intersect(ranges, a, b);
      if (part.length) return { name, ranges: part, unit: i, wrapped: pass === order && from > 0 };
    }
  }
  return null;
}

// المراجعة القريبة: آخر near من الأوراد المحفوظة، بترتيب حفظها (أقدمها أولًا)
export const nearReview = (k) => (k.near > 0 ? (k.recent ?? []).slice(-k.near) : []);

// ---------- الحفظ ----------
export const readHifz = () => readKhatmas().find((x) => x.type === 'hifz') ?? null;
const save = (k) => saveKhatma('hifz', k);

/*
  ختمة الحفظ المحفوظة:
    type 'hifz' · created يوم الإنشاء
    dir 'forward' | 'reverse' · start وend آيتا البداية والنهاية (بترقيم حفص) · known ما قبل البداية محفوظ
    lines الحفظ اليومي بالأسطر · near عدد أوراد المراجعة القريبة · far وحدة المراجعة البعيدة
    next أول آية لم تُحفظ (null إن خُتمت) · recent آخر الأوراد المحفوظة (٢٠ على الأكثر) بترتيب حفظها
    planStart يوم بداية الخطة الحالية · done الأوراد المحفوظة في الخطة الحالية · doneBefore ما قبل آخر تعديل
    lastDone آخر يوم حُفظ فيه ورد · farNext آية تبدأ منها وحدة المراجعة البعيدة التالية
    reviewed { day, near, far }: ما أُتمّ من المراجعتين في يومه · lastFar آخر يوم أُتمّت فيه المراجعة البعيدة
    hintDismissed اقتراح زيادة المراجعة الذي أغلقه المستخدم ('juz') · finished يوم الختم
*/
export function startHifz({ dir, start, end, known, lines, near, far }, today = dayKey()) {
  const k = {
    type: 'hifz',
    created: today,
    dir,
    start,
    end,
    known,
    lines,
    near,
    far,
    next: start,
    recent: [],
    planStart: today,
    done: 0,
    doneBefore: 0,
    lastDone: null,
    farNext: null,
    reviewed: null,
    lastFar: null,
    hintDismissed: null,
    finished: null,
  };
  save(k);
  return k;
}

// تعديل الخطة: الحفظ اليومي والمراجعتان. يُعاد التقسيم من أول آية لم تُحفظ دون أن يضيع ما حُفظ، ويبدأ
// من الغد إن حُفظ ورد اليوم
export function editHifz({ lines, near, far }, today = dayKey()) {
  const k = readHifz();
  if (!k || k.finished) return null;
  const updated = {
    ...k,
    lines,
    near,
    far,
    planStart: k.lastDone === today ? addDays(today, 1) : today,
    doneBefore: k.doneBefore + k.done,
    done: 0,
  };
  save(updated);
  return updated;
}

// إتمام حفظ الورد الحالي: 'next' أو 'finished'
export function completeHifz(quran, today = dayKey()) {
  const k = readHifz();
  if (!k || k.finished) return null;
  const wirds = splitHifz(quran, k.dir, k.next, k.end, k.lines);
  const current = wirds[0];
  if (!current) return null;
  const following = wirds[1];
  const finished = !following;
  save({
    ...k,
    next: following ? following[2] : null,
    recent: [...(k.recent ?? []), current.slice(0, 2)].slice(-MAX_NEAR),
    done: k.done + 1,
    lastDone: today,
    finished: finished ? today : null,
  });
  if (finished) bumpDoneCount('hifz');
  return finished ? 'finished' : 'next';
}

// إتمام المراجعة القريبة أو البعيدة اليوم. والبعيدة تنتقل إلى الوحدة التالية بترتيب الخطة
export function completeReview(quran, kind, today = dayKey()) {
  const k = readHifz();
  if (!k) return null;
  const reviewed = { ...(k.reviewed?.day === today ? k.reviewed : { day: today }), [kind]: true };
  const patch = { reviewed };
  if (kind === 'far') {
    const r = farReview(quran, k);
    if (r) {
      const [a, b] = farUnits(quran, k.far)[r.unit];
      const after = k.dir === 'forward' ? b + 1 : a - 1;
      patch.farNext = after >= 0 && after < quran.verses.length ? after : null;
    }
    patch.lastFar = today;
  }
  save({ ...k, ...patch });
  return 'done';
}

export const dismissHint = (hint) => {
  const k = readHifz();
  if (k) save({ ...k, hintDismissed: hint });
};

export const removeHifz = () => save(null);

// ---------- حال الختمة ----------
export function hifzState(quran, k, today = dayKey()) {
  const wirds = k.finished ? [] : splitHifz(quran, k.dir, k.next, k.end, k.lines);
  const current = wirds[0] ?? null;
  const ranges = memorizedRanges(quran, k);
  const planLines = linesOfRanges(quran, planBlocks(quran, k.dir, k.start, k.end));
  const doneLines = planLines - (k.finished ? 0 : linesOfRanges(quran, planBlocks(quran, k.dir, k.next, k.end)));
  const doneToday = k.lastDone === today;
  const day = daysBetween(k.planStart, today);
  const behind = Math.max(0, day - k.done);
  const ahead = Math.max(0, k.done - (day + 1));
  const end = k.finished ?? addDays(today, doneToday ? wirds.length : wirds.length - 1);
  const reviewed = k.reviewed?.day === today ? k.reviewed : {};
  const near = nearReview(k);
  const far = farReview(quran, k, ranges);
  const memorized = linesOfRanges(quran, ranges);
  // اقتراح زيادة المراجعة البعيدة: تجاوز المحفوظ نصف القرآن ووحدتها دون الجزء (بطلب صاحب المشروع)
  const small = k.far === 'rub' || k.far === 'hizb';
  const suggest = small && memorized * 2 >= totalLines(quran) && k.hintDismissed !== 'juz' ? 'juz' : null;
  // التنبيه على إهمال المراجعة: لم تُتمّ البعيدة منذ ثلاثة أيام فأكثر، وقد حُفظ في الختمة شيء
  const idle = k.lastFar ? daysBetween(k.lastFar, today) : k.doneBefore + k.done > 0 ? daysBetween(k.created, today) : 0;
  return {
    wirds,
    current,
    index: k.doneBefore + k.done + 1,
    total: k.doneBefore + k.done + wirds.length,
    percent: planLines ? Math.floor((doneLines / planLines) * 100) : 100,
    memorized, // أسطر المحفوظ كله (ومعه ما قبل البداية)
    memorizedJuz: Math.floor(memorized / totalLines(quran) * 30 + 1e-9),
    ranges,
    doneToday,
    behind,
    ahead,
    end,
    near,
    far,
    nearDone: !!reviewed.near,
    farDone: !!reviewed.far,
    suggest,
    neglected: !!far && idle >= 3,
    idleDays: idle,
    finished: !!k.finished,
  };
}

// عرض المحفوظ تقريبًا بالأجزاء: «أقل من جزء» · «جزء واحد» · «١٢ جزءا» · «القرآن كله»
export function memorizedText(quran, lines) {
  const total = totalLines(quran);
  if (lines >= total - 1e-6) return 'القرآن كله';
  const juz = Math.floor((lines / total) * 30 + 1e-9);
  return juz < 1 ? 'أقل من جزء' : countText(juz, JUZS, n, true);
}
