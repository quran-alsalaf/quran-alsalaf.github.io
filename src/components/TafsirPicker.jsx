import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TAFSIR_SOURCES, tafsirInfo } from '../lib/study.js';
import { isDownloadable } from '../data/tafsirs.js';
import {
  canDownloadTafsir,
  isTafsirReady,
  pauseTafsirDownload,
  startTafsirDownload,
  useTafsirDownloads,
} from '../lib/tafsirDownload.js';
import { freeSpaceMB } from '../lib/downloader.js';
import { toArabicDigits } from '../data/quran.js';
import { useLayer } from '../lib/layers.js';
import { sizeText } from './ReciterPicker.jsx';
import './TafsirPicker.css';

/*
  اختيار التفسير (٢٠٢٦-١١-١٤، بدل زرّي «المختصر | الميسّر» المتجاورين): زرّ باسم التفسير الحالي
  وسهم، يفتح قائمة التفاسير تحته، والاختيار بضغطة. هو نفسه في صفحات المحتوى وفي بطاقة التفسير من
  مربع الآية، والاختيار واحد فيهما (useTafsirSource).
  تُغلق القائمة بالاختيار، وبالنقر خارجها، وبـEsc (طبقة فوق ما تحتها، فلا يُغلق Esc الصفحة معها)،
  وبالزر نفسه. وبلوحة المفاتيح: السهمان بين التفاسير، وEnter أو المسافة للاختيار، وHome/End.
  والتفاسير التي تُحمَّل بزرّ (٢٠٢٦-١١-١٥، src/lib/tafsirDownload.js): قبل اكتمال تحميلها لا تُختار، وفي
  آخر سطر كلٍّ زرّ تحميل: يفتح تأكيدًا يذكر الحجم وينبّه إلى إبقاء التطبيق مفتوحًا والإنترنت متصلًا، ثم
  يصير دائرة تقدّم والنسبة تحت الاسم، والضغط عليها إيقاف مؤقت، وثانيةً استئناف. وعند الاكتمال يختفي
  الزرّ ويصير التفسير قابلًا للاختيار. والتحميل يستمر ولو أُغلقت القائمة، وحالته واحدة في الموضعين.
*/
// align: 'center' (تحت الزر في وسطه) أو 'start' (من طرف الزر الأيمن، لزرٍّ على حافة ضيقة كبطاقة الآية)
export default function TafsirPicker({ value, onChange, align = 'center', onToast }) {
  const [open, setOpen] = useState(false);
  const downloads = useTafsirDownloads();
  // تأكيد التحميل المفتوح: { id, free }
  const [ask, setAsk] = useState(null);
  const root = useRef(null);
  const button = useRef(null);
  const list = useRef(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  useLayer(() => close(), open);

  // عند الفتح: التركيز على التفسير المختار؛ والنقر خارج القائمة يغلقها
  useEffect(() => {
    if (!open) return undefined;
    list.current?.querySelector('[aria-selected="true"]')?.focus();
    // في بطاقة الآية القصيرة قد تتجاوز القائمة (٤ تفاسير فأكثر) حافّتها السفلى: تُمرَّر البطاقة لتظهر كلها
    list.current?.scrollIntoView?.({ block: 'nearest' });
    const outside = (e) => {
      if (!root.current?.contains(e.target)) close(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  const choose = (id) => {
    if (!isTafsirReady(id)) return; // لم يكتمل تحميله: لا يُختار
    if (id !== value) onChange(id);
    close();
  };

  const busyToast = () => onToast?.(`يُحمَّل الآن تفسير ${tafsirInfo(downloads.active).name}؛ أوقفه أولًا ثم حمّل غيره`);
  const download = async (id) => {
    const result = await startTafsirDownload(id);
    if (result === 'busy') busyToast();
    else if (result === 'unsupported') onToast?.('هذا المتصفح لا يتيح حفظ التفسير على الجهاز');
  };
  // زرّ التحميل في سطر التفسير
  const onSaveButton = async (id) => {
    const it = downloads.items[id];
    if (it?.status === 'downloading') return pauseTafsirDownload();
    if (!canDownloadTafsir()) {
      onToast?.('هذا المتصفح لا يتيح حفظ التفسير على الجهاز');
      return undefined;
    }
    if (downloads.active && downloads.active !== id) return busyToast();
    if (it?.status === 'paused') return download(id);
    close(false);
    setAsk({ id, free: null });
    const free = await freeSpaceMB();
    setAsk((a) => (a?.id === id ? { ...a, free } : a));
    return undefined;
  };

  const onKey = (e) => {
    const items = [...list.current.querySelectorAll('[role="option"]')];
    const i = items.indexOf(document.activeElement);
    let to = null;
    // القائمة رأسية، فالسهم للأسفل إلى التالي أيًّا كان اتجاه الكتابة
    if (e.key === 'ArrowDown') to = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') to = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = items.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (i >= 0) {
        const { id } = items[i].dataset;
        if (isTafsirReady(id)) choose(id);
        else onSaveButton(id);
      }
      return;
    } else if (e.key === 'Tab') {
      close(false);
      return;
    }
    if (to !== null) {
      e.preventDefault();
      items[to].focus();
    }
  };

  const current = tafsirInfo(value);
  return (
    <div className={`tpick tpick--${align}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="tpick__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`مصدر التفسير: ${current.name}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{current.name}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tpick__chevron">
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul ref={list} className="tpick__list" role="listbox" aria-label="مصدر التفسير" onKeyDown={onKey}>
          {TAFSIR_SOURCES.map((s) => {
            const ready = isTafsirReady(s.id);
            const it = downloads.items[s.id];
            return (
              <li
                key={s.id}
                role="option"
                tabIndex={-1}
                data-id={s.id}
                aria-selected={s.id === value}
                // لا aria-disabled: يسري على زرّ التحميل داخله فيعطّله. فالقفل صنفٌ ووصفٌ مقروء
                aria-describedby={ready ? undefined : `tpick-lock-${s.id}`}
                className={`tpick__item${ready ? '' : ' tpick__item--locked'}`}
                onClick={() => choose(s.id)}
              >
                <span className="tpick__name">{s.name}</span>
                <span className="tpick__title">{s.title}</span>
                {!ready && (it ? <SaveStatus id={`tpick-lock-${s.id}`} item={it} /> : <span id={`tpick-lock-${s.id}`} className="tpick__sr">يحتاج تحميلًا</span>)}
                {s.id === value && (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tpick__check">
                    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {!ready && isDownloadable(s.id) && (
                  <SaveButton
                    name={s.name}
                    item={it}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveButton(s.id);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ask &&
        createPortal(
          <Confirm
            ask={ask}
            onClose={() => {
              setAsk(null);
              button.current?.focus();
            }}
            onConfirm={() => {
              setAsk(null);
              download(ask.id);
            }}
          />,
          document.body
        )}
    </div>
  );
}

const pctOf = (it) => (it.total ? Math.floor((it.count / it.total) * 100) : 0);

function SaveStatus({ id, item }) {
  const pct = toArabicDigits(pctOf(item));
  return <span id={id} className="tpick__status">{item.status === 'downloading' ? `يُحمَّل… ${pct}٪` : `متوقف عند ${pct}٪`}</span>;
}

// زرّ التحميل: سهم (لم يُحمَّل) · دائرة تقدّم بعلامة إيقاف (يُحمَّل) · دائرة تقدّم بسهم (متوقف)
function SaveButton({ name, item, onClick }) {
  const status = item?.status;
  const label =
    status === 'downloading' ? `إيقاف تحميل تفسير ${name} مؤقتًا` : status === 'paused' ? `استئناف تحميل تفسير ${name}` : `تحميل تفسير ${name}`;
  const C = 2 * Math.PI * 10;
  return (
    <button type="button" className={`tpick__save${status ? ` tpick__save--${status}` : ''}`} aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {item && (
          <>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
            <circle
              className="tpick__ring"
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
        )}
        {status === 'downloading' && <path d="M10 8.5v7M14 8.5v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {status === 'paused' && <path d="M12 7.5v8m-3.2-3.2L12 15.5l3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
        {!status && (
          <path d="M12 4.5v10m-4-4 4 4 4-4M5 18.5h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

// تأكيد التحميل: الحجم، والتنبيه إلى إبقاء التطبيق مفتوحًا والإنترنت متصلًا، وتنبيه إن بدت المساحة لا تكفي
function Confirm({ ask, onClose, onConfirm }) {
  useLayer(onClose);
  const info = tafsirInfo(ask.id);
  const mb = info.bytes / 1e6;
  const tight = ask.free != null && ask.free < mb;
  return (
    <div className="tpick__scrim" onClick={onClose} role="presentation">
      <div
        className="tpick__confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={`تحميل تفسير ${info.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>تحميل تفسير {info.name}</h3>
        <p>
          لكامل القرآن، نحو <b>{sizeText(mb)}</b>. يُحفظ على الجهاز مرة واحدة، فيعمل بعدها بلا إنترنت.
        </p>
        <p className="tpick__hint">أبقِ التطبيق مفتوحًا والإنترنت متصلًا حتى يكتمل التحميل؛ وإن انقطع أكمله زرّ الاستئناف.</p>
        {tight && <p className="tpick__warn">المساحة المتاحة للتطبيق نحو {sizeText(ask.free)}، وقد لا تكفي.</p>}
        <div className="tpick__confirm-actions">
          <button type="button" className="tpick__cbtn tpick__cbtn--primary" onClick={onConfirm}>
            تحميل
          </button>
          <button type="button" className="tpick__cbtn" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
