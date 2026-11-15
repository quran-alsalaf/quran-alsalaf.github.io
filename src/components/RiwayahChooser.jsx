import { RIWAYAT, setRiwayah } from '../lib/riwayah.js';
import { useLayer } from '../lib/layers.js';
import './RiwayahChooser.css';

/*
  اختيار الرواية عند أول فتح (٢٠٢٦-١١-١٥، بقرار صاحب المشروع): شاشة كاملة فوق المصحف بعد الافتتاح، فيها
  زرّان كبيران «حفص عن عاصم» و«ورش عن نافع»، وتحت كلٍّ سطر قصير بمن يقرأ بها. والاختيار يُحفظ فلا تعود
  الشاشة، ويُغيَّر بعدُ من الإعدادات. (وحين تُضاف اللغة الإنجليزية تأتي قبلها شاشة ترحيبية لاختيار اللغة.)
*/
export default function RiwayahChooser() {
  // طبقة فوق المصحف: لا تقليب بالمفاتيح تحتها، وEsc لا يغلقها (لا بد من اختيار)
  useLayer(() => {});
  return (
    <div className="rchoose" role="dialog" aria-modal="true" aria-labelledby="rchoose-title">
      <div className="rchoose__card">
        <h2 id="rchoose-title" className="rchoose__title">
          رواية المصحف
        </h2>
        <p className="rchoose__hint">اختر الرواية التي تقرأ بها، وتغييرها متاح متى شئت من الإعدادات.</p>
        <div className="rchoose__options">
          {RIWAYAT.map((r) => (
            <button key={r.id} type="button" className="rchoose__option" onClick={() => setRiwayah(r.id)}>
              <span className="rchoose__name">{r.full}</span>
              <span className="rchoose__note">{r.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
