import { useEffect, useRef } from 'react';
import './SplashScreen.css';

/*
  شاشة الافتتاح مقطع موشن لشعار التطبيق (public/video/splash.mp4)، يعمل عند كل فتح بملء الشاشة
  وبلا صوت، ثم يفتح المصحف على آخر موضع. تنتهي بنهاية المقطع، أو بلمسة الشاشة، أو فور تعذّر
  تشغيله (لا اتصال ولا نسخة محفوظة، أو منع المتصفح التشغيل التلقائي) فلا يُعطَّل الافتتاح أبدًا.

  يُجلب المقطع ملفًّا كاملًا ثم يُشغَّل من نسخة في الذاكرة (blob)، لا بثًّا من الشبكة: فهكذا يمرّ
  بعامل الخدمة فيعمل بلا إنترنت من النسخة المحفوظة، ولا يتعثر Safari في طلبات القفز (Range)
  التي لا يجيدها عامل الخدمة.
*/
const SRC = `${import.meta.env.BASE_URL}video/splash.mp4`;
const SAFETY_MS = 15000; // لا ينتظر المستخدم أكثر من هذا مهما حصل

export default function SplashScreen({ leaving, onDone }) {
  const videoRef = useRef(null);

  useEffect(() => {
    let url = null;
    let cancelled = false; // يمنع تشغيلتي StrictMode المتداخلتين في التطوير من إجهاض إحداهما الأخرى
    const finish = () => {
      if (!cancelled) onDone?.();
    };
    const safety = setTimeout(finish, SAFETY_MS);
    const resume = () => document.visibilityState === 'visible' && videoRef.current?.play().catch(() => {});

    fetch(SRC)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        const v = videoRef.current;
        if (!v || cancelled) return;
        url = URL.createObjectURL(blob);
        v.src = url;
        return v.play();
      })
      .catch((e) => {
        // أوقف المتصفحُ التشغيل لأن الصفحة في الخلفية: يُستأنف عند عودتها، وإلا تكفّل المؤقّت الاحتياطي
        if (e && e.name === 'AbortError' && !cancelled) {
          document.addEventListener('visibilitychange', resume);
          return;
        }
        finish();
      });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', resume);
      clearTimeout(safety);
      if (url) URL.revokeObjectURL(url);
    };
  }, [onDone]);

  return (
    <div
      className={`splash${leaving ? ' splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      <video
        ref={videoRef}
        className="splash__video"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onEnded={onDone}
        onError={onDone}
        aria-hidden="true"
      />
      <span className="splash__sr">جارٍ التحميل</span>
    </div>
  );
}
