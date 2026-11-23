// رسم صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١): مواصفة المحتوى (src/lib/shareContent.js) ⇐ صور PNG
// بمقاس ١٠٨٠×١٣٥٠ (طولية، تناسب واتساب والحالات)، مرتّبة بـ src/lib/shareLayout.js.
//
// شكل الصورة:
//   • الألوان من مظهر المستخدم نفسه (خلفية القراءة ولون التطبيق، بقرار صاحب المشروع)، فالداكن يُخرج صورًا داكنة.
//   • في رأسها: عنوان المحتوى («التفسير»…) بلون التطبيق يمينًا، واسم الآية يسارًا، ثم خط.
//   • في الأولى: الآية بخط المصحف (حفص العثماني، أو خط ورش في رواية ورش) في مربع بلون التطبيق الخفيف.
//   • ثم المحتوى بخط صفحات المحتوى (Scheherazade New)، والآيات المقتبسة بلون التطبيق.
//   • في أسفلها: أيقونة التطبيق و«قرآن السلف» يمينًا، ورقم الصورة يسارًا إن كانت أكثر من واحدة («١ / ٣»).
import { MORE_TEXT, STYLES, layoutShare, metrics } from './shareLayout.js';

export const WIDTH = 1080;
export const HEIGHT = 1350;
const PAD_X = 84; // الحاشية من الجانبين
const BAR = 10; // شريط لون التطبيق في أعلى الصورة
const HEAD_Y = 118; // خط عنوان الصورة (منتصفه)
const HEAD_LINE = 178; // الخط تحت الرأس
const BODY_TOP = 222;
const FOOT_LINE = 1212; // الخط فوق الأسفل
const BODY_BOTTOM = FOOT_LINE - 40;
const FOOT_Y = 1282; // منتصف سطر الأسفل
const ICON = 72;
const TAIL = 84; // ارتفاع سطر «التتمة»

const BASE = import.meta.env?.BASE_URL ?? '/';
const FAMILY = {
  content: "'Scheherazade New', 'Amiri', serif",
  ui: "'Amiri', serif",
  hafs: "'UthmanicHafs', 'Traditional Arabic', serif",
  warsh: "'UthmanicWarsh', 'UthmanicHafs', 'Traditional Arabic', serif",
};

