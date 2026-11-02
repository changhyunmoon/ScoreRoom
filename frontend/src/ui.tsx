import { useEffect, useState, type ReactNode } from 'react';
import { AppError, useStore } from './store';
import { Icon, type IconName } from './icons';

/* ---------- 토스트 ---------- */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
let toasts: Toast[] = [];
const toastListeners = new Set<(t: Toast[]) => void>();
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: Date.now() + Math.random(), text, tone };
  toasts = [...toasts, t];
  toastListeners.forEach(l => l(toasts));
  setTimeout(() => { toasts = toasts.filter(x => x !== t); toastListeners.forEach(l => l(toasts)); }, 2600);
}
export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => { toastListeners.add(setList); return () => { toastListeners.delete(setList); }; }, []);
  return <div className="toaster">{list.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}</div>;
}

/** 목업 데이터 변경을 실행하고 성공 메시지 또는 에러 토스트를 띄운다. 성공 여부를 돌려준다. */
export async function run(fn: () => unknown, okText?: string): Promise<boolean> {
  try { await fn(); if (okText) toast(okText); return true; }
  catch (e) { toast(e instanceof AppError ? e.message : '오류가 발생했습니다.', 'err'); if (!(e instanceof AppError)) console.error(e); return false; }
}

export function useMe() {
  const { db, session, status } = useStore();
  return { db, status, me: db.users.find(u => u.id === session) ?? null };
}

/** 두 번 눌러야 실행되는 위험 버튼 (브라우저 confirm 대신) */
export function ConfirmButton({ label, confirmLabel = '정말 실행할까요?', onConfirm, className = 'btn danger', disabled, detail }:
  { label: string; confirmLabel?: string; onConfirm: () => void; className?: string; disabled?: boolean; detail?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 5000); return () => clearTimeout(t); }, [armed]);
  if (!armed) return <button className={className} disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
  return (
    <div className="confirm">
      {detail && <div className="confirm-detail">{detail}</div>}
      <div className="row gap">
        <button className="btn danger solid" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
        <button className="btn ghost" onClick={() => setArmed(false)}>취소</button>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
export function Chip({ tone = 'gray', icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function Empty({ icon = 'info', children }: { icon?: IconName; children: ReactNode }) {
  return <div className="empty"><Icon name={icon} size={28} /><div>{children}</div></div>;
}

/** 아이콘 + 제목 + 한 줄 설명. 섹션이 무엇을 하는 곳인지 바로 보이게 한다 */
export function SectionTitle({ icon, title, desc, right, tone = 'blue' }: { icon: IconName; title: ReactNode; desc?: ReactNode; right?: ReactNode; tone?: Tone }) {
  return (
    <div className="section-title">
      <span className={`st-icon ${tone}`}><Icon name={icon} size={18} /></span>
      <div className="grow">
        <h2>{title}</h2>
        {desc && <p className="st-desc">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/** 버튼 안 아이콘 + 글자 */
export const IconText = ({ icon, children }: { icon: IconName; children: ReactNode }) => <><Icon name={icon} size={16} />{children}</>;

/** 1초마다 리렌더 (초대 코드 남은 시간 표시용) */
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

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
