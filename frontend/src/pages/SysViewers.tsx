// 시스템 관리자: 전체 열람 권한 관리.
// 권한을 받은 사람은 모든 평가룸(진행 중·마감)의 발표 목록·내용·자료와 결과 집계를 볼 수 있다. 평가·등록·편집은 못 한다.
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { setViewAll } from '../store';
import OrgDirectory from './OrgDirectory';
import { IconText, run, toast, useMe } from '../ui';
import { Icon } from '../icons';
import { teamPath } from './OrgTree';

export default function SysViewers() {
  const { db, me } = useMe();
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(false);
  if (!me?.isSysAdmin) return <Navigate to="/" replace />;

  const users = db.users.filter(u => !u.isSysAdmin);
  const granted = users.filter(u => u.canViewAll).sort((a, b) => a.name.localeCompare(b.name));
  const kw = q.trim().toLowerCase();
  const found = kw
    ? users.filter(u => [u.name, u.loginId, teamPath(db.teams, u.teamId)].some(v => v.toLowerCase().includes(kw)))
    : [];

  const row = (u: (typeof users)[number]) => (
    <tr key={u.id}>
      <td><strong>{u.name}</strong></td>
      <td>{u.loginId}</td>
      <td>{teamPath(db.teams, u.teamId)}</td>
      <td className="right">
        {u.canViewAll
          ? <button className="btn sm danger" onClick={() => run(() => setViewAll(u.id, false), `${u.name}님의 전체 열람 권한을 회수했습니다.`)}>권한 회수</button>
          : <button className="btn sm primary solid" onClick={() => run(() => setViewAll(u.id, true), `${u.name}님에게 전체 열람 권한을 주었습니다.`)}>권한 주기</button>}
      </td>
    </tr>
  );

  return (
    <div className="stack lg sys-admin-page">
      <div className="page-head">
        <h1>전체 열람 권한</h1>
        <p className="muted">권한을 받은 사람은 모든 평가룸의 발표와 결과 집계를 볼 수 있어요. 평가·등록·편집은 할 수 없어요.</p>
      </div>

      <section className="stack">
        <div className="row gap wrap">
          <div className="org-search viewer-search grow">
            <Icon name="search" size={16} />
            <input aria-label="사용자 검색" placeholder="이름, 이메일, 팀으로 사용자 검색" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          </div>
          <button className="btn primary solid" onClick={() => setPicking(true)}><IconText icon="tree">조직도에서 고르기</IconText></button>
        </div>
        {/* 검색 결과 칸은 높이를 고정하고 안에서만 스크롤한다 (아래 목록이 움직이지 않게) */}
        <div className="org-table-wrap viewer-results">
          {found.length > 0 ? (
            <table className="org-table">
              <thead><tr><th>이름</th><th>이메일</th><th>소속 팀</th><th /></tr></thead>
              <tbody>{found.map(row)}</tbody>
            </table>
          ) : (
            <p className="viewer-empty">{kw ? '검색 결과가 없습니다.' : '이름, 이메일, 팀으로 검색하면 여기에 결과가 나와요.'}</p>
          )}
        </div>
      </section>

      <section className="stack">
        <h2 className="viewer-title">권한이 있는 사람 <span className="muted">{granted.length}명</span></h2>
        <div className="org-table-wrap">
          <table className="org-table">
            <thead><tr><th>이름</th><th>이메일</th><th>소속 팀</th><th /></tr></thead>
            <tbody>
              {granted.map(row)}
              {granted.length === 0 && <tr><td colSpan={4} className="org-empty">아직 권한을 받은 사람이 없습니다. 위에서 검색해 추가하세요.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {picking && (
        <OrgDirectory onClose={() => setPicking(false)} picker={{
          title: '전체 열람 권한 주기',
          hint: '조직도를 보면서 권한을 줄 사람을 체크하세요.',
          listTitle: '권한 줄 사람',
          confirmLabel: '권한 주기',
          disabledReason: id => (users.find(u => u.id === id)?.canViewAll ? '권한 있음' : null),
          onConfirm: async ids => {
            const ok = await run(async () => { for (const id of ids) await setViewAll(id, true); });
            if (ok) toast(`${ids.length}명에게 전체 열람 권한을 주었습니다.`);
            return ok;
          },
        }} />
      )}
    </div>
  );
}