const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---------- الألوان ----------
// لون CSS (ومنه ما يُشتق بـ color-mix) ⇐ لون تفهمه لوحة الرسم
function toCanvasColor(c) {
  const m = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(c.trim());
  if (!m) return c;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.round(Math.min(1, Math.max(0, Number(x))) * 255));
  return `rgba(${r}, ${g}, ${b}, ${m[4] ?? 1})`;
}
function cssColor(expr) {
  const el = document.createElement('span');
  el.style.color = expr;
  el.style.display = 'none';
  document.body.append(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return toCanvasColor(c);
}
export function themeColors() {
  return {
    bg: cssColor('var(--bg)'),
    ink: cssColor('var(--ink)'),
    muted: cssColor('var(--ink-muted)'),
    accent: cssColor('var(--accent-text)'),
    accentFill: cssColor('var(--accent)'),
    verseBox: cssColor('var(--accent-soft-strong)'),
    wordBox: cssColor('var(--surface-2)'),
    border: cssColor('var(--border-strong)'),
  };
}

// ---------- الخطوط ----------
const fontOf = (style, px, quran) => {
  const st = STYLES[style];
  return `${st.weight} ${px}px ${st.font === 'quran' ? FAMILY[quran] : FAMILY.content}`;
};

// تُنتظر الخطوط قبل القياس والرسم (وإلا قيس بخط بديل)، بالحروف المستعملة نفسها (الخطوط مقسومة بحسب الحروف)
async function loadFonts(spec, quran) {
  const text = [spec.title, spec.ref, spec.credit ?? '', MORE_TEXT, 'قرآن السلف ٠١٢٣٤٥٦٧٨٩ /', JSON.stringify(spec.units)].join(' ');
  const jobs = [
    `400 40px ${FAMILY.content}`,
    `700 40px ${FAMILY.content}`,
    `400 40px ${FAMILY.ui}`,
    `700 40px ${FAMILY.ui}`,
  ].map((f) => document.fonts.load(f, text));
  const quranText = [spec.verse ?? '', ...spec.units.filter((u) => u.type === 'pair').map((u) => u.word)].join(' ');
  if (quranText.trim()) jobs.push(document.fonts.load(`400 40px ${FAMILY[quran]}`, quranText));
  await Promise.all(jobs.map((j) => j.catch(() => null)));
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ---------- الرسم ----------
// كلمة (أجزاء بأنماطها) من حافتها اليمنى x
function drawWord(ctx, word, x, y, px, colors, quran) {
  let right = x;
  for (const part of word) {
    const st = STYLES[part.s];
    ctx.font = fontOf(part.s, px[st.size], quran);
    ctx.fillStyle = colors[st.color];
    ctx.fillText(part.t, right, y);
    right -= ctx.measureText(part.t).width;
  }
}

function drawLine(ctx, words, right, y, { space, extra = 0, px, colors, quran }) {
  let x = right;
  for (const w of words) {
    drawWord(ctx, w, x, y, px, colors, quran);
    let width = 0;
    for (const part of w) {
      ctx.font = fontOf(part.s, px[STYLES[part.s].size], quran);
      width += ctx.measureText(part.t).width;
    }
    x -= width + space + extra;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPage(ctx, { spec, layout, page, index, count, colors, quran, icon }) {
  const m = metrics(layout.size);
  const px = m.size;
  const width = WIDTH - 2 * PAD_X;
  const right = WIDTH - PAD_X;
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // الخلفية وشريط لون التطبيق
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = colors.accentFill;
  ctx.fillRect(0, 0, WIDTH, BAR);

  // الرأس: العنوان يمينًا واسم الآية يسارًا
  ctx.font = `700 46px ${FAMILY.ui}`;
  ctx.fillStyle = colors.accent;
  ctx.fillText(spec.title, right, HEAD_Y);
  ctx.font = `400 40px ${FAMILY.ui}`;
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'left';
  ctx.fillText(spec.ref, PAD_X, HEAD_Y);
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.border;
  ctx.fillRect(PAD_X, HEAD_LINE, width, 2);

  // المتن: في وسط المساحة إن كانت صورة واحدة
  const bodyH = BODY_BOTTOM - BODY_TOP;
  const top = BODY_TOP + (layout.single ? Math.max(0, Math.round((bodyH - page.height) / 2)) : 0);
  const space = (style) => {
    ctx.font = fontOf(style, px[STYLES[style].size], quran);
    return ctx.measureText(' ').width;
  };

  for (const el of page.els) {
    const y0 = top + el.y;
    if (el.kind === 'verse') {
      ctx.fillStyle = colors.verseBox;
      roundRect(ctx, PAD_X, y0, width, el.h, 22);
      ctx.fill();
      el.lines.forEach((line, i) => {
        const cy = y0 + el.pad + i * el.lh + el.lh / 2;
        drawLine(ctx, line.words, WIDTH / 2 + line.width / 2, cy, { space: space('verse'), px, colors, quran });
      });
    } else if (el.kind === 'line') {
      const u = el.unit;
      const cy = y0 + el.h / 2;
      const avail = width - el.indent;
      let r = right - el.indent;
      if (u.align === 'center') r = WIDTH / 2 + el.width / 2;
      const gaps = el.words.length - 1;
      const extra = el.justify && gaps > 0 ? (avail - el.width) / gaps : 0;
      const first = el.words[0]?.[0]?.s ?? 'text';
      drawLine(ctx, el.words, r, cy, { space: space(first), extra, px, colors, quran });
      if (u.bullet && el.first) {
        ctx.fillStyle = colors.accentFill;
        ctx.beginPath();
        ctx.arc(right - m.bulletIndent * 0.35, cy + px.text * 0.08, px.text * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      if (u.bar) {
        ctx.fillStyle = colors.accentFill;
        // متصل من أول سطر التوجيه إلى آخره
        const t = el.first ? el.h * 0.14 : 0;
        const b = el.last ? el.h * 0.14 : 0;
        ctx.fillRect(right - 6, y0 + t, 6, el.h - t - b);
      }
    } else if (el.kind === 'pair') {
      // الكلمة في عمود يمين بخلفية خفيفة، ومعناها يساره، وبين الأسطر خط
      if (!el.top) {
        ctx.fillStyle = colors.border;
        ctx.fillRect(PAD_X, y0, width, 2);
      }
      ctx.fillStyle = colors.wordBox;
      ctx.fillRect(right - el.wordW, y0 + (el.top ? 0 : 2), el.wordW, el.h - (el.top ? 0 : 2));
      const wordH = el.wordLines.length * el.lhWord;
      el.wordLines.forEach((line, i) => {
        const cy = y0 + (el.h - wordH) / 2 + i * el.lhWord + el.lhWord / 2;
        drawLine(ctx, line.words, right - el.wordW / 2 + line.width / 2, cy, { space: space('word'), px, colors, quran });
      });
      const textH = el.meaningLines.length * el.lhText;
      const mr = right - el.wordW - m.pairGap;
      el.meaningLines.forEach((line, i) => {
        const cy = y0 + (el.h - textH) / 2 + i * el.lhText + el.lhText / 2;
        drawLine(ctx, line.words, mr, cy, { space: space('text'), px, colors, quran });
      });
    } else if (el.kind === 'rule') {
      ctx.fillStyle = colors.border;
      const w = width * 0.3;
      ctx.fillRect(WIDTH / 2 - w / 2, y0 + el.h / 2 - 1, w, 2);
    } else if (el.kind === 'tail') {
      ctx.font = `700 40px ${FAMILY.ui}`;
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'center';
      ctx.fillText(`${MORE_TEXT} …`, WIDTH / 2, y0 + el.h / 2 + 6);
      ctx.textAlign = 'right';
    }
  }

  // الأسفل: الأيقونة واسم التطبيق يمينًا، ورقم الصورة يسارًا
  ctx.fillStyle = colors.border;
  ctx.fillRect(PAD_X, FOOT_LINE, width, 2);
  if (icon) {
    ctx.save();
    roundRect(ctx, right - ICON, FOOT_Y - ICON / 2, ICON, ICON, 16);
    ctx.clip();
    ctx.drawImage(icon, right - ICON, FOOT_Y - ICON / 2, ICON, ICON);
    ctx.restore();
  }
  ctx.font = `700 44px ${FAMILY.ui}`;
  ctx.fillStyle = colors.ink;
  ctx.fillText('قرآن السلف', right - (icon ? ICON + 22 : 0), FOOT_Y + 4);
  if (count > 1) {
    ctx.font = `400 38px ${FAMILY.ui}`;
    ctx.fillStyle = colors.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`${ar(index + 1)} / ${ar(count)}`, PAD_X, FOOT_Y + 4);
  }
  ctx.restore();
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));

/*
  buildShareImages(spec, { warsh }) ⇐ { images: [Blob], truncated }
  warsh: نص الآيات برسم ورش (خطّه)
*/
export async function buildShareImages(spec, { warsh = false } = {}) {
  const quran = warsh ? 'warsh' : 'hafs';
  await loadFonts(spec, quran);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  const measure = (text, style, px) => {
    ctx.font = fontOf(style, px, quran);
    return ctx.measureText(text).width;
  };
  const layout = layoutShare(spec, measure, { width: WIDTH - 2 * PAD_X, height: BODY_BOTTOM - BODY_TOP, tail: TAIL });
  const [colors, icon] = [themeColors(), await loadImage(`${BASE}icons/icon-192.png`)];
  const images = [];
  for (let i = 0; i < layout.pages.length; i++) {
    drawPage(ctx, { spec, layout, page: layout.pages[i], index: i, count: layout.pages.length, colors, quran, icon });
    images.push(await toBlob(canvas));
  }
  return { images, truncated: layout.truncated };
}
