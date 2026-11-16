// الخطوة ١٦: تفسير الطبري («جامع البيان عن تأويل آي القرآن») — ٢٠٢٦-١١-١٦
//
// المصدر: مشروع المصحف الإلكتروني «آيات» بجامعة الملك سعود (quran.ksu.edu.sa)، آيةً آية بالمؤلف «tabary»
// (الجلب في scripts/data/ksu.mjs، ويُحفظ في .cache/ksu/tabary). والنسخة طبعة مؤسسة الرسالة بتحقيق أحمد ومحمود
// شاكر. والناتج ملف لكل سورة في public/data/tafsir/tabary، يحمّله المستخدم بزرّ في قائمة التفاسير.
//
// النص كاملًا بأسانيده، وتُحذف تعليقات المحقق وأرقامها (بقرار صاحب المشروع):
//   • أرقام التعليقات في النص: <span class="t3">(34)</span>، وقد تأتي بلا وسم («السَّـفَرُ (113)»).
//   • نصوص التعليقات: بعد سطر شَرَطات («----------») أو «الهوامش:»، كل تعليق فقرة تبدأ برقمه، وقد يمتد التعليق
//     فقرات (أبيات شعر، أو كلام على الإسناد). وأكثرها في آخر جواب الآية؛ فإن عاد كلام الطبري بعدها في الجواب
//     نفسه فبعنوانه «القول في تأويل قوله…» (فُحص الجواب كله: لم يعد كلامه بعدها بغير هذا العنوان).
//   • تعليقات بلا سطر الشرطات في أول الجواب أحيانًا، لأرقام في جواب الآية قبلها: فقرة تبدأ برقم مرّ في النص قريبًا.
//
// وسوم النسخة (وتختلف طريقة كتابة الآيات بين أجزاء الطبعة):
//   <span class="t3">( … )</span> اقتباس آية، أو رقم تعليق
//   <span class="t4">{ … }</span> اقتباس آية
//   <span class="t1">" … "</span> نصّ منقول: كلمة يفسّرها، أو قول، أو جزء من الآية
//   <span class="t2">[ … ]</span> عزو آية («[سورة البقرة: 102]») أو زيادة
// وما طابق المصحف من الاقتباسات يُكتب بقوسي الآية ﴿…﴾ فيظهر بلون التطبيق (أدوات المطابقة من الخطوة ١٥)،
// وكذا الآية المكتوبة بلا قوسين في العناوين («القول في تأويل قوله تعالى: وَإِذَا قِيلَ لَهُمْ…»)، والمشكولة
// داخل الكلام. وما لم يطابق يبقى كما هو.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchAll, QURAN, writeSplit } from './ksu.mjs';
import { fixQuotes, fixSquare, fixStray, normWord, quranIndex, unbalanced, wholeVerse } from './15-katheer.mjs';

const AR = '؀-ۿ';
// أقل عدد كلمات يُعدّ به النص المنقول بين علامتي التنصيص آية (الكلمة والكلمتان تطابقان المصحف بالمصادفة كثيرًا:
// «الحمد لله» في حديث، «قال» في شرح)
const MIN_QUOTE = 3;

// ---------- تعليقات المحقق ----------

const MARK = /<span class="t\d">\s*\(\s*(\d+)\s*\)\s*<\/span>/g;
const NOTE = /^\s*(?:<span class="t3">)?\s*\(\s*(\d+)\s*\)/;
const plain = (p) => p.replace(/<[^>]+>/g, '').trim();
// سطر الشرطات وحده، أو معه «الهوامش:»، أو «الهوامش:» وحدها
const HEAD = /^-{4,}\s*(?:الهوامش\s*:?)?$|^الهوامش\s*:?$/;
const RESUME = /^القول في تأويل/;

// فقرات الجواب (HTML كل فقرة)
export function paras(raw) {
  const i = raw.indexOf('|||');
  if (i < 0) throw new Error('جواب بلا فاصل «|||»');
  return raw
    .slice(i + 3)
    .replace(/<br\s*\/?>/gi, ' ')
    .split(/<\/p>\s*<p[^>]*>|<p[^>]*>|<\/p>/i)
    .filter((p) => p.trim());
}

