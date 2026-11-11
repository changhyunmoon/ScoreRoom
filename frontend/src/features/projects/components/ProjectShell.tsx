// 평가룸 화면 공통 틀: 왼쪽 메뉴(LNB) + 오른쪽 본문. 사내 포털 게시판 구조를 따른다.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../shared/icons/Icon';
import { Chip, Empty } from '../../../shared/ui';
import { presentationOfUser, presenterRoster } from '../../presentations';
import { useSession } from '../../session';
import { members, membership, roomAccess } from '../model/access';
import type { Project } from '../model/types';

type Item = { key: string; label: string; to: string; count?: number; red?: boolean };

/** 없거나 볼 수 없는 평가룸 (삭제·잘못된 주소·권한 없음) */
export function RoomNotFound() {
  return <Empty icon="lock">평가룸을 찾을 수 없거나 볼 수 있는 권한이 없어요. <Link to="/">평가룸 목록으로</Link></Empty>;
}

export function ProjectShell({ project, current, children }: { project: Project; current: string; children: ReactNode }) {
  const { db, me } = useSession();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const m = membership(db, project.id, me!.id);
  // 전체 열람 권한으로 들어온 경우: 발표와 결과만 볼 수 있다
  const viewer = roomAccess(db, project.id, me!) === 'viewer';
  const base = `/p/${project.id}`;
  // 발표 화면 목록과 같은 인원 (룸 관리자 발표를 끈 평가룸이면 관리자는 뺀다)
  const people = presenterRoster(db, project.id, members(db, project.id), project.settings.allowAdminPresent).length;
  const myPres = presentationOfUser(db, project.id, me!.id);
  const open = project.status === 'OPEN';

  const groups: { key: string; label: string; items: Item[] }[] = viewer ? [
    {
      key: 'view', label: '열람', items: [
        { key: 'all', label: '발표', to: base, count: people },
        { key: 'results', label: '결과 현황', to: `${base}/results` },
      ],
    },
  ] : [
    { key: 'rate', label: '발표', items: [{ key: 'all', label: '발표', to: base, count: people }] },
    // 룸 관리자 발표를 끈 평가룸이면 관리자에게 내 발표가 없다 (이미 발표가 있으면 보여 준다)
    ...(m?.isAdmin && !myPres && !project.settings.allowAdminPresent ? [] : [{ key: 'mine', label: '내 발표', items: [{ key: 'mine', label: '내 발표', to: `${base}?f=mine` }] }]),
  ];
  if (m?.isAdmin) groups.push({
    key: 'admin', label: '관리', items: [
      // 업무 순서: 사람 모으기 → 모인 사람 확인 → 발표 진행 → 결과 확인 → 설정
      { key: 'admin-invite', label: '초대·입장 코드', to: `${base}/admin?tab=invite` },
      { key: 'admin-members', label: '참여자', to: `${base}/admin?tab=members` },
      { key: 'admin-run', label: '발표 관리', to: `${base}/admin?tab=run` },
      { key: 'results', label: '결과 현황', to: `${base}/results` },
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
          {viewer
            ? <Chip tone="violet" icon="eye">열람 전용</Chip>
            : <Chip tone="violet" icon={m?.isAdmin ? 'shield' : 'user'}>{m?.isAdmin ? '룸 관리자' : '참여자'}</Chip>}
        </div>
        {open && !viewer && (myPres || !m?.isAdmin || project.settings.allowAdminPresent) && <div className="lnb-write">{myPres
          ? <Link to={`${base}/pres/${myPres.id}`} className={`btn outline block ${current === 'write' ? 'on' : ''}`}><Icon name="pencil" size={16} />내 발표 편집</Link>
          : <Link to={`${base}/pres/new`} className={`btn outline block ${current === 'write' ? 'on' : ''}`}><Icon name="plus" size={16} />발표 등록</Link>}</div>}
        {groups.map(g => {
          // 하위 항목이 하나뿐이면 묶음 대신 바로 이동하는 메뉴로 보여준다 (예: 발표, 내 발표)
          if (g.items.length === 1) {
            const i = g.items[0];
            return (
              <div key={g.key} className="lnb-group">
                <Link to={i.to} className={`lnb-direct ${current === i.key ? 'on' : ''}`}>
                  <span>{g.label}</span>
                  {i.count !== undefined && <em className={i.red && i.count > 0 ? 'red' : ''}>{i.count}</em>}
                </Link>
              </div>
            );
          }
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
      </aside>
      <button className="lnb-collapse" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '왼쪽 메뉴 펼치기' : '왼쪽 메뉴 접기'} aria-expanded={!collapsed}><Icon name={collapsed ? 'right' : 'collapse'} size={14} /></button>
      <div className="board-main">
        {/* 모바일: 왼쪽 목차를 여는 줄. 화면을 내리면 상단 메뉴는 올라가고 이 줄이 맨 위에 붙는다 */}
        <button className="lnb-toggle" onClick={() => setDrawer(d => !d)} aria-expanded={drawer}>
          <Icon name={drawer ? 'collapse' : 'menu'} size={18} />
          <span className="lnb-toggle-label ellipsis"><b>{project.name}</b><span className="lnb-toggle-sep">›</span>{currentLabel}</span>
          <span className="lnb-toggle-hint">{drawer ? '닫기' : '목차'}</span>
        </button>
        {children}
      </div>
    </div>
  );
}
