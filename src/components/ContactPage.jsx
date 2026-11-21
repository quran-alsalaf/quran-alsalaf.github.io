import { useEffect, useState } from 'react';
import { CONTACT_NOTE, WHATSAPP_SHOWN, contactMessage, deviceInfo, openExternal, whatsappUrl } from '../lib/feedback.js';
import { isNative } from '../lib/native.js';
import './ContactPage.css';

/*
  «للشكاوى والاقتراحات» (كان «تواصل معنا») (٢٠٢٦-١١-٢٠، الجلسة ٣ ب): صفحة فرعية في الإعدادات، نصّها بقرار صاحب المشروع: رسالة تنبّه إلى أن
  التطبيق أُنشئ بمساعدة الذكاء الاصطناعي، ورقم الواتساب ظاهرًا، وزرّ يفتح المحادثة برسالة جاهزة في آخرها سطر
  بنسخة التطبيق والجهاز والرواية (لمعرفة سبب الخطأ) — src/lib/feedback.js
*/
export default function ContactPage({ riwayah }) {
  const [device, setDevice] = useState({ native: isNative() });
  useEffect(() => {
    let live = true;
    deviceInfo().then((d) => live && setDevice(d));
    return () => {
      live = false;
    };
  }, []);
  const url = whatsappUrl(contactMessage({ ...device, riwayah }));

  // داخل التطبيق يُفتح واتساب بأندرويد نفسه، وفي الموقع بالرابط
  const onClick = (e) => {
    if (!isNative()) return;
    e.preventDefault();
    openExternal(url);
  };

  return (
    <div className="contact">
      <p className="contact__note">{CONTACT_NOTE}</p>
      <div className="contact__number">
        <WhatsAppIcon />
        <span dir="ltr">{WHATSAPP_SHOWN}</span>
      </div>
      <a className="contact__button" href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        مراسلة على واتساب
      </a>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="contact__icon">
      <path
        d="M4.2 19.8 5.3 16A8.2 8.2 0 1 1 8 18.7l-3.8 1.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.6c.2-.4.6-.5.9-.4l.5.1c.2 0 .3.2.4.4l.6 1.4c.1.2 0 .4-.1.6l-.5.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.2.1.4.2.4.4v.5c.1.4-.1.7-.4.9-.7.5-1.6.6-2.4.3a8.6 8.6 0 0 1-4.6-4.6c-.3-.8-.2-1.7.3-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
