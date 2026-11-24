// الضغط المطوّل المتكرر (٢٠٢٦-١١-٢٤، «كشف كلمة» في وضع التسميع، بطلب صاحب المشروع):
// الضغط ينفّذ first() فورًا؛ فإن نجح (true) وبقي الإصبع على الزر delay ثم تكرّر step() كل every حتى
// يُرفع الإصبع (stop) أو تُرجع step() ‏false (لا شيء بعده يُكشف دون تقليب). فالضغطة القصيرة خطوة واحدة.
export const HOLD_DELAY = 500;
export const HOLD_EVERY = 500;

export function createHold({ delay = HOLD_DELAY, every = HOLD_EVERY } = {}) {
  let timer = null;
  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };
  const start = (first, step) => {
    stop();
    if (!first()) return;
    const tick = () => {
      timer = step() ? setTimeout(tick, every) : null;
    };
    timer = setTimeout(tick, delay);
  };
  return { start, stop, active: () => timer != null };
}