// فقرات كلام الطبري، بلا تعليقات المحقق. recent: أرقام التعليقات التي مرّت في الآيات القريبة قبلها (تُحدَّث)
export function dropNotes(ps, recent = new Set(), stats = {}) {
  const out = [];
  let notes = false;
  let prev = '';
  for (const p of ps) {
    const t = plain(p);
    // عنوان بعد «يتلوه في الجزء السابع…» في تعليق المحقق على آخر جزء من المخطوطة: من التعليق (النساء ٣٠)
    const quoted = /يتلوه/.test(prev);
    prev = t;
    if (HEAD.test(t)) {
      notes = true;
      continue;
    }
    if (notes) {
      if (!RESUME.test(t) || quoted) {
        stats.notes = (stats.notes ?? 0) + 1;
        continue;
      }
      notes = false;
    }
    // تعليق بلا سطر الشرطات: فقرة تبدأ برقم مرّ في النص (وفقرة الكلام قد تبدأ برقم تعليقها هي، وهو جديد)
    const m = p.match(NOTE);
    if (m && recent.has(+m[1]) && t.replace(/^\(\s*\d+\s*\)/, '').trim()) {
      notes = true;
      stats.notes = (stats.notes ?? 0) + 1;
      continue;
    }
    for (const [, n] of p.matchAll(MARK)) recent.add(+n);
    // سطر الشرطات في وسط الفقرة («… ظالمًا. ----------الهوامش: (15) …»): ما بعده تعليقات
    const cut = p.search(/-{4,}/);
    if (cut >= 0) {
      notes = true;
      stats.notes = (stats.notes ?? 0) + 1;
      if (plain(p.slice(0, cut))) out.push(p.slice(0, cut));
      continue;
    }
    out.push(p);
  }
  return out;
}

// ---------- الآيات ----------

