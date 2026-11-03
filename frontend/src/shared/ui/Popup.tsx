import { useEffect, type ReactNode } from 'react';

/** 작은 팝업 틀 (모든 팝업 같은 크기). 머리 / 본문(넘치면 스크롤) / 바닥 버튼 줄. ESC나 바깥을 누르면 닫힌다 */
export function Popup({ label, head, onClose, children, foot, className = '' }: { label: string; head: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; className?: string }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="org-modal-backdrop" onClick={onClose}>
      <div className={`org-modal pres-popup ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <div className="pres-popup-head">
          <div>{head}</div>
          <button type="button" className="org-modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="pres-popup-body">{children}</div>
        <div className="pres-popup-foot">{foot ?? <button type="button" className="btn" onClick={onClose}>닫기</button>}</div>
      </div>
    </div>
  );
}
