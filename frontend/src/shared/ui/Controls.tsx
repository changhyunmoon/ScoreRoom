// 공통 화면 조각: 확인 버튼, 입력 칸, 칩, 빈 상태, 섹션 제목, 아이콘 글자
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';

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