// كلمة مشكولة (فيها حركة) بلا تطويل (الشعر يُكتب بالتطويل: «أمــيرُ»)، وفي وسط المتوالية كلمة قصيرة بلا شكل
// («وَاللَّهُ لا يَهْدِي»: «لا» و«من» و«في» تُكتب في الطبعة بلا شكل)
const voweled = (w) => /[ً-ْ]/.test(w) && !/ـ/.test(w) && /^[ء-يً-ٰٟۖ-ۭ]+$/.test(w);
const joins = (w) => voweled(w) || /^[ء-ي]{1,3}$/.test(w);
// الآية المكتوبة بلا قوسين: أطول متوالية من الكلمات المشكولة (كلمتان فأكثر) تطابق المصحف
export function markVoweled(Q, s, stats = {}) {
  // بيت شعر بشطريه («حَسِبْتُ بُغامَ رَاحِلَتِي عنَاقا ... ومَا هِيَ …») لا تُطلب فيه آية
  if (s.includes(' ... ')) return s;
  return s
    .split(/(﴿[^﴾]*﴾|"[^"]*")/)
    .map((part, k) => {
      if (k % 2) return part;
      const ws = part.split(/( +)/);
      const out = [];
      for (let i = 0; i < ws.length; ) {
        if (i % 2 || !voweled(ws[i])) {
          out.push(ws[i++]);
          continue;
        }
        let j = i;
        while (j + 2 < ws.length && joins(ws[j + 2])) j += 2;
        // أطول ما يطابق المصحف من أول المتوالية (وآخرها كلمة مشكولة)، ثم ما بعده
        let done = false;
        for (let e = j; e > i; e -= 2) {
          if (!voweled(ws[e])) continue;
          const run = ws.slice(i, e + 1).join('');
          if (wholeVerse(Q, run)) {
            stats.voweled = (stats.voweled ?? 0) + 1;
            out.push(`﴿${run}﴾`);
            i = e + 1;
            done = true;
            break;
          }
        }
        if (!done) out.push(ws[i++]);
      }
      return out.join('');
    })
    .join('');
}

// عنوان الطبري «القول في تأويل قوله تعالى: <الآية>» والآية وحدها في فقرة («الْحَمْدُ لِلَّهِ :»): الآية ﴿…﴾
export function markHeading(Q, s, stats = {}) {
  const m = s.match(/^(القول في تأويل قوله[^:]*:\s*|)(.*?)\s*[.:]?$/);
  if (!m || /[﴿"(]/.test(m[2])) return s;
  if (!wholeVerse(Q, m[2])) return s;
  stats.heading = (stats.heading ?? 0) + 1;
  return `${m[1].replace(/\s*:\s*$/, ': ')}﴿${m[2]}﴾`;
}

// النص المنقول بين علامتي التنصيص: آية إن طابق المصحف وكان ثلاث كلمات فأكثر
function quote(Q, inner, stats) {
  const t = inner.trim().replace(/^"\s*/, '').replace(/\s*"$/, '');
  if (t.split(/\s+/).filter((w) => normWord(w)).length >= MIN_QUOTE && wholeVerse(Q, t)) {
    stats.quoted = (stats.quoted ?? 0) + 1;
    return `﴿${t}﴾`;
  }
  return /^".*"$/s.test(inner.trim()) ? `"${t}"` : inner.trim();
}

// ---------- ما سقط من النسخة ----------

// نص المصدر لأطول التفاسير مقطوع عند حدّ تخزين ثابت (نحو ٦٤ ألف بايت)، فينقطع أحيانًا وسط كلمة (البقرة ٣٠
// و١٨٧ و٢٨٢، والمائدة ٣، والإسراء ١، …)، وكذا في Quran.com لأنه من القاعدة نفسها. وما سقط أُكمل من الطبعة نفسها
// في الشاملة (الكتاب 43، ط دار التربية والتراث بتحقيق شاكر)، من الحقل «النص» بلا الحواشي، محفوظًا في
// scripts/data/tabary-supplement.json: لكل آية cutAt (عبارة من نص المصدر يُحذف منها إلى آخره) وtext (الجملة نفسها
// من الشاملة إلى آخر كلامه على الآية، فقرةً في كل سطر) وpages (صفحات الشاملة).
export const SUPPLEMENT_FILE = 'scripts/data/tabary-supplement.json';

// سطر من الشاملة بصورة جواب المصدر: بلا أرقام الحواشي («(١)»)، والاقتباسات في الوسوم نفسها لتمرّ بالتنظيف نفسه
export function shamelaHtml(line) {
  return line
    .replace(/\s*\(\s*[٠-٩\d]+\s*\)/g, '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/ﷺ/g, 'صلى الله عليه وسلم')
    .replace(/﵁/g, 'رضي الله عنه')
    .replace(/"([^"]+)"/g, '<span class="t1">"$1"</span>')
    .replace(/\(([^()<>]+)\)/g, '<span class="t3">($1)</span>')
    .trim();
}

// الجواب الخام مُكمَلًا بما سقط منه
export function applySupplement(raw, sup) {
  if (!sup?.text) return raw;
  const i = raw.lastIndexOf(sup.cutAt);
  if (i < raw.indexOf('|||') || !sup.cutAt) throw new Error(`لم يوجد موضع الإكمال: ${sup.cutAt}`);
  const lines = sup.text.split('\n').map(shamelaHtml).filter(Boolean);
  return `${raw.slice(0, i)}</p>${lines.map((l) => `<p>${l}</p>`).join('')}`;
}

// ---------- التنظيف ----------

// فقرات الحديث في الأجزاء التي لا فقرات فيها («… الجماع. 2397 - حدثنا …»، «* - حدثني …» طريق آخر له)
const HADITH = /\s+(?=(?:\d{1,5}|\*) ?- ?(?:و?حد[ّ]?ث|وحُدِّثت|أخبر|ثنا|حُدِّثت))/g;

// نص تفسير آية من فقرات كلام الطبري (بعد dropNotes)، مصدَّرة لتختبرها tests/unit/data.test.js
export function cleanTabary(Q, ps, stats = {}) {
  const names = Q.names;
  return ps
    .map((html) => {
      let s = html
        // أرقام التعليقات (بوسم أو بلا وسم)
        .replace(MARK, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/‏/g, '');
      // الوسوم من الداخل إلى الخارج
      const span = /<span class="t(\d)">((?:(?!<span)[\s\S])*?)<\/span>/g;
      while (span.test(s)) {
        s = s.replace(span, (_, k, t) => {
          if (k === '4') return fixQuotes(Q, `(${t.replace(/^\s*\{\s*|\s*\}\s*$/g, '')})`, stats);
          if (k === '3') return /^\s*\(/.test(t) ? fixQuotes(Q, t, stats) : t.trim();
          if (k === '1') return quote(Q, t, stats);
          return t.replace(/^\s*\[\s*/, '[').replace(/\s*\]\s*$/, ']').trim();
        });
      }
      s = s
        .replace(/<[^>]+>/g, '')
        // اقتباس الآية بين قوسين معقوصين خارج الوسوم («قوله: { ولا فسوق }»)
        .replace(/\{([^{}]*)\}/g, (_, t) => fixQuotes(Q, `(${t.trim()})`, stats))
        // رقم تعليق بلا وسم، ورقم الآية في العنوان أو الاقتباس («قاموا ( 19 ) )»)
        .replace(/\s*\(\s*[\d٠-٩]+\s*\)/g, '')
        // الآية بين قوسين بلا وسم («نظير معنى قوله: (إياك نستعين)»)، كلمتين فأكثر
        .replace(/\(([^()﴿﴾]+)\)/g, (m, t) => {
          if (t.trim().split(/\s+/).length < 2 || !wholeVerse(Q, t.trim())) return m;
          stats.whole = (stats.whole ?? 0) + 1;
          return `﴿${t.trim()}﴾`;
        })
        // رقم الصفحة في الطبعة («ص[ 1-169 ]»، «&; 24-218 &;»)
        .replace(/\s*ص\[\s*\d+\s*-\s*\d+\s*\]\s*/g, ' ')
        .replace(/\s*\[ص:\s*\d+(?:\s*-\s*\d+)?\]\s*/g, ' ')
        .replace(/\s*&;\s*\d+\s*-\s*\d+\s*&;\s*/g, ' ')
        // وبقايا هذه العلامة مكسورةً («صلى الله &;عليه وسلم»، «تزعمون, 189 &; لا يعلم»)
        .replace(/\s*(?:\d+\s*)?(?:&\s*)+;\s*/g, ' ')
        .replace(/[ \t  ]+/g, ' ')
        .trim();
      return s;
    })
    // الفاصل «* * *» (بين الفقرات خط فاصل في التطبيق)، والأسطر الخالية، وسطر النقاط
    // الفاصل «* * *» داخل الفقرة يقسمها
    .flatMap((s) => s.split(/\s*\* \* \*\s*/))
    .filter((s) => s && !/^[*\s.]+$/.test(s))
    .flatMap((s) => (s.length > 600 ? s.split(HADITH) : [s]))
    .map((p) =>
      markVoweled(Q, markHeading(Q, fixSquare(names, fixStray(Q, p.trim(), stats), stats), stats), stats)
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?, ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1، ')
        .replace(new RegExp(`([${AR}\\])﴾»")]) ?; ?(?=[${AR}\\[﴿«"(])`, 'g'), '$1؛ ')
        .replace(/ ([،؛:.؟!])(?!\.)/g, '$1')
        .replace(new RegExp(`([،؛:؟!])(?=[${AR}﴿«("])`, 'g'), '$1 ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const quran = JSON.parse(await readFile(QURAN, 'utf8'));
  const Q = quranIndex(quran);
  const raws = await fetchAll('tabary', quran);
  const supplement = JSON.parse(await readFile(SUPPLEMENT_FILE, 'utf8'));

  const stats = {};
  let recent = new Set();
  const verses = raws.map((raw, i) => {
    if (quran.verses[i].a === 1) recent = new Set();
    const sup = supplement[`${quran.verses[i].s}:${quran.verses[i].a}`];
    if (sup?.text) stats.supplemented = (stats.supplemented ?? 0) + 1;
    return cleanTabary(Q, dropNotes(paras(applySupplement(raw, sup)), recent, stats), stats);
  });
  const ref = (i) => `${quran.verses[i].s}:${quran.verses[i].a}`;
  // الآية التي جوابها نص الآية قبلها نفسه (يفسّر الطبري الآيات مجموعاتٍ): بلا كلام خاص بها
  let repeated = 0;
  for (let i = verses.length - 1; i > 0; i--) {
    if (verses[i] && verses[i] === verses[i - 1]) {
      verses[i] = '';
      repeated++;
    }
  }
  const empty = verses.map((t, i) => (t ? null : ref(i))).filter(Boolean);
  const leftover = verses.map((t, i) => (/[<>{}]|&[a-z]+;|\(\s*\d+\s*\)|الهوامش/.test(t) ? ref(i) : null)).filter(Boolean);
  const odd = verses.map((t, i) => (unbalanced(t) ? ref(i) : null)).filter(Boolean);
  const bytes = await writeSplit('tabary', quran, verses);

  console.log('═══ تقرير تفسير الطبري ═══');
  console.log(`الآيات: ${verses.length} · بلا تفسير: ${empty.length} (منها تكرار لما قبلها ${repeated}) ${empty.slice(0, 60).join(' ')}`);
  console.log(`آيات أُكمل ما سقط منها من الشاملة: ${stats.supplemented ?? 0}`);
  console.log(`فقرات تعليقات المحقق المحذوفة: ${stats.notes ?? 0}`);
  console.log(`الآيات ﴿…﴾: اقتباسات بقوسين ${stats.whole ?? 0} · أُصلحت أقواسها ${(stats.closedAfter ?? 0) + (stats.openedBefore ?? 0) + (stats.reversed ?? 0)} · بين علامتي التنصيص ${stats.quoted ?? 0} · في العناوين ${stats.heading ?? 0} · مشكولة بلا قوسين ${stats.voweled ?? 0} · بقيت بقوسيها ${stats.kept ?? 0}`);
  console.log(`نصوص فيها بقايا وسوم أو أرقام تعليقات: ${leftover.length} ${leftover.slice(0, 40).join(' ')}`);
  console.log(`نصوص أقواسها غير متوازنة: ${odd.length} ${odd.slice(0, 60).join(' ')}`);
  console.log(`حجم الملفات الناتجة: ${bytes} بايت → public/data/tafsir/tabary (اكتبه في src/data/tafsirs.js)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
