// الضغط المطوّل المتكرر (٢٠٢٦-١١-٢٤): «كشف كلمة» في وضع التسميع، بساعة محاكاة
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLD_DELAY, HOLD_EVERY, createHold } from '../../src/lib/hold.js';

describe('الضغط المطوّل على «كشف كلمة»', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('نصف ثانية قبل التكرار ونصف ثانية بين كل كلمتين', () => {
    expect(HOLD_DELAY).toBe(500);
    expect(HOLD_EVERY).toBe(500);
  });

  it('الضغطة القصيرة خطوة واحدة فورًا، ولا تكرار بعد رفع الإصبع', () => {
    const first = vi.fn(() => true);
    const step = vi.fn(() => true);
    const h = createHold();
    h.start(first, step);
    expect(first).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    h.stop();
    vi.advanceTimersByTime(5000);
    expect(step).not.toHaveBeenCalled();
    expect(h.active()).toBe(false);
  });

  it('الإبقاء: بعد نصف ثانية كلمة، ثم كلمة كل نصف ثانية حتى يُرفع الإصبع', () => {
    const step = vi.fn(() => true);
    const h = createHold();
    h.start(() => true, step);
    vi.advanceTimersByTime(499);
    expect(step).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(step).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(step).toHaveBeenCalledTimes(3);
    h.stop();
    vi.advanceTimersByTime(3000);
    expect(step).toHaveBeenCalledTimes(3);
  });

  it('يقف وحده إذا لم يبقَ ما يُكشف (step تُرجع false)', () => {
    let left = 3;
    const step = vi.fn(() => left-- > 0);
    const h = createHold();
    h.start(() => true, step);
    vi.advanceTimersByTime(10000);
    expect(step).toHaveBeenCalledTimes(4);
    expect(h.active()).toBe(false);
  });

  it('إن لم تكشف الضغطة شيئًا (قلّبت الصفحة) فلا تكرار', () => {
    const step = vi.fn(() => true);
    const h = createHold();
    h.start(() => false, step);
    vi.advanceTimersByTime(5000);
    expect(step).not.toHaveBeenCalled();
  });
});
