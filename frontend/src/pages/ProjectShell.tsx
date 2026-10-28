// 프로젝트 화면 공통 틀: 왼쪽 메뉴(LNB) + 오른쪽 본문. 사내 포털 게시판 구조를 따른다.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { involvedIds, type Project } from '../store';
import { Chip, useMe } from '../ui';
import { Icon } from '../icons';
import { membership, myStatus, presentationsOf } from '../logic';

type Item = { key: string; label: string; to: string; count?: number; red?: boolean };

export function ProjectShell({ project, current, children }: { project: Project; current: string; children: ReactNode }) {
  const { db, me } = useMe();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const m = membership(db, project.id, me!.id);
  const base = `/p/${project.id}`;
  const all = presentationsOf(db, project.id);
  const st = all.map(p => myStatus(db, project, p, me!.id));
  const count = (s: string) => st.filter(x => x === s).length;
  const open = project.status === 'OPEN';

  const groups: { key: string; label: string; items: Item[] }[] = [
    {
      key: 'rate', label: '평가', items: [
        { key: 'all', label: '전체 발표', to: base, count: all.length },
        { key: 'todo', label: '평가 필요', to: `${base}?f=todo`, count: count('TODO'), red: true },
        { key: 'done', label: '평가 완료', to: `${base}?f=done`, count: count('DONE') },
        { key: 'blocked', label: '평가 불가', to: `${base}?f=blocked`, count: count('BLOCKED') },
        { key: 'scheduled', label: '발표 전', to: `${base}?f=scheduled`, count: count('SCHEDULED') },
      ],
    },
    { key: 'mine', label: '내 발표', items: [{ key: 'mine', label: '내가 참여한 발표', to: `${base}?f=mine`, count: all.filter(p => involvedIds(p).includes(me!.id)).length }] },
  ];
  if (m?.isAdmin) groups.push({
    key: 'admin', label: '관리', items: [
      { key: 'admin-run', label: '진행 관리', to: `${base}/admin?tab=run` },
      { key: 'admin-result', label: '결과 보기', to: `${base}/admin?tab=result` },
      { key: 'admin-members', label: '참여자', to: `${base}/admin?tab=members` },
      { key: 'admin-settings', label: '설정', to: `${base}/admin?tab=settings` },
    ],
  });
  const currentLabel = groups.flatMap(g => g.items).find(i => i.key === current)?.label ?? (current === 'write' ? '발표 등록·편집' : '메뉴');

  return (
    <div className={`board ${collapsed ? 'nav-collapsed' : ''}`}>
      {drawer && <div className="lnb-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`lnb ${drawer ? 'open' : ''}`} onClick={e => { if ((e.target as HTMLElement).closest('a')) setDrawer(false); }}>
        <div className="lnb-head">
          <h2 className="lnb-title" title={project.name}>{project.name}</h2>
          {m?.isAdmin && <Link to={`${base}/admin?tab=settings`} className="lnb-gear" title="평가룸 설정" aria-label="평가룸 설정"><Icon name="sliders" size={18} /></Link>}
        </div>
        <div className="lnb-status">
          {open ? <Chip tone="green" icon="play">진행 중</Chip> : <Chip icon="flag">마감됨</Chip>}
          <Chip tone="violet" icon={m?.isAdmin ? 'shield' : 'user'}>{m?.isAdmin ? '룸 운영자' : '참여자'}</Chip>
        </div>
        {open && <div className="lnb-write"><Link to={`${base}/pres/new`} className={`btn outline block ${current === 'write' ? 'on' : ''}`}><Icon name="plus" size={16} />발표 등록</Link></div>}
        {groups.map(g => {
          const isFolded = folded[g.key];
          return (
            <div key={g.key} className="lnb-group">
              <button className="lnb-group-head" onClick={() => setFolded({ ...folded, [g.key]: !isFolded })} aria-expanded={!isFolded}>
                <Icon name={isFolded ? 'right' : 'down'} size={14} />{g.label}
              </button>
              {!isFolded && (
                <ul className="lnb-list">
                  {g.items.map(i => (
                    <li key={i.key}>
                      <Link to={i.to} className={current === i.key ? 'on' : ''}>
                        <span>{i.label}</span>
                        {i.count !== undefined && <em className={i.red && i.count > 0 ? 'red' : ''}>{i.count}</em>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <Link to="/" className="lnb-back"><Icon name="back" size={14} />내 평가룸 목록</Link>
      </aside>
      <button className="lnb-collapse" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'} aria-expanded={!collapsed}><Icon name={collapsed ? 'right' : 'collapse'} size={14} /></button>
      <div className="board-main">
        <button className="lnb-toggle" onClick={() => setDrawer(d => !d)} aria-expanded={drawer}>
          <Icon name={drawer ? 'collapse' : 'menu'} size={18} />
          <span className="ellipsis"><b>{project.name}</b> · {currentLabel}</span>
        </button>
        {children}
      </div>
    </div>
  );
}

/** 게시판 본문 머리: 제목 + 개수 + (선택) 검색 */
export function BoardHead({ title, desc, count, countLabel = '전체', search, onSearch, right }: {
  title: ReactNode; desc?: ReactNode; count?: number; countLabel?: string; search?: string; onSearch?: (v: string) => void; right?: ReactNode;
}) {
  return (
    <div className="board-head">
      <div className="bh-row">
        <h1>{title}</h1>
        {onSearch && (
          <label className="board-search">
            <input placeholder="발표 제목·이름 검색" value={search} onChange={e => onSearch(e.target.value)} aria-label="검색" />
            <Icon name="search" size={16} />
          </label>
        )}
        {right}
      </div>
      {(desc || count !== undefined) && (
        <div className="bh-sub">
          <span className="muted">{desc}</span>
          {count !== undefined && <span className="bh-count">{countLabel} <b>{count}</b></span>}
        </div>
      )}
    </div>
  );
}

/** ‹ [1] / 2 › 페이지 이동 */
export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지"><Icon name="back" size={16} /></button>
      <span className="pg-cur">{page}</span><span className="pg-total">/ {total}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= total} aria-label="다음 페이지"><Icon name="right" size={16} /></button>
    </div>
  );
}
