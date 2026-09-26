// البحث الرئيسي في المصحف (الفصل ٨ من المواصفة): في النص الإملائي للآيات،
// وفي أسماء السور.
//
// النص الإملائي أسهل على الكاتب من الرسم العثماني. ويُطبَّع الطرفان — نصّ الآيات
// وما يكتبه المستخدم — تطبيعًا واحدًا، فيجد «الرحمن» ولو كتبه بلا همزة، أو كتب
// «الرحمه» بالهاء، أو «على» بالياء.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalizeArabic(s) {
  return (s || '')
    .normalize('NFC')
    .replace(DIACRITICS, '')
    .replace(/[ٱأإآ]/g, 'ا') // ٱ أ إ آ ← ا
    .replace(/ى/g, 'ي') // ى ← ي
    .replace(/ة/g, 'ه') // ة ← ه
    .replace(/ؤ/g, 'و') // ؤ ← و
    .replace(/ئ/g, 'ي') // ئ ← ي
    .replace(/[^ء-ي0-9٠-٩ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchIndex(quran) {
  return {
    verses: quran.verses.map((v, i) => ({ i, key: normalizeArabic(v.e) })),
    suras: quran.suras.map((s) => ({ n: s.n, key: normalizeArabic(s.name) })),
  };
}

// الآية تُطابق إن احتوت كل كلمات البحث (بأي ترتيب)، والنتائج بترتيب المصحف
export function search(index, query, limit = 50) {
  const q = normalizeArabic(query);
  if (q.length < 2) return { suras: [], verses: [], total: 0 };

  const bare = q.replace(/^سوره /, '');
  const suras = index.suras.filter((s) => s.key.includes(bare)).map((s) => s.n);

  const terms = q.split(' ');
  const hits = [];
  for (const v of index.verses) {
    if (terms.every((t) => v.key.includes(t))) hits.push(v.i);
  }
  return { suras, verses: hits.slice(0, limit), total: hits.length };
}
