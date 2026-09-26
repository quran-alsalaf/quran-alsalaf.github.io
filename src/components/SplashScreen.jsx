import './SplashScreen.css';

/*
  الشعار يظهر عند كل فتح للتطبيق كشاشة تحميل قصيرة، ثم ينتقل تلقائيًا
  إلى آخر موضع كان فيه المستخدم بالضبط (الفصل ١١).

  الشعار يُعرض كما هو بلا أي تعديل عليه، فهو جاهز ويقرأ اسم التطبيق صحيحًا.
*/
export default function SplashScreen({ leaving }) {
  return (
    <div
      className={`splash${leaving ? ' splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      {/*
        الشعار بنصّه الأبيض وكتابه البرتقالي، مهيَّأً للخلفية الكحلية.
        والمقاسان هنا بحجم العرض المقصود لا بحجم الصورة الأصلي، لئلا
        يظهر الشعار بحجمه الكامل في اللحظة السابقة لتحميل ملف التنسيق.
      */}
      <div className="splash__logo">
        <img
          className="splash__book"
          src="icons/parts/book-orange.png"
          alt=""
          width="272"
          height="48"
          decoding="async"
          fetchpriority="high"
        />
      </div>
      <span className="splash__sr">جارٍ التحميل</span>
      <div className="splash__bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
