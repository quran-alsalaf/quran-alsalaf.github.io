import { toArabicDigits } from '../data/quran.js';
import { useLayer } from '../lib/layers.js';
import { addMistake, inMistakes, revealedVerses } from '../lib/recite.js';
import { useUserData } from '../lib/userdata.js';
import { verseLabel } from '../lib/study.js';
import './Recite.css';

/*
  التسميع بالكشف (٢٠٢٦-١١-١٦، «القائمة الثالثة» البند ٣) — المنطق في src/lib/recite.js، والحال في App.jsx.
  • ReciteInfo: صفحة «التسميع» داخل الإعدادات (كصفحة «وضع القراءة»)، وزرّ «ابدأ التسميع».
  • ReciteBar: الشريط السفلي طوال الوضع، من اليمين: كشف كلمتين · كشف الآية · أخطائي · ✕ للخروج (بعيدًا عن
    زرّي الكشف، فلا يُضغط بالخطأ فيضيع ما كُشف).
  • MistakesPicker: «أخطائي» يفتح قائمة آيات الصفحة المكشوفة، أولها الآية الجارية، فيُختار منها موضع الخطأ
    ولو كان في آية سابقة (بطلب صاحب المشروع): رقمها وبدايتها، والاختيار يسجّلها في علامة «أخطائي».
*/

export function ReciteInfo({ onStart }) {
  return (
    <div className="readinfo">
      <p className="readinfo__lead">
        تُخفى آيات الصفحة التي أنت فيها، وتبقى رؤوس الآيات في مواضعها، فتعرف أين تبدأ كل آية وأين تنتهي وكم طولها، ثم
        تسمّع من حفظك وتكشف ما قرأت لتتأكد منه.
      </p>

      <ul className="readinfo__list">
        <li>«كشف كلمتين» يكشف الكلمتين التاليتين من الآية الجارية، و«كشف الآية» يكشف بقيتها.</li>
        <li>إذا انتهت الصفحة فالضغط على زرّ الكشف يقلّبها إلى التالية.</li>
        <li>قلّب الصفحات يمينًا ويسارًا كالعادة، وكل صفحة تقلب إليها تظهر مخفية، وما كشفته يبقى مكشوفًا إذا رجعت إليه.</li>
        <li>إذا لمست كلمة مكشوفة أُخفيت هي وما بعدها في الصفحة، فتعيد التسميع منها.</li>
        <li>«أخطائي» يعرض الآيات التي كشفتها، فتختار الآية التي أخطأت فيها فتُسجَّل في علامة «أخطائي»، وتجدها في القائمة اليمنى ← «العلامات».</li>
        <li>يُوقَف الاستماع عند الدخول.</li>
        <li>زرّ ✕ يخرج منه ويرجع المصحف كما كان.</li>
      </ul>

      <button type="button" className="readinfo__start" onClick={onStart}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        ابدأ وضع التسميع
      </button>
    </div>
  );
}

export function ReciteBar({ onWords, onVerse, onMistakes, onExit }) {
  return (
    <div className="recitebar" role="toolbar" aria-label="التحكم في وضع التسميع">
      <button type="button" className="recitebar__main" onClick={onWords}>
        كشف كلمتين
      </button>
      <button type="button" className="recitebar__main" onClick={onVerse}>
        كشف الآية
      </button>
      <button type="button" className="recitebar__btn recitebar__mistakes" onClick={onMistakes}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 4.5h10v15l-5-3.6-5 3.6v-15Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M10 8.5l4 4M14 8.5l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span>أخطائي</span>
      </button>
      <button type="button" className="recitebar__btn recitebar__exit" onClick={onExit} aria-label="الخروج من وضع التسميع">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// بداية الآية: أول أربع كلمات منها (بلا رأسها)، وما زاد يُختصر
const verseStart = (quran, v) => {
  const words = quran.verses[v].t.slice(0, -1);
  return words.slice(0, 4).join(' ') + (words.length > 4 ? ' …' : '');
};

export function MistakesPicker({ quran, pages, state, onClose, onToast }) {
  useLayer(onClose);
  // تتحدّث علامة ✓ إن تغيّرت العلامات
  const { bookmarks } = useUserData();
  const verses = revealedVerses(quran, pages, state);
  const pick = (v) => {
    const r = addMistake(quran, v);
    onClose();
    onToast(r === 'added' ? 'سُجّلت في أخطائي' : 'الآية في أخطائي من قبل');
  };
  return (
    <div className="mistakes" role="dialog" aria-modal="true" aria-labelledby="mistakes-title">
      <div className="mistakes__backdrop" onClick={onClose} />
      <section className="mistakes__box">
        <header className="mistakes__head">
          <div>
            <h2 id="mistakes-title">أخطائي</h2>
            <span>اختر الآية التي أخطأت فيها</span>
          </div>
          <button type="button" className="mistakes__close" onClick={onClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {verses.length ? (
          <ul className="mistakes__list">
            {verses.map((v) => {
              const done = inMistakes(quran, v, bookmarks);
              return (
                <li key={v}>
                  <button type="button" className={`mistakes__row${done ? ' mistakes__row--done' : ''}`} onClick={() => pick(v)}>
                    <span className="mistakes__num">{toArabicDigits(quran.verses[v].a)}</span>
                    <span className="mistakes__body">
                      <span className="mistakes__text">{verseStart(quran, v)}</span>
                      <small>
                        {verseLabel(quran, [v])}
                        {done ? ' · في أخطائي' : ''}
                      </small>
                    </span>
                    {done && (
                      <svg className="mistakes__check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mistakes__empty">لم تكشف شيئًا بعدُ في هذه الصفحة. اكشف ما قرأته ثم اختر منه الآية.</p>
        )}
      </section>
    </div>
  );
}
