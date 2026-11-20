// خطوات نموذج إنشاء الختمة (تنسيق تبويب الختمة، الجزء ٢): قائمة الخطوات بحسب ما يظهر منها، و«التالي» و«رجوع»،
// والرجوع إلى الملخص، والخطوة التي تغيّر ما بعدها — src/lib/planSteps.js
import { describe, expect, it } from 'vitest';
import { nextLabel, nextStep, planSteps, prevStep } from '../../src/lib/planSteps.js';

describe('قائمة الخطوات', () => {
  it('ختمة الورد: النوع ثم الطريقة ثم العدد ثم التذكير ثم الملخص', () => {
    expect(planSteps('wird')).toEqual(['type', 'mode', 'count', 'reminder', 'summary']);
  });
  it('ختمة الحفظ: النوع ثم الاتجاه ثم البداية والنهاية ثم الحفظ اليومي ثم المراجعتان ثم التذكير ثم الملخص', () => {
    expect(planSteps('hifz')).toEqual(['type', 'dir', 'range', 'lines', 'near', 'far', 'reminder', 'summary']);
  });
  it('بلا خطوة النوع مع ختمة قائمة، وبلا التذكير في الموقع', () => {
    expect(planSteps('wird', { withType: false })).toEqual(['mode', 'count', 'reminder', 'summary']);
    expect(planSteps('wird', { withReminder: false })).toEqual(['type', 'mode', 'count', 'summary']);
    expect(planSteps('hifz', { withType: false, withReminder: false })).toEqual(['dir', 'range', 'lines', 'near', 'far', 'summary']);
  });
});

describe('التنقّل', () => {
  const steps = planSteps('hifz');

  it('«التالي» إلى الخطوة التي بعدها، و«رجوع» إلى التي قبلها، وفي الأولى null (إلغاء)', () => {
    expect(nextStep(steps, 'type')).toEqual({ step: 'dir', fromSummary: false });
    expect(nextStep(steps, 'reminder')).toEqual({ step: 'summary', fromSummary: false });
    expect(prevStep(steps, 'range')).toBe('dir');
    expect(prevStep(steps, 'type')).toBe(null);
    expect(prevStep(planSteps('hifz', { withType: false }), 'dir')).toBe(null);
  });

  it('من الملخص: الخطوة تعود إليه مباشرة', () => {
    expect(nextStep(steps, 'lines', { fromSummary: true })).toEqual({ step: 'summary', fromSummary: false });
    expect(nextStep(steps, 'dir', { fromSummary: true })).toEqual({ step: 'summary', fromSummary: false });
    expect(nextLabel(steps, 'lines', { fromSummary: true })).toBe('العودة إلى الملخص');
    expect(nextLabel(steps, 'lines')).toBe('التالي');
  });

  it('من الملخص: تغيير الاتجاه يمرّ بالبداية والنهاية ثم يعود إلى الملخص', () => {
    expect(nextLabel(steps, 'dir', { fromSummary: true, reset: true })).toBe('التالي');
    const after = nextStep(steps, 'dir', { fromSummary: true, reset: true });
    expect(after).toEqual({ step: 'range', fromSummary: true });
    expect(nextLabel(steps, 'range', { fromSummary: true })).toBe('العودة إلى الملخص');
    expect(nextStep(steps, 'range', after)).toEqual({ step: 'summary', fromSummary: false });
  });

  it('من الملخص: تغيير طريقة الورد يمرّ بالعدد ثم يعود إلى الملخص', () => {
    const wird = planSteps('wird', { withReminder: false });
    expect(nextStep(wird, 'mode', { fromSummary: true, reset: true })).toEqual({ step: 'count', fromSummary: true });
    expect(nextStep(wird, 'count', { fromSummary: true })).toEqual({ step: 'summary', fromSummary: false });
  });

  it('خطوة تغيّر ما بعدها بلا ملخص: «التالي» عادي', () => {
    expect(nextStep(steps, 'dir', { reset: true })).toEqual({ step: 'range', fromSummary: false });
  });
});
