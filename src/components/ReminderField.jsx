import { useState } from 'react';
import {
  DEFAULT_REMINDER,
  askNotifications,
  isTime,
  openNotificationSettings,
  remindersAvailable,
  timeText,
} from '../lib/reminders.js';

/*
  «التذكير اليومي» في نموذج إنشاء الختمة وتعديل خطتها (ختمة الورد وختمة الحفظ، الجلسة ٣ أ) — src/lib/reminders.js.
  • «بلا تذكير» افتراضيًّا (بقرار صاحب المشروع)، و«تذكير يومي» يطلب إذن الإشعارات (أندرويد ١٣ فأحدث)، ثم يظهر
    منتقي الوقت بالساعة والدقيقة (منتقي الجهاز نفسه).
  • إن رُفض الإذن بقي «بلا تذكير»، ومعه شرح وزرّ يفتح إعدادات إشعارات التطبيق في الجهاز.
  • داخل التطبيق الأصلي وحده: في الموقع لا يظهر شيء.
  value: «HH:MM» أو null · onChange(value) · bare: بلا اسم الحقل (في خطوة التذكير، سؤالها اسمه)
*/
export default function ReminderField({ value, onChange, label = 'ما عليك', bare = false }) {
  const [denied, setDenied] = useState(false);
  const [asking, setAsking] = useState(false);
  if (!remindersAvailable()) return null;
  const on = isTime(value);

  const enable = async () => {
    if (on || asking) return;
    setAsking(true);
    const granted = await askNotifications();
    setAsking(false);
    setDenied(!granted);
    if (granted) onChange(DEFAULT_REMINDER);
  };

  return (
    <div className="hifz__field reminder">
      {!bare && <span className="hifz__label">التذكير اليومي</span>}
      <div className="khatma__segment" role="radiogroup" aria-label="التذكير اليومي">
        <button
          type="button"
          role="radio"
          aria-checked={!on}
          onClick={() => {
            setDenied(false);
            onChange(null);
          }}
        >
          بلا تذكير
        </button>
        <button type="button" role="radio" aria-checked={on} onClick={enable}>
          تذكير يومي
        </button>
      </div>
      {on && (
        <>
          <label className="khatma__custom reminder__time">
            <span>الوقت</span>
            <input type="time" value={value} required onChange={(e) => isTime(e.target.value) && onChange(e.target.value)} />
          </label>
          <p className="khatma__hint">
            يصلك إشعار كل يوم نحو {timeText(value)}، إلا إذا أتممت {label} قبله.
          </p>
        </>
      )}
      {denied && (
        <div className="hifz__error reminder__denied" role="alert">
          <p>الإشعارات غير مسموحة لهذا التطبيق. اسمح بها من إعدادات الجهاز، ثم اختر «تذكير يومي».</p>
          <button type="button" className="khatma__link" onClick={openNotificationSettings}>
            فتح إعدادات الإشعارات
          </button>
        </div>
      )}
    </div>
  );
}

// سطر هادئ في بطاقة الختمة بوقت تذكيرها (داخل التطبيق وحده)
export function ReminderLine({ time }) {
  if (!remindersAvailable() || !isTime(time)) return null;
  return <p className="khatma__reminder">التذكير اليومي: {timeText(time)}</p>;
}
