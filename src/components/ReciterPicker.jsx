import { useEffect, useState } from 'react';
import { covers, groupReciters, reciterById, reciterTitle, recitersOf } from '../lib/reciters.js';
import { previewReciter, stopPreview, usePlayer } from '../lib/player.js';
import { freeSpaceMB, nativeSaving, pauseDownload, startDownload, supported, useOffline } from '../lib/offline.js';
import { toArabicDigits } from '../data/quran.js';
import './ReciterPicker.css';
import { useLayer } from '../lib/layers.js';

// الحجم بالعربية: «٤٤٤ ميغابايت» أو «١٫٢ غيغابايت»
export function sizeText(mb) {
  if (mb >= 1000) return `${toArabicDigits((mb / 1000).toFixed(1)).replace('.', '٫')} غيغابايت`;
  return `${toArabicDigits(Math.max(1, Math.round(mb)))} ميغابايت`;
}
const pctOf = (it) => (it.total ? Math.floor((it.count / it.total) * 100) : 0);

/*
  قائمة اختيار القارئ (الفصل ٦): صفحة كاملة تنزلق من الأسفل، بقائمة قرّاء ودائرة اختيار
  أمام كلٍّ (على نسق تطبيق «آية»)، بدل قائمة منسدلة صغيرة. مقسَّمة إلى مجموعات بعناوين (مجوّد، معلّم،
  مرتّل) بحسب حقل group في src/data/reciters.json، فلا يُكتب تحت الاسم شيء. ويُخفى منها القارئ الذي لا
  يشمل تسجيله المقدار الحالي.
  وفي كل صف زرّ معاينة (٢٠٢٦-١١-١٣) بين الاسم ودائرة الاختيار: يُسمِع «الحمد لله رب العالمين» بصوت
  القارئ (previewReciter في src/lib/player.js) ولا يختاره ولا يغلق القائمة؛ وإغلاق القائمة أو اختيار قارئ
  يوقف المعاينة. أزرار الصف (المعاينة، والتحميل) في .rcpick__tools فوق زرّ الاختيار.
  وزرّ التحميل (٢٠٢٦-١١-١٤) يحمّل صوت القارئ لكامل القرآن على الجهاز (src/lib/offline.js) بعد تأكيد
  يذكر حجمه: أثناءه دائرة تقدّم يوقفه الضغط عليها مؤقتًا، ومتوقفًا يُستأنف بالضغط، ومكتملًا علامة ✓
  لا تُضغط (٢٠٢٦-١١-١٥، بطلب صاحب المشروع: لا حذف لما حُمِّل؛ وكان الضغط عليها يحذفه بعد تأكيد).
  وحالته مكتوبة تحت الاسم.
  ولا يظهر فيها إلا قرّاء رواية المصحف المعروض riwayah (٢٠٢٦-١١-١٥، بقرار صاحب المشروع): في ورش قرّاء ورش وحدهم.
  وداخل تطبيق أندرويد (الجلسة ٢ ب، ٢٠٢٦-١١-٢٠) يحمّل أندرويد نفسه (src/lib/nativeFiles.js)، فيستمر والشاشة مقفلة
  والتطبيق مغلق، والتأكيد لا يطلب إبقاء التطبيق مفتوحًا. وتحميل قارئ أثناء تحميل غيره يضعه «بالانتظار» (لا
  «أوقفه أولًا»)، فيبدأ وحده بعد الجاري؛ والضغط على زرّه يخرجه من الانتظار. و«ينتظر الاتصال» إذا انقطع.
*/
export default function ReciterPicker({ chosen, riwayah = 'hafs', suras, onPick, onClose, onToast }) {
  useLayer(onClose);
  const { preview } = usePlayer();
  const offline = useOffline();
  const canSave = supported();
  // تأكيد التحميل المفتوح: { id, free }
  const [ask, setAsk] = useState(null);
  useEffect(() => stopPreview, []);
  const shown = recitersOf(riwayah).filter((r) => covers(r, suras));

  const queues = nativeSaving();
  const download = async (id) => {
    const active = offline.active;
    const result = await startDownload(id);
    if (result === 'busy') onToast?.(`يُحمَّل الآن ${reciterTitle(reciterById(offline.active))}؛ أوقفه أولًا ثم حمّل غيره`);
    else if (result === 'unsupported') onToast?.('هذا المتصفح لا يتيح حفظ الصوت على الجهاز');
    else if (result === 'queued')
      onToast?.(`${reciterTitle(reciterById(id))} بالانتظار: يبدأ تحميله وحده بعد ${active ? reciterTitle(reciterById(active)) : 'الجاري'}`);
    else if (result === 'failed' && queues) onToast?.(`تعذّر بدء تحميل ${reciterTitle(reciterById(id))}`);
  };

  const onSaveButton = async (r) => {
    const it = offline.items[r.id];
    if (it?.status === 'downloading' || it?.status === 'queued') return pauseDownload(r.id);
    if (it?.status === 'done') return undefined; // محمَّل: لا حذف
    if (!queues && offline.active && offline.active !== r.id) {
      onToast?.(`يُحمَّل الآن ${reciterTitle(reciterById(offline.active))}؛ أوقفه أولًا ثم حمّل غيره`);
      return undefined;
    }
    if (it?.status === 'paused') return download(r.id);
    setAsk({ id: r.id, free: null });
    const free = await freeSpaceMB();
    setAsk((a) => (a?.id === r.id ? { ...a, free } : a));
    return undefined;
  };

  const togglePreview = (r) => {
    if (preview?.id === r.id) stopPreview();
    else previewReciter(r.id, () => onToast?.('تعذّر تشغيل المعاينة'));
  };

  return (
    <div className="rcpick" role="dialog" aria-label="اختر القارئ">
      <header className="rcpick__head">
        <h2>القارئ</h2>
        <button type="button" className="rcpick__close" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="rcpick__list">
        {groupReciters(shown).map((g) => (
          <section key={g.id} className="rcpick__group" role="radiogroup" aria-labelledby={`rcpick-${g.id}`}>
            <h3 id={`rcpick-${g.id}`} className="rcpick__group-title">
              {g.title}
            </h3>
            {g.reciters.map((r) => {
              const on = preview?.id === r.id;
              return (
                <div key={r.id} className="rcpick__item">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={r.id === chosen}
                    aria-label={r.name}
                    aria-describedby={offline.items[r.id] ? `rcpick-st-${r.id}` : undefined}
                    className="rcpick__row"
                    onClick={() => {
                      stopPreview();
                      onPick(r.id);
                      onClose();
                    }}
                  >
                    <span className="rcpick__label">
                      <span className="rcpick__name">{r.name}</span>
                      {offline.items[r.id] && <SaveStatus id={`rcpick-st-${r.id}`} item={offline.items[r.id]} />}
                    </span>
                    <span className="rcpick__radio" />
                  </button>
                  <div className="rcpick__tools">
                    <button
                      type="button"
                      className={`rcpick__preview${on ? ' rcpick__preview--on' : ''}`}
                      aria-label={on ? 'إيقاف المعاينة' : `معاينة صوت ${reciterTitle(r)}`}
                      title={on ? 'إيقاف المعاينة' : 'معاينة الصوت'}
                      onClick={() => togglePreview(r)}
                    >
                      {on && preview.status === 'loading' ? (
                        <span className="rcpick__spin" aria-hidden="true" />
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          {on ? <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /> : <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />}
                        </svg>
                      )}
                    </button>
                    {canSave && <SaveButton r={r} item={offline.items[r.id]} onClick={() => onSaveButton(r)} />}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {ask && (
        <Confirm
          ask={ask}
          native={queues}
          onClose={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            download(ask.id);
          }}
        />
      )}
    </div>
  );
}

function SaveStatus({ id, item }) {
  const pct = toArabicDigits(pctOf(item));
  if (item.status === 'done')
    return (
      <span id={id} className="rcpick__status rcpick__status--done">
        محمَّل على الجهاز
      </span>
    );
  const text =
    item.status === 'queued'
      ? 'بالانتظار'
      : item.status === 'downloading'
        ? item.waiting
          ? `ينتظر الاتصال… ${pct}٪`
          : `يُحمَّل… ${pct}٪`
        : `متوقف عند ${pct}٪`;
  return (
    <span id={id} className="rcpick__status">
      {text}
    </span>
  );
}

// زرّ التحميل: سهم (لم يُحمَّل) · دائرة تقدّم بعلامة إيقاف (يُحمَّل) · دائرة تقدّم بسهم (متوقف) ·
// دائرة تقدّم بساعة (بالانتظار، داخل التطبيق: الضغط يخرجه من الانتظار).
// والمحمَّل علامة ✓ لا تُضغط (لا حذف لما حُمِّل)
function SaveButton({ r, item, onClick }) {
  const name = reciterTitle(r);
  const status = item?.status;
  if (status === 'done')
    return (
      <span className="rcpick__save rcpick__save--done" role="img" aria-label={`${name}: محمَّل على الجهاز`} title="محمَّل على الجهاز">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 12.5l3.6 3.6 7.4-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  const label =
    status === 'downloading'
      ? `إيقاف تحميل ${name} مؤقتًا`
      : status === 'queued'
        ? `إلغاء انتظار تحميل ${name}`
        : status === 'paused'
          ? `استئناف تحميل ${name}`
          : `تحميل ${name} لكامل القرآن`;
  const C = 2 * Math.PI * 10;
  const ring = item && (
    <>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
      <circle
        className="rcpick__ring"
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - pctOf(item) / 100)}
        transform="rotate(-90 12 12)"
      />
    </>
  );
  return (
    <button
      type="button"
      className={`rcpick__save${status ? ` rcpick__save--${status}` : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ring}
        {status === 'downloading' && <path d="M10 8.5v7M14 8.5v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {status === 'queued' && <path d="M12 8v4.2l2.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
        {status === 'paused' && <path d="M12 7.5v8m-3.2-3.2L12 15.5l3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
        {!status && (
          <path d="M12 4.5v10m-4-4 4 4 4-4M5 18.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

// تأكيد التحميل: بحجمه، وتنبيه إن بدت المساحة لا تكفي. وداخل التطبيق (native) يستمر التحميل والتطبيق مغلق،
// فلا يُطلب إبقاؤه مفتوحًا
function Confirm({ ask, native, onClose, onConfirm }) {
  useLayer(onClose);
  const r = reciterById(ask.id);
  const name = reciterTitle(r);
  const size = r.mb ? sizeText(r.mb) : null;
  const tight = r.mb && ask.free != null && ask.free < r.mb;
  return (
    <div className="rcpick__scrim" onClick={onClose} role="presentation">
      <div className="rcpick__confirm" role="alertdialog" aria-modal="true" aria-label={`تحميل ${name}`} onClick={(e) => e.stopPropagation()}>
        <h3>تحميل تلاوة {name}</h3>
        <p>
          لكامل القرآن{size && <>، نحو <b>{size}</b></>}. يُحفظ على الجهاز فيعمل الاستماع بصوته بلا إنترنت.
        </p>
        {native ? (
          <p className="rcpick__hint">يُفضَّل الاتصال بشبكة Wi‑Fi. يستمر التحميل ولو قُفلت الشاشة أو أُغلق التطبيق، ويظهر تقدّمه في الإشعارات.</p>
        ) : (
          <p className="rcpick__hint">يُفضَّل الاتصال بشبكة Wi‑Fi، وإبقاء التطبيق مفتوحًا حتى يكتمل؛ وإن أُغلق أكمله زرّ الاستئناف.</p>
        )}
        {tight && <p className="rcpick__warn">المساحة المتاحة {native ? 'على الجهاز' : 'للتطبيق'} نحو {sizeText(ask.free)}، وقد لا تكفي.</p>}
        <div className="rcpick__confirm-actions">
          <button type="button" className="rcpick__btn rcpick__btn--primary" onClick={onConfirm}>
            تحميل
          </button>
          <button type="button" className="rcpick__btn" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
