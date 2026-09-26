// يستخرج عناصر الشعار البصرية (الكتاب المفتوح، وسطر «حفظ القرآن»)
// من ملف الشعار نفسه، بخلفية شفافة، لتُبنى عليها أيقونة التطبيق.
// الغرض الحفاظ على هوية الشعار الأصلية بدل رسم عنصر جديد يشبهه.
import pkg from 'jimp';
import { mkdir } from 'node:fs/promises';

const Jimp = pkg.default ?? pkg;
const SRC = 'شعار حفظ القرآن بطريقة السلف.jpg';
const OUT = 'public/icons/parts';

await mkdir(OUT, { recursive: true });
const src = await Jimp.read(SRC);
const { width: W, height: H, data } = src.bitmap;

const isOrange = (r, g, b) => r > 200 && g > 100 && g < 190 && b < 110;
const isNavy = (r, g, b) => r < 120 && g < 90 && b > 60 && b < 200;

function bounds(test) {
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (test(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/*
  الشفافية تُشتقّ من بُعد البكسل عن الأبيض، لا من قصٍّ حادّ —
  فتُحفظ نعومة حواف الحروف والمنحنيات بدل أن تصير مسنّنة.
*/
function cut(box, color) {
  const out = new Jimp(box.w, box.h, 0x00000000);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const i = ((y + box.minY) * W + (x + box.minX)) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const alpha = Math.min(255, Math.round(((255 - Math.min(r, g, b)) / 228) * 255));
      if (alpha <= 4) continue;
      const [cr, cg, cb] = color ?? [r, g, b];
      out.bitmap.data[(y * box.w + x) * 4] = cr;
      out.bitmap.data[(y * box.w + x) * 4 + 1] = cg;
      out.bitmap.data[(y * box.w + x) * 4 + 2] = cb;
      out.bitmap.data[(y * box.w + x) * 4 + 3] = alpha;
    }
  }
  return out;
}

const book = bounds(isOrange);
console.log(`الكتاب: ${book.w}×${book.h} عند (${book.minX}, ${book.minY})`);

await cut(book, null).writeAsync(`${OUT}/book-orange.png`);
await cut(book, [255, 255, 255]).writeAsync(`${OUT}/book-white.png`);
await cut(book, [0x1a, 0x01, 0x65]).writeAsync(`${OUT}/book-navy.png`);

// سطر «حفظ القرآن» وحده — النصف الأعلى من كتلة النص الكحلي
const text = bounds(isNavy);
const line1 = {
  minX: text.minX,
  minY: text.minY,
  maxX: text.maxX,
  maxY: Math.round(text.minY + text.h * 0.46),
};
line1.w = line1.maxX - line1.minX + 1;
line1.h = line1.maxY - line1.minY + 1;
console.log(`سطر «حفظ القرآن»: ${line1.w}×${line1.h}`);

await cut(line1, [255, 255, 255]).writeAsync(`${OUT}/line1-white.png`);
await cut(line1, null).writeAsync(`${OUT}/line1-navy.png`);

/*
  الشعار كاملًا مهيَّأً للعرض على خلفية داكنة: النصّ الكحلي يُبدَّل بالأبيض
  ليُقرأ، والكتاب يبقى برتقاليًّا كما هو. ورسم الحروف نفسه لا يُمسّ —
  فيبقى خطّ الشعار وشكله كما صُمّم، ولا يتغير إلا لون النصّ.
  يُستعمل في شاشة الافتتاح لتناسب أيقونة التطبيق الكحلية.
*/
const all = bounds((r, g, b) => isNavy(r, g, b) || isOrange(r, g, b));
const onDark = new Jimp(all.w, all.h, 0x00000000);
for (let y = 0; y < all.h; y++) {
  for (let x = 0; x < all.w; x++) {
    const i = ((y + all.minY) * W + (x + all.minX)) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const alpha = Math.min(255, Math.round(((255 - Math.min(r, g, b)) / 228) * 255));
    if (alpha <= 4) continue;
    // البرتقالي يُعرف بغلبة الأحمر على الأزرق غلبةً بيّنة
    const orangeish = r > 150 && r - b > 60;
    const [cr, cg, cb] = orangeish ? [0xfe, 0x7d, 0x1b] : [255, 255, 255];
    const o = (y * all.w + x) * 4;
    onDark.bitmap.data[o] = cr;
    onDark.bitmap.data[o + 1] = cg;
    onDark.bitmap.data[o + 2] = cb;
    onDark.bitmap.data[o + 3] = alpha;
  }
}
await onDark.writeAsync(`${OUT}/logo-on-dark.png`);
console.log(`الشعار للخلفية الداكنة: ${all.w}×${all.h}`);

console.log('تمّ استخراج العناصر.');
