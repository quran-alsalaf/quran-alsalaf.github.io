// يولّد أيقونات التطبيق: خلفية ملوّنة تملأ المربع بالكامل، وعليها
// الكتاب المفتوح مستخرجًا من الشعار نفسه ومثخَّنًا ليُقرأ ككتاب.
//
// لماذا لا يُستعمل الشعار كاملًا أيقونةً: نصّه سطران، ويستحيل قراءتهما
// بحجم ٦٠ بكسل على شاشة الجوال، فتبدو الأيقونة باهتة بين غيرها.
// أما الشعار كاملًا فيبقى في شاشة الافتتاح حيث المساحة تكفي لقراءته.
//
// ولماذا يُثخَّن الكتاب: شكله في الشعار نسبته ٤٫٦:١، أي عريض قصير
// بصفحتين رفيعتين، فيُقرأ من بعيد كعلامة أو سهم لا ككتاب. والتثخين
// يردّ نسبته إلى ٢٫٧:١ تقريبًا فتظهر الصفحتان منفصلتين ويعمق الانفراج.
import pkg from 'jimp';
import { mkdir } from 'node:fs/promises';

const Jimp = pkg.default ?? pkg;
const PARTS = 'public/icons/parts';
const OUT = 'public/icons';

const VARIANTS = {
  navy: { bg: [0x1a, 0x01, 0x65], ink: [0xfe, 0x7d, 0x1b], mark: 'book-orange.png' },
  blue: { bg: [0x00, 0x96, 0xe3], ink: [0xff, 0xff, 0xff], mark: 'book-white.png' },
};

const ACTIVE = process.env.ICON_VARIANT || 'navy';

// درجة التثخين المعتمدة (الدرجة «هـ»)
const STRETCH = 1.6;
const DILATE = 9;

/*
  مقاس الكتاب داخل الأيقونة:
   ٠٫٨٢ للأيقونات العادية
   ٠٫٧٠ للنسخة القابلة للقص — بعد التثخين صار الكتاب أطول، فلو بقي
        على مقاسه السابق لاقترب ركناه من حدّ دائرة الأمان (٨٠٪ من العرض)
        التي يقصّ أندرويد خارجها
*/
const SIZES = [
  { name: 'icon-192.png', size: 192, mark: 0.82 },
  { name: 'icon-512.png', size: 512, mark: 0.82 },
  { name: 'apple-touch-icon.png', size: 180, mark: 0.82 },
  { name: 'icon-maskable-512.png', size: 512, mark: 0.7 },
  { name: 'favicon-64.png', size: 64, mark: 0.84 },
];

// يوسّع الشكل رأسيًّا: شفافية كل بكسل تصير أعلى شفافية في عمود حوله
function dilateVertical(img, radius, ink) {
  if (radius <= 0) return img;
  const { width: w, height: h, data } = img.bitmap;
  const out = img.clone();
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let best = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        const a = data[(yy * w + x) * 4 + 3];
        if (a > best) best = a;
      }
      const o = (y * w + x) * 4;
      out.bitmap.data[o] = ink[0];
      out.bitmap.data[o + 1] = ink[1];
      out.bitmap.data[o + 2] = ink[2];
      out.bitmap.data[o + 3] = best;
    }
  }
  return out;
}

async function thickenedBook(variant) {
  const v = VARIANTS[variant];
  let book = await Jimp.read(`${PARTS}/${v.mark}`);

  // هامش قبل المطّ لئلا تُقصّ الحواف بعد التوسيع
  const padded = new Jimp(book.bitmap.width, Math.round(book.bitmap.height * 1.9), 0x00000000);
  padded.composite(book, 0, Math.round((padded.bitmap.height - book.bitmap.height) / 2));
  book = padded;
  book.resize(book.bitmap.width, Math.round(book.bitmap.height * STRETCH), Jimp.RESIZE_BICUBIC);

  book = dilateVertical(book, DILATE, v.ink);
  book.autocrop({ cropOnlyFrames: false, tolerance: 0.002 });
  return book;
}

async function buildIcon(book, variant, size, markRatio, outPath) {
  const v = VARIANTS[variant];
  const canvas = new Jimp(size, size, Jimp.rgbaToInt(v.bg[0], v.bg[1], v.bg[2], 255));

  const w = Math.round(size * markRatio);
  const h = Math.round((w * book.bitmap.height) / book.bitmap.width);
  const fitted = book.clone().resize(w, h, Jimp.RESIZE_BICUBIC);

  canvas.composite(fitted, Math.round((size - w) / 2), Math.round((size - h) / 2));
  await canvas.writeAsync(outPath);
  return { w, h };
}

await mkdir(OUT, { recursive: true });

const book = await thickenedBook(ACTIVE);
const ratio = (book.bitmap.width / book.bitmap.height).toFixed(2);
console.log(`الكتاب بعد التثخين: ${book.bitmap.width}×${book.bitmap.height} — نسبته ${ratio}:1`);

for (const { name, size, mark } of SIZES) {
  const { w, h } = await buildIcon(book, ACTIVE, size, mark, `${OUT}/${name}`);
  console.log(`  ✓ ${name} (${size}×${size}) — الكتاب ${w}×${h}`);
}

console.log(`\nالتصميم المعتمد: ${ACTIVE}`);
