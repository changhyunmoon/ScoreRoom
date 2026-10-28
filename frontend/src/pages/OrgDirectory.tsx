import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { useMe } from '../ui';
import type { ID } from '../store';
import { TeamTreeNode, teamPath } from './OrgTree';

export default function OrgDirectory({ onClose }: { onClose: () => void }) {
  const { db, me } = useMe();
  const [selectedTeamId, setSelectedTeamId] = useState<ID | null>(() =>
    me?.teamId ?? db.teams.find(t => db.users.some(u => !u.isSysAdmin && u.teamId === t.id))?.id ?? null
  );
  const [expandedIds, setExpandedIds] = useState<Set<ID>>(() => new Set(db.teams.map(t => t.id)));
  const [teamSearch, setTeamSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectedTeam = db.teams.find(t => t.id === selectedTeamId) ?? null;
  const allUsers = db.users.filter(u => !u.isSysAdmin);
  const teamUsers = selectedTeam ? allUsers.filter(u => u.teamId === selectedTeam.id) : allUsers;
  const shownUsers = teamUsers.filter(u => u.name.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const selectTeam = (id: ID | null) => { setSelectedTeamId(id); setUserSearch(''); };
  const toggleTeam = (id: ID) => setExpandedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="org-modal-backdrop" onMouseDown={onClose}>
      <div className="org-modal" role="dialog" aria-modal="true" aria-labelledby="org-directory-title" onMouseDown={e => e.stopPropagation()}>
        <div className="org-modal-head">
          <div><h2 id="org-directory-title">회사 팀 구조도</h2><p>팀을 선택하면 소속 팀원을 볼 수 있습니다.</p></div>
          <button className="org-modal-close" type="button" aria-label="닫기" onClick={onClose} autoFocus>×</button>
        </div>
        <div className="org-layout org-directory">
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
                <thead><tr><th>이름</th><th>소속 팀</th></tr></thead>
                <tbody>
                  {shownUsers.map(u => (
                    <tr key={u.id}><td><strong>{u.name}</strong></td><td>{teamPath(db.teams, u.teamId)}</td></tr>
                  ))}
                  {shownUsers.length === 0 && <tr><td colSpan={2} className="org-empty">표시할 팀원이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
