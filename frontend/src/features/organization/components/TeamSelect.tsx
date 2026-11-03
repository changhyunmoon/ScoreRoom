import type { ID } from '../../../shared/lib/types';
import { teamOptions } from '../model/org';
import type { Team } from '../model/types';

/** 상하 관계를 들여쓰기로 보여주는 팀 선택 */
export function TeamSelect({ teams, value, onChange, allowEmpty }: { teams: Team[]; value: ID | null; onChange: (v: ID | null) => void; allowEmpty?: boolean }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      <option value="" disabled={!allowEmpty}>{allowEmpty ? '소속 없음' : '팀을 선택하세요'}</option>
      {teamOptions(teams).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
