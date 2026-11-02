import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { useMe } from '../ui';
import type { ID } from '../store';
import { TeamTreeNode, teamPath } from './OrgTree';
import { byRank, teamRank } from '../logic';

/** 조직도에서 사람을 고르는 모드 (예: 평가룸 초대). 없으면 보기 전용 조직도 */
export interface OrgPicker {
  title: string;
  hint?: string;
  /** 오른쪽 목록 제목 (예: 초대 목록) */
  listTitle?: string;
  confirmLabel: string;
  /** 고를 수 없는 사람이면 이유(예: '참여 중'), 고를 수 있으면 null */
  disabledReason: (userId: ID) => string | null;
  /** 성공하면 true를 돌려주고, 그러면 창을 닫는다 */
  onConfirm: (userIds: ID[]) => Promise<boolean>;
}

export default function OrgDirectory({ onClose, picker }: { onClose: () => void; picker?: OrgPicker }) {
  const { db, me } = useMe();
  const [selectedTeamId, setSelectedTeamId] = useState<ID | null>(() =>
    me?.teamId ?? db.teams.find(t => db.users.some(u => !u.isSysAdmin && u.teamId === t.id))?.id ?? null
  );
  const [expandedIds, setExpandedIds] = useState<Set<ID>>(() => new Set(db.teams.map(t => t.id)));
  const [teamSearch, setTeamSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [picked, setPicked] = useState<ID[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectedTeam = db.teams.find(t => t.id === selectedTeamId) ?? null;
  const allUsers = db.users.filter(u => !u.isSysAdmin);
  // 조직도 순서: 팀 구조도 순 → 팀 안 순서(위 = 높은 사람)
  const rank = teamRank(db);
  const teamOrder = (id: ID | null) => (id && rank.has(id) ? rank.get(id)! : Number.MAX_SAFE_INTEGER);
  const teamUsers = (selectedTeam ? allUsers.filter(u => u.teamId === selectedTeam.id) : allUsers)
    .sort((a, b) => teamOrder(a.teamId) - teamOrder(b.teamId) || byRank(a, b));
  const shownUsers = teamUsers.filter(u => u.name.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const selectTeam = (id: ID | null) => { setSelectedTeamId(id); setUserSearch(''); };
  const toggleTeam = (id: ID) => setExpandedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePick = (id: ID) => setPicked(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  const pickable = picker ? shownUsers.filter(u => !picker.disabledReason(u.id)) : [];
  const allShownPicked = pickable.length > 0 && pickable.every(u => picked.includes(u.id));
  const togglePickAll = () => setPicked(cur => (allShownPicked
    ? cur.filter(id => !pickable.some(u => u.id === id))
    : [...cur, ...pickable.map(u => u.id).filter(id => !cur.includes(id))]));
  const confirm = async () => {
    if (!picker || picked.length === 0) return;
    setSending(true);
    const ok = await picker.onConfirm(picked);
    setSending(false);
    if (ok) onClose();
  };
  const nameOf = (id: ID) => db.users.find(u => u.id === id)?.name ?? '(알 수 없음)';

  return (
    <div className="org-modal-backdrop" onMouseDown={onClose}>
      <div className={`org-modal ${picker ? 'picking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="org-directory-title" onMouseDown={e => e.stopPropagation()}>
        <div className="org-modal-head">
          <div>
            <h2 id="org-directory-title">{picker ? picker.title : '회사 팀 구조도'}</h2>
            <p>{picker ? picker.hint ?? '사람 옆의 체크박스를 눌러 목록에 담으세요.' : '팀을 선택하면 소속 팀원을 볼 수 있습니다.'}</p>
          </div>
          <button className="org-modal-close" type="button" aria-label="닫기" onClick={onClose} autoFocus>×</button>
        </div>
        <div className={`org-layout org-directory ${picker ? 'with-picks' : ''}`}>
          <aside className="org-sidebar" aria-label="회사 팀 목록">
            <div className="org-pane-head"><strong>부서·팀</strong></div>
            <div className="org-search">
              <Icon name="search" size={16} />
              <input aria-label="부서 또는 팀 검색" placeholder="부서·팀 검색" value={teamSearch} onChange={e => setTeamSearch(e.target.value)} />
            </div>
            <div className="org-tree">
              <button className={`org-all ${!selectedTeam ? 'selected' : ''}`} onClick={() => selectTeam(null)}>
                전체 사용자 <small>{allUsers.length}명</small>
              </button>
              {db.teams.filter(t => t.parentId === null).map(t => (
                <TeamTreeNode key={t.id} team={t} teams={db.teams} users={db.users} depth={0}
                  selectedId={selectedTeam?.id ?? null} expandedIds={expandedIds}
                  search={teamSearch.trim().toLowerCase()} onSelect={selectTeam} onToggle={toggleTeam} />
              ))}
            </div>
          </aside>
          <section className="org-main" aria-label="팀원 목록">
            <div className="org-toolbar">
              <div className="org-search grow">
                <Icon name="search" size={16} />
                <input aria-label="팀원 검색" placeholder="이름 검색" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
            </div>
            <div className="org-result-head">
              <div><strong>{selectedTeam?.name ?? '전체 사용자'}</strong> <span className="muted">총 <b>{shownUsers.length}</b> / {teamUsers.length}명</span></div>
            </div>
            <div className="org-table-wrap">
              <table className="org-table">
                <thead>
                  <tr>
                    {picker && <th className="org-check"><input type="checkbox" aria-label="보이는 사람 모두 선택" checked={allShownPicked} disabled={pickable.length === 0} onChange={togglePickAll} /></th>}
                    <th>이름</th><th>직위</th><th>소속 팀</th>
                  </tr>
                </thead>
                <tbody>
                  {shownUsers.map(u => {
                    const reason = picker?.disabledReason(u.id) ?? null;
                    return (
                      <tr key={u.id} className={picker && !reason ? 'pickable' : ''} onClick={picker && !reason ? () => togglePick(u.id) : undefined}>
                        {picker && (
                          <td className="org-check">
                            {reason
                              ? <span className="muted small">{reason}</span>
                              : <input type="checkbox" aria-label={`${u.name} 선택`} checked={picked.includes(u.id)} onChange={() => togglePick(u.id)} onClick={e => e.stopPropagation()} />}
                          </td>
                        )}
                        <td><strong>{u.name}</strong></td><td>{u.position || <span className="muted">-</span>}</td><td>{teamPath(db.teams, u.teamId)}</td>
                      </tr>
                    );
                  })}
                  {shownUsers.length === 0 && <tr><td colSpan={picker ? 4 : 3} className="org-empty">표시할 팀원이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          {picker && (
            <aside className="org-picks" aria-label={picker.listTitle ?? '선택 목록'}>
              <div className="org-pane-head"><strong>{picker.listTitle ?? '선택 목록'}</strong><small className="muted">{picked.length}명</small></div>
              <div className="org-picks-list">
                {picked.length === 0 && <p className="muted small">아직 선택한 사람이 없어요.</p>}
                {picked.map(id => (
                  <div key={id} className="org-pick">
                    <span className="ellipsis"><b>{nameOf(id)}</b> <small className="muted">{teamPath(db.teams, db.users.find(u => u.id === id)?.teamId ?? null)}</small></span>
                    <button type="button" className="org-pick-remove" aria-label={`${nameOf(id)} 빼기`} onClick={() => togglePick(id)}>×</button>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
        {picker && <div className="org-picks-foot">
          <button className="btn primary solid" disabled={picked.length === 0 || sending} onClick={confirm}>
            {picker.confirmLabel} {picked.length > 0 && `(${picked.length}명)`}
          </button>
        </div>}
      </div>
    </div>
  );
}
