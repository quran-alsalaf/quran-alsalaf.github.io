import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BACKUP_ERRORS,
  backupFileName,
  backupText,
  buildBackup,
  lastBackupText,
  markBackup,
  parseBackup,
  restoreBackup,
  summarizeBackup,
} from '../lib/backup.js';
import { deliverBackup } from '../lib/backupFile.js';
import { useLayer } from '../lib/layers.js';

/*
  صفحة «النسخ الاحتياطي» الفرعية في الإعدادات (٢٠٢٦-١١-١٦، واسمها «النسخة الاحتياطية» حتى ٢٠٢٦-١١-٢٣؛ يفتحها سطر واحد في الإعدادات، وفيها خياران):
    • «حفظ نسخة احتياطية» — وتحته سطر هادئ بتاريخ آخر نسخة على هذا الجهاز (بلا رسائل منبثقة).
    • «استعادة من نسخة» — يختار المستخدم الملف، فيرى ملخّص ما فيه وتنبيه الاستبدال الكامل، ثم يؤكّد؛
      فتُستبدل البيانات ويُعاد تحميل التطبيق على موضع القراءة المحفوظ في النسخة.
  المنطق في src/lib/backup.js، وتسليم الملف للجهاز في src/lib/backupFile.js.
*/
export default function BackupRows() {
  const [last, setLast] = useState(() => lastBackupText());
  const [busy, setBusy] = useState(false);
  // نافذة الاستعادة: { backup, summary } للتأكيد، أو { error } لرسالة
  const [ask, setAsk] = useState(null);
  const input = useRef(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const result = await deliverBackup(backupText(buildBackup(now)), backupFileName(now));
      if (result !== 'cancelled') {
        markBackup(now);
        setLast(lastBackupText());
      }
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // فيُقبل اختيار الملف نفسه مرة أخرى
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch {
      setAsk({ error: BACKUP_ERRORS.invalid });
      return;
    }
    const parsed = parseBackup(text);
    setAsk(parsed.ok ? { backup: parsed.backup, summary: summarizeBackup(parsed.backup) } : { error: BACKUP_ERRORS[parsed.error] });
  };

  const confirm = () => {
    if (!restoreBackup(ask.backup)) {
      setAsk({ error: 'تعذّر حفظ البيانات على هذا الجهاز (قد يكون التصفح خاصًّا). لم يتغيّر شيء.' });
      return;
    }
    window.location.reload();
  };

  return (
    <>
      <p className="backup__lead">تحفظ علاماتك وملاحظاتك وختماتك وإعداداتك في ملف واحد، تحتفظ به أو تنقله إلى جهاز آخر وتستعيدها منه.</p>
      <div className="settings__group">
        <button type="button" className="settings__row settings__link" onClick={save} disabled={busy}>
          <span className="settings__label">
            حفظ نسخة احتياطية
            <small className="backup__last">{last}</small>
          </span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__icon">
            <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="settings__row settings__link" onClick={() => input.current?.click()}>
          <span className="settings__label">استعادة من نسخة</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="settings__icon">
            <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 19.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={onFile} aria-label="ملف النسخة الاحتياطية" />
      {ask && createPortal(<RestoreDialog ask={ask} onClose={() => setAsk(null)} onConfirm={confirm} />, document.body)}
    </>
  );
}

function RestoreDialog({ ask, onClose, onConfirm }) {
  useLayer(onClose);
  const s = ask.summary;
  return (
    <div className="backup__scrim" onClick={onClose} role="presentation">
      <div
        className="backup__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={s ? 'استعادة من نسخة' : 'تعذّرت الاستعادة'}
        onClick={(e) => e.stopPropagation()}
      >
        {s ? (
          <>
            <h3>استعادة من نسخة</h3>
            <p className="backup__date">
              حُفظت يوم {s.date}
              <br />
              <span>{s.hijri}</span>
            </p>
            <ul className="backup__summary">
              {s.riwayah && <li>رواية {s.riwayah}</li>}
              {s.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="backup__warn">ستُستبدل بياناتك الحالية كلها ببيانات هذه النسخة: العلامات والملاحظات والختمة والإعدادات وموضع القراءة.</p>
            <div className="backup__actions">
              <button type="button" className="backup__btn backup__btn--primary" onClick={onConfirm}>
                استعادة
              </button>
              <button type="button" className="backup__btn" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>تعذّرت الاستعادة</h3>
            <p>{ask.error}</p>
            <div className="backup__actions">
              <button type="button" className="backup__btn backup__btn--primary" onClick={onClose}>
                حسنًا
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
