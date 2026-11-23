import { useEffect, useRef, useState } from 'react';
import { toArabicDigits } from '../data/quran.js';
import { useLayer } from '../lib/layers.js';
import { MAX_IMAGES, shareCaption } from '../lib/shareLayout.js';
import { imageNames, saveImages, shareImages } from '../lib/shareFiles.js';
import { shareLink } from '../lib/feedback.js';
import './ShareImages.css';

/*
  معاينة صور المشاركة (٢٠٢٦-١١-٢٢، «المشاركة» الجلسة ١، بقرار صاحب المشروع: معاينة أولًا):
  تُصنع الصور (build ⇐ { images: [Blob], truncated, note? }) ثم تظهر في نافذة تُقلَّب فيها بالسحب، وتحتها زرّان:
  «مشاركة» (قائمة مشاركة الجهاز بالصور وسطر «من تطبيق قرآن السلف» ورابطه) و«حفظ في الصور».
  name: أول اسم الملف (quran-alsalaf-tafsir-2-255)
  note: تنبيه المقدار المقطوع في صفحات المحتوى («شُورك من البقرة ١ إلى ٣ من أصل ١٠ آيات…»)، بدل التنبيه العام
*/
export default function ShareImages({ build, name, onClose, onToast }) {
  const [state, setState] = useState({ status: 'building' });
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const strip = useRef(null);
  useLayer(onClose);

  useEffect(() => {
    let alive = true;
    let urls = [];
    build().then(
      ({ images, truncated, note }) => {
        urls = images.map((b) => URL.createObjectURL(b));
        if (alive) setState({ status: 'ready', images, truncated, note, urls });
        else urls.forEach((u) => URL.revokeObjectURL(u));
      },
      () => alive && setState({ status: 'failed' })
    );
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // تُصنع مرة واحدة عند فتح النافذة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const images = state.images ?? [];
  const count = images.length;
  const names = imageNames(name, count);
  const plural = count > 1;

  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))));
  };
  const goTo = (i) => {
    const el = strip.current;
    if (!el) return;
    // الصور من اليمين (rtl): موضع التمرير سالب في المتصفحات الحديثة
    el.scrollTo({ left: -i * el.clientWidth, behavior: 'smooth' });
  };

  const share = async () => {
    setBusy(true);
    const result = await shareImages(images, names, shareCaption(shareLink()));
    setBusy(false);
    if (result === 'downloaded') onToast(plural ? 'نُزّلت الصور' : 'نُزّلت الصورة');
    else if (result === 'failed') onToast('تعذّرت المشاركة');
  };
  const save = async () => {
    setBusy(true);
    const result = await saveImages(images, names);
    setBusy(false);
    if (result === 'saved') onToast(plural ? 'حُفظت الصور في معرض الجوال' : 'حُفظت الصورة في معرض الجوال');
    else if (result === 'downloaded') onToast(plural ? 'نُزّلت الصور' : 'نُزّلت الصورة');
    else if (result === 'denied') onToast('لم يُسمح للتطبيق بحفظ الصور');
    else onToast('تعذّر حفظ الصور');
  };

  return (
    <div className="shareimg">
      <div className="shareimg__backdrop" onClick={onClose} />
      <section className="shareimg__box" role="dialog" aria-label="مشاركة صورة">
        <header className="shareimg__head">
          <h2>{state.status !== 'ready' || count === 1 ? 'مشاركة صورة' : count === 2 ? 'مشاركة صورتين' : `مشاركة ${toArabicDigits(count)} صور`}</h2>
          <button type="button" className="shareimg__close" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {state.status === 'building' && <p className="shareimg__note shareimg__wait">جارٍ إعداد الصور…</p>}
        {state.status === 'failed' && <p className="shareimg__note">تعذّر إعداد الصور.</p>}
        {state.status === 'ready' && (
          <>
            <div className="shareimg__strip" ref={strip} onScroll={onScroll}>
              {state.urls.map((u, i) => (
                <img key={u} src={u} alt={`الصورة ${toArabicDigits(i + 1)} من ${toArabicDigits(count)}`} className="shareimg__img" />
              ))}
            </div>
            {plural && (
              <div className="shareimg__dots" role="group" aria-label="الصور">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`shareimg__dot${i === index ? ' shareimg__dot--on' : ''}`}
                    aria-label={`الصورة ${toArabicDigits(i + 1)}`}
                    aria-current={i === index}
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
            )}
            {state.truncated && state.note && <p className="shareimg__note">{state.note}</p>}
            {state.truncated && !state.note && (
              <p className="shareimg__note">
                المحتوى أطول من {toArabicDigits(MAX_IMAGES)} صور، فتُشارك أوائله، وفي آخر الأخيرة «التتمة في تطبيق قرآن السلف».
              </p>
            )}
            <div className="shareimg__actions">
              <button type="button" className="shareimg__btn shareimg__btn--main" onClick={share} disabled={busy}>
                مشاركة
              </button>
              <button type="button" className="shareimg__btn" onClick={save} disabled={busy}>
                حفظ في الصور
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
