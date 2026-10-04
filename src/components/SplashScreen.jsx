import './SplashScreen.css';

/*
  شاشة الافتتاح الوحيدة التي يراها المستخدم هي التي يرسمها نظام الهاتف من أيقونة
  التطبيق (بطلب صاحب المشروع). فما هنا مجرد ستارة كحلية بلون خلفيتها تغطي المصحف
  ريثما تُحمَّل البيانات، بلا شعار ولا كتابة، ثم تزول إلى آخر موضع كان فيه المستخدم.
*/
export default function SplashScreen({ leaving }) {
  return (
    <div
      className={`splash${leaving ? ' splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="splash__sr">جارٍ التحميل</span>
    </div>
  );
}
