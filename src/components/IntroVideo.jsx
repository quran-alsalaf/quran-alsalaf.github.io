import { useEffect, useRef, useState } from 'react';
import './IntroVideo.css';

// الفيديو التعريفي (الفصل ١١) بدل الدليل التعريفي المصوَّر: شاشة كاملة للمقطع بلا أي أزرار
// تحكّم ولا إطار مشغّل — وزرّ «تخطي» وحده — وتُغلق من نفسها عند نهاية المقطع (بطلب صاحب المشروع).
// يظهر تلقائيًّا في أول فتحتين (src/lib/settings.js) ويُعاد عرضه من الإعدادات.
//
// يُجلب المقطع ملفًّا كاملًا ثم يُشغَّل من نسخة في الذاكرة (blob)، لا بثًّا: فيمرّ بعامل الخدمة
// ويعمل بلا إنترنت من النسخة المحفوظة، ولا يتعثر Safari في طلبات القفز (Range) التي لا يجيدها.
const SRC = `${import.meta.env.BASE_URL}video/intro.mp4`;

export default function IntroVideo({ open, onClose }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let url = null;
    let cancelled = false;
    setState('loading');
    setSrc(null);

    fetch(SRC)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open]);

  // يُشغَّل بصوته؛ فإن منع المتصفح الصوتَ التلقائي (لا لمسة سابقة) شُغِّل صامتًا بدل أن يتوقف،
  // إذ لا أزرار تحكّم هنا لتشغيله يدويًّا
  const start = (v) => {
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  };

  if (!open) return null;

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="الفيديو التعريفي">
      {state === 'ready' && (
        <video
          ref={videoRef}
          className="intro__video"
          src={src}
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onLoadedData={(e) => start(e.currentTarget)}
          onEnded={onClose}
          onError={onClose}
        />
      )}
      {state === 'failed' && (
        <p className="intro__note">تعذّر تحميل الفيديو. يحتاج اتصالًا بالإنترنت في أول مرة، ويمكنك العودة إليه من الإعدادات.</p>
      )}
      <button type="button" className="intro__skip" onClick={onClose}>
        تخطي
      </button>
    </div>
  );
}
