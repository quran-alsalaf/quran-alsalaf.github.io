// الأسئلة الشائعة في «المساعدة والتواصل» (٢٠٢٦-١١-٢٤): النصوص المعتمدة، وأن كل اسم مكان مذكور في الأجوبة
// موجود في واجهة التطبيق حرفًا بحرف، وأن سؤال التذكير في التطبيق الأصلي وحده — src/lib/faq.js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ, faqFor } from '../../src/lib/faq.js';

const all = FAQ.flatMap((s) => s.items);

// نصوص الواجهة كلها: المكوّنات وApp.jsx والمكتبات
const dir = join(process.cwd(), 'src');
const ui = [
  ...readdirSync(join(dir, 'components')).filter((f) => f.endsWith('.jsx')).map((f) => join(dir, 'components', f)),
  ...readdirSync(join(dir, 'lib')).filter((f) => f.endsWith('.js') && f !== 'faq.js').map((f) => join(dir, 'lib', f)),
  join(dir, 'App.jsx'),
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// أسماء الأماكن في الجواب: ما بين «» وأجزاء المسارات بـ«←»
function places(a) {
  const quoted = [...a.matchAll(/«([^»]+)»/g)].map((m) => m[1]);
  const path = a.includes('←')
    ? a
        .split(/[.:،]/)
        .filter((p) => p.includes('←'))
        .flatMap((p) => p.split('←'))
        .map((p) => p.trim().replace(/^(?:بعدها من|تجده في|من) /, ''))
        .filter((p) => p && !p.includes('«'))
    : [];
  return [...quoted, ...path];
}

describe('الأسئلة الشائعة', () => {
  it('خمسة أقسام بالترتيب المعتمد و١٤ سؤالًا، بلا سؤال مصادر المحتوى', () => {
    expect(FAQ.map((s) => s.title)).toEqual(['القراءة والمصحف', 'الاستماع', 'الختمة والحفظ', 'بياناتي', 'عامة']);
    expect(all).toHaveLength(14);
    expect(all.some((i) => i.q.includes('من أين المحتوى'))).toBe(false);
    expect(new Set(all.map((i) => i.q)).size).toBe(all.length);
    for (const i of all) {
      expect(i.q.endsWith('؟')).toBe(true);
      expect(i.a.length).toBeGreaterThan(10);
    }
  });

  it('سؤال «العمل بالآيات» ومعاني الكلمات: المحتوى يكتمل في التحديثات القادمة، بلا عدد', () => {
    const i = all.find((x) => x.q.includes('«العمل بالآيات»'));
    expect(i.q).toContain('«معاني الكلمات»');
    expect(i.a).toContain('التحديثات القادمة');
    expect(i.a).not.toMatch(/[0-9٠-٩]/);
  });

  it('كل اسم مكان في الأجوبة موجود في واجهة التطبيق حرفًا بحرف', () => {
    const names = all.flatMap((i) => places(i.a));
    expect(names).toEqual(expect.arrayContaining(['الإعدادات التخصيصية', 'الرواية', 'النسخ الاحتياطي', 'دليل التطبيق', 'تعديل الخطة']));
    for (const n of names) expect(ui, n).toContain(n);
  });

  it('سؤال التذكير في التطبيق الأصلي وحده', () => {
    const q = 'كيف أضبط تذكيرًا يوميًّا بالورد؟';
    const qs = (native) => faqFor(native).flatMap((s) => s.items.map((i) => i.q));
    expect(qs(true)).toContain(q);
    expect(qs(false)).not.toContain(q);
    expect(qs(false)).toHaveLength(13);
  });
});
