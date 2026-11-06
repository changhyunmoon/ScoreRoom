// 시스템 관리자: 사용자별 권한 관리 화면 (전체 열람 권한, 평가룸 생성 권한이 같은 화면을 쓴다).
// 위에서 검색하거나 조직도에서 골라 권한을 주고, 아래 목록에서 회수한다.
import { useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { IconText, run, toast } from '../../../shared/ui';
import { mutate, refresh, useSession } from '../../session';
import { teamPath } from '../model/org';
import type { User } from '../model/types';
import { OrgDirectory } from './OrgDirectory';

export interface PermissionConfig {
  /** 권한 이름 (예: 전체 열람 권한) */
  name: string;
  /** 화면 위 설명 */
  desc: string;
  has: (u: User) => boolean;
  set: (userId: ID, enabled: boolean) => Promise<unknown>;
}

export function PermissionManager({ name, desc, has, set }: PermissionConfig) {
  const { db } = useSession();
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(false);

  const users = db.users.filter(u => !u.isSysAdmin);
  const granted = users.filter(has).sort((a, b) => a.name.localeCompare(b.name));
  const kw = q.trim().toLowerCase();
  const found = kw
    ? users.filter(u => [u.name, u.loginId, teamPath(db.teams, u.teamId)].some(v => v.toLowerCase().includes(kw)))
    : [];

  const row = (u: User) => (
    <tr key={u.id}>
      <td>
        <strong>{u.name}</strong>
        {/* 좁은 화면에서는 이메일·소속 팀 칸을 숨기고 이름 아래에 보여 준다 */}
        <small className="viewer-sub">{u.loginId} · {teamPath(db.teams, u.teamId).split(' > ').pop()}</small>
      </td>
      <td className="viewer-wide">{u.loginId}</td>
      <td className="viewer-wide">{teamPath(db.teams, u.teamId)}</td>
      <td className="right">
        {has(u)
          ? <button className="btn sm danger" onClick={() => run(() => mutate(set(u.id, false)), `${u.name}님의 ${name}을 회수했습니다.`)}>권한 회수</button>
          : <button className="btn sm primary solid" onClick={() => run(() => mutate(set(u.id, true)), `${u.name}님에게 ${name}을 주었습니다.`)}>권한 주기</button>}
      </td>
    </tr>
  );

  return (
    <div className="stack lg sys-admin-page">
      <div className="page-head">
        <h1>{name}</h1>
        <p className="muted">{desc}</p>
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
              <thead><tr><th>이름</th><th className="viewer-wide">이메일</th><th className="viewer-wide">소속 팀</th><th /></tr></thead>
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
            <thead><tr><th>이름</th><th className="viewer-wide">이메일</th><th className="viewer-wide">소속 팀</th><th /></tr></thead>
            <tbody>
              {granted.map(row)}
              {granted.length === 0 && <tr><td colSpan={4} className="org-empty">아직 권한을 받은 사람이 없습니다. 위에서 검색해 추가하세요.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {picking && (
        <OrgDirectory onClose={() => setPicking(false)} picker={{
          title: `${name} 주기`,
          hint: '조직도를 보면서 권한을 줄 사람을 체크하세요.',
          listTitle: '권한 줄 사람',
          confirmLabel: '권한 주기',
          disabledReason: id => { const u = users.find(x => x.id === id); return u && has(u) ? '권한 있음' : null; },
          onConfirm: async ids => {
            const ok = await run(async () => {
              try {
                for (const id of ids) await set(id, true);
              } finally {
                await refresh();
              }
            });
            if (ok) toast(`${ids.length}명에게 ${name}을 주었습니다.`);
            return ok;
          },
        }} />
      )}
    </div>
  );
}
