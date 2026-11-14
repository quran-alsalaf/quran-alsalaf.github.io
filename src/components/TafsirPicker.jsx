import { useEffect, useRef, useState } from 'react';
import { TAFSIR_SOURCES, tafsirInfo } from '../lib/study.js';
import { useLayer } from '../lib/layers.js';
import './TafsirPicker.css';

/*
  اختيار التفسير (٢٠٢٦-١١-١٤، بدل زرّي «المختصر | الميسّر» المتجاورين): زرّ باسم التفسير الحالي
  وسهم، يفتح قائمة التفاسير تحته، والاختيار بضغطة. هو نفسه في صفحات المحتوى وفي بطاقة التفسير من
  مربع الآية، والاختيار واحد فيهما (useTafsirSource).
  تُغلق القائمة بالاختيار، وبالنقر خارجها، وبـEsc (طبقة فوق ما تحتها، فلا يُغلق Esc الصفحة معها)،
  وبالزر نفسه. وبلوحة المفاتيح: السهمان بين التفاسير، وEnter أو المسافة للاختيار، وHome/End.
*/
// align: 'center' (تحت الزر في وسطه) أو 'start' (من طرف الزر الأيمن، لزرٍّ على حافة ضيقة كبطاقة الآية)
export default function TafsirPicker({ value, onChange, align = 'center' }) {
  const [open, setOpen] = useState(false);
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
    const outside = (e) => {
      if (!root.current?.contains(e.target)) close(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  const choose = (id) => {
    if (id !== value) onChange(id);
    close();
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
      if (i >= 0) choose(items[i].dataset.id);
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
          {TAFSIR_SOURCES.map((s) => (
            <li
              key={s.id}
              role="option"
              tabIndex={-1}
              data-id={s.id}
              aria-selected={s.id === value}
              className="tpick__item"
              onClick={() => choose(s.id)}
            >
              <span className="tpick__name">{s.name}</span>
              <span className="tpick__title">{s.title}</span>
              {s.id === value && (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tpick__check">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
