import { useEffect, useState } from 'react';
import './IntroVideo.css';

// الفيديو التعريفي (الفصل ١١) بدل الدليل التعريفي المصوَّر: مقطع قصير (نحو ٣٠ ثانية) يشرح
// التطبيق، يظهر تلقائيًّا في أول فتحتين (src/lib/settings.js) ويُعاد عرضه من الإعدادات.
//
// يُجلب المقطع ملفًّا كاملًا ثم يُشغَّل من نسخة في الذاكرة (blob)، لا بثًّا: فيمرّ بعامل الخدمة
// ويعمل بلا إنترنت من النسخة المحفوظة، ولا يتعثر Safari في طلبات القفز (Range) التي لا يجيدها.
const SRC = `${import.meta.env.BASE_URL}video/intro.mp4`;

export default function IntroVideo({ open, onClose }) {
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [ended, setEnded] = useState(false);
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let url = null;
    let cancelled = false;
    setState('loading');
    setEnded(false);
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

  if (!open) return null;

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="الفيديو التعريفي">
      <button type="button" className="intro__skip" onClick={onClose}>
        {ended ? 'ابدأ' : 'تخطي'}
      </button>
      <div className="intro__stage">
        {state === 'loading' && <p className="intro__note">جارٍ تحميل الفيديو…</p>}
        {state === 'failed' && (
          <p className="intro__note">تعذّر تحميل الفيديو. يحتاج اتصالًا بالإنترنت في أول مرة، ويمكنك العودة إليه من الإعدادات.</p>
        )}
        {state === 'ready' && (
          <video
            src={src}
            autoPlay
            className="intro__video"
            controls
            playsInline
            preload="auto"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onEnded={() => setEnded(true)}
          />
        )}
      </div>
    </div>
  );
}
