import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { addTeam, addUserToTeam, deleteTeam, setUserTeam, updateTeam, type ID } from '../store';
import { run, useMe } from '../ui';
import { Icon } from '../icons';
import { TeamSelect } from './Auth';
import { TeamTreeNode, teamPath } from './OrgTree';

type Panel = 'none' | 'create' | 'edit' | 'users' | 'delete';
const blankUser = { loginId: '', password: '', name: '', phone: '' };

export default function SysAdminLayout() {
  const { db, me } = useMe();
  const [selectedTeamId, setSelectedTeamId] = useState<ID | null>(() =>
    db.teams.find(t => db.users.some(u => !u.isSysAdmin && u.teamId === t.id))?.id ?? db.teams[0]?.id ?? null
  );
  const [expandedIds, setExpandedIds] = useState<Set<ID>>(() => new Set(db.teams.map(t => t.id)));
  const [teamSearch, setTeamSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchField, setSearchField] = useState<'name' | 'loginId' | 'phone'>('name');
  const [panel, setPanel] = useState<Panel>('none');
  const [teamName, setTeamName] = useState('');
  const [parentId, setParentId] = useState<ID | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [newUser, setNewUser] = useState(blankUser);

  if (!me?.isSysAdmin) return <Navigate to="/" replace />;
  const selectedTeam = db.teams.find(t => t.id === selectedTeamId) ?? null;
  const allUsers = db.users.filter(u => !u.isSysAdmin);
  const teamUsers = selectedTeam ? allUsers.filter(u => u.teamId === selectedTeam.id) : allUsers;
  const shownUsers = teamUsers.filter(u => u[searchField].toLowerCase().includes(userSearch.trim().toLowerCase()));
  const otherUsers = selectedTeam ? allUsers.filter(u => u.teamId !== selectedTeam.id) : [];
  const deleteBlocker = selectedTeam && (
    db.teams.some(t => t.parentId === selectedTeam.id) ? '하위 팀이 있어 삭제할 수 없습니다.' :
    teamUsers.length > 0 ? '소속 사용자가 있어 삭제할 수 없습니다.' : null
  );

  const selectTeam = (id: ID | null) => { setSelectedTeamId(id); setPanel('none'); setUserSearch(''); setAssignUserId(''); };
  const toggleTeam = (id: ID) => setExpandedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openCreate = (parent: ID | null) => { setParentId(parent); setTeamName(''); setPanel('create'); };
  const openEdit = () => {
    if (!selectedTeam) return;
    setTeamName(selectedTeam.name);
    setParentId(selectedTeam.parentId);
    setPanel('edit');
  };

  return (
    <div className="stack lg sys-admin-page">
      <div className="page-head">
        <h1>회사 팀 구조도</h1>
        <p className="muted">왼쪽에서 팀을 선택하면 해당 팀의 사용자 정보를 확인하고 관리할 수 있어요.</p>
      </div>
      <div className="org-layout">
        <aside className="org-sidebar" aria-label="회사 팀 목록">
          <div className="org-pane-head">
            <strong>부서·팀</strong>
            <button className="btn sm primary" onClick={() => openCreate(null)}>+ 최상위 팀</button>
          </div>
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
            {db.teams.length === 0 && <p className="org-tree-empty">등록된 팀이 없습니다.</p>}
          </div>
        </aside>

        <section className="org-main" aria-label="사용자 정보">
          <div className="org-toolbar">
            <select aria-label="사용자 검색 기준" value={searchField} onChange={e => setSearchField(e.target.value as typeof searchField)}>
              <option value="name">이름</option><option value="loginId">아이디</option><option value="phone">전화번호</option>
            </select>
            <div className="org-search grow">
              <Icon name="search" size={16} />
              <input aria-label="사용자 검색" placeholder="사용자를 검색하세요." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
          </div>
          <div className="org-result-head">
            <div><strong>{selectedTeam?.name ?? '전체 사용자'}</strong> <span className="muted">총 <b>{shownUsers.length}</b> / {teamUsers.length}명</span></div>
            {selectedTeam && (
              <div className="org-actions">
                <button className={`btn sm ${panel === 'create' ? 'primary' : 'ghost'}`} onClick={() => openCreate(selectedTeam.id)}>+ 하위 팀</button>
                <button className={`btn sm ${panel === 'edit' ? 'primary' : 'ghost'}`} onClick={openEdit}>팀 수정</button>
                <button className={`btn sm ${panel === 'users' ? 'primary' : 'ghost'}`} onClick={() => setPanel(panel === 'users' ? 'none' : 'users')}>+ 사용자</button>
                <button className={`btn sm ${panel === 'delete' ? 'danger' : 'ghost'}`} onClick={() => setPanel(panel === 'delete' ? 'none' : 'delete')}>팀 삭제</button>
              </div>
            )}
          </div>
          {panel === 'create' && (
            <form className="org-editor" onSubmit={e => {
              e.preventDefault();
              if (run(() => addTeam(me.id, teamName, parentId), '팀을 추가했습니다.')) { setPanel('none'); setTeamName(''); }
            }}>
              <div className="org-editor-head">
                <div><strong>{parentId ? '하위 팀 추가' : '최상위 팀 추가'}</strong><p>{parentId ? `${teamPath(db.teams, parentId)} 아래에 팀을 만듭니다.` : '회사 팀 구조도의 최상위에 팀을 만듭니다.'}</p></div>
                <button className="org-editor-close" type="button" aria-label="닫기" onClick={() => setPanel('none')}>×</button>
              </div>
              <div className="org-form-grid">
                <label className="org-field"><span>팀 이름</span><input placeholder="팀 이름을 입력하세요" value={teamName} onChange={e => setTeamName(e.target.value)} required /></label>
                <div className="org-field"><span>상위 팀</span><div className="org-field-value">{parentId ? teamPath(db.teams, parentId) : '없음 · 최상위 팀'}</div></div>
              </div>
              <div className="org-editor-actions"><button className="btn" type="button" onClick={() => setPanel('none')}>취소</button><button className="btn primary solid" type="submit">팀 추가</button></div>
            </form>
          )}
          {panel === 'edit' && selectedTeam && (
            <form className="org-editor" onSubmit={e => {
              e.preventDefault();
              if (run(() => updateTeam(me.id, selectedTeam.id, teamName, parentId), '팀을 수정했습니다.')) setPanel('none');
            }}>
              <div className="org-editor-head">
                <div><strong>팀 수정</strong><p>팀 이름이나 상위 팀을 변경합니다.</p></div>
                <button className="org-editor-close" type="button" aria-label="닫기" onClick={() => setPanel('none')}>×</button>
              </div>
              <div className="org-form-grid">
                <label className="org-field"><span>팀 이름</span><input value={teamName} onChange={e => setTeamName(e.target.value)} required /></label>
                <div className="org-field"><span>상위 팀</span><TeamSelect value={parentId} onChange={setParentId} allowEmpty /></div>
              </div>
              <div className="org-editor-actions"><button className="btn" type="button" onClick={() => setPanel('none')}>취소</button><button className="btn primary solid" type="submit">변경 저장</button></div>
            </form>
          )}
          {panel === 'users' && selectedTeam && (
            <div className="org-editor">
              <div className="org-editor-head">
                <div><strong>사용자 추가</strong><p>{selectedTeam.name}에 기존 사용자를 배정하거나 새 계정을 등록합니다.</p></div>
                <button className="org-editor-close" type="button" aria-label="닫기" onClick={() => setPanel('none')}>×</button>
              </div>
              <div className="org-subsection">
                <strong>기존 사용자 배정</strong>
                <div className="org-assign">
                  <label className="org-field"><span>사용자</span>
                    <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
                      <option value="">사용자를 선택하세요</option>
                      {otherUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.loginId}) · {teamPath(db.teams, u.teamId)}</option>)}
                    </select>
                  </label>
                  <button className="btn primary solid" type="button" disabled={!assignUserId} onClick={() => {
                    if (run(() => setUserTeam(me.id, assignUserId, selectedTeam.id), '사용자를 팀에 배정했습니다.')) setAssignUserId('');
                  }}>팀에 배정</button>
                </div>
              </div>
              <form className="org-new-user" onSubmit={e => {
                e.preventDefault();
                if (run(() => addUserToTeam(me.id, selectedTeam.id, newUser), '사용자를 등록했습니다.')) setNewUser(blankUser);
              }}>
                <strong>새 사용자 등록</strong>
                <div className="org-form-grid">
                  <label className="org-field"><span>이름</span><input placeholder="실명" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required /></label>
                  <label className="org-field"><span>아이디</span><input placeholder="로그인 아이디" value={newUser.loginId} onChange={e => setNewUser({ ...newUser, loginId: e.target.value })} required /></label>
                  <label className="org-field"><span>초기 비밀번호</span><input type="password" placeholder="초기 비밀번호" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required /></label>
                  <label className="org-field"><span>전화번호</span><input type="tel" placeholder="전화번호" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} required /></label>
                </div>
                <div className="org-editor-actions"><button className="btn" type="button" onClick={() => setPanel('none')}>취소</button><button className="btn primary solid" type="submit">사용자 등록</button></div>
              </form>
            </div>
          )}
          {panel === 'delete' && selectedTeam && (
            <div className="org-editor org-editor-danger">
              <div className="org-editor-head">
                <div><strong>팀 삭제</strong><p>삭제할 팀을 확인해 주세요.</p></div>
                <button className="org-editor-close" type="button" aria-label="닫기" onClick={() => setPanel('none')}>×</button>
              </div>
              <div className="org-delete-summary"><Icon name="trash" size={18} /><span><b>{selectedTeam.name}</b>{deleteBlocker ? ` · ${deleteBlocker}` : ' · 삭제 후 복구할 수 없습니다.'}</span></div>
              <div className="org-editor-actions"><button className="btn" onClick={() => setPanel('none')}>취소</button><button className="btn danger solid" disabled={!!deleteBlocker} onClick={() => {
                if (run(() => deleteTeam(me.id, selectedTeam.id), '팀을 삭제했습니다.')) selectTeam(null);
              }}>팀 삭제</button></div>
            </div>
          )}
          <div className="org-table-wrap">
            <table className="org-table">
              <thead><tr><th>이름</th><th>아이디</th><th>소속 팀</th><th>전화번호</th></tr></thead>
              <tbody>
                {shownUsers.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td><td className="mono">{u.loginId}</td>
                    <td>{teamPath(db.teams, u.teamId)}</td><td>{u.phone}</td>
                  </tr>
                ))}
                {shownUsers.length === 0 && <tr><td colSpan={4} className="org-empty">표시할 사용자가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="org-footer">사용자 정보는 조회 전용입니다. 팀 배정과 신규 등록은 위의 사용자 관리에서 할 수 있습니다.</div>
        </section>
      </div>
    </div>
  );
}
