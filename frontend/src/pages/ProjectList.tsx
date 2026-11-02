import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProject, joinByCode } from '../store';
import { Chip, Field, IconText, run, useMe } from '../ui';
import { Icon } from '../icons';
import { dateText, members, myStatus, presentationsOf, teamName, userName } from '../logic';
import { BoardHead, Pager } from './ProjectShell';

const PAGE_SIZE = 10;

/** 평가룸 생성일 정렬: 최신순(내림차순) ↔ 오래된순(오름차순) */
type RoomOrder = 'desc' | 'asc';
const byCreated = (order: RoomOrder) => (a: number, b: number) => (order === 'desc' ? b - a : a - b);
/** 번호는 생성된 순서로 고정한다 (가장 먼저 만든 평가룸 = 1). 정렬을 바꿔도 같은 평가룸은 같은 번호 */
const createdNo = (list: { id: string; createdAt: number }[]) =>
  new Map([...list].sort((a, b) => a.createdAt - b.createdAt).map((x, i) => [x.id, i + 1]));
function RoomOrderButton({ order, onChange }: { order: RoomOrder; onChange: (o: RoomOrder) => void }) {
  return (
    <button type="button" className="btn sm room-order" onClick={() => onChange(order === 'desc' ? 'asc' : 'desc')}
      title="생성일 기준 정렬 바꾸기" aria-label={`생성일 ${order === 'desc' ? '최신순' : '오래된순'}, 눌러서 바꾸기`}>
      <Icon name={order === 'desc' ? 'down' : 'up'} size={14} />{order === 'desc' ? '최신순' : '오래된순'}
    </button>
  );
}

export default function ProjectList() {
  const { db, me } = useMe();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<RoomOrder>('desc');
  if (!me) return null;

  const mine = db.memberships.filter(m => m.userId === me.id)
    .map(m => ({ m, p: db.projects.find(p => p.id === m.projectId)! }))
    .sort((a, b) => byCreated(order)(a.p.createdAt, b.p.createdAt));
  const rows = mine.map(({ m, p }) => {
    const list = presentationsOf(db, p.id);
    const st = list.map(x => myStatus(db, p, x, me.id));
    return { m, p, list, todo: st.filter(s => s === 'TODO').length, done: st.filter(s => s === 'DONE').length };
  });
  const totalTodo = rows.filter(r => r.p.status === 'OPEN').reduce((a, r) => a + r.todo, 0);
  const openCount = rows.filter(r => r.p.status === 'OPEN').length;
  // 평가할 발표가 가장 많이 남은 진행 중인 평가룸
  const next = rows.filter(r => r.p.status === 'OPEN' && r.todo > 0).sort((a, b) => b.todo - a.todo)[0];
  const filtered = rows.filter(r => !q.trim() || r.p.name.includes(q.trim()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const myNo = createdNo(rows.map(r => r.p));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const join = () => {
    let pid = '';
    run(async () => { pid = await joinByCode(me.id, code); }, '평가룸에 입장했습니다.').then(ok => ok && nav(`/p/${pid}`));
  };
  const create = () => {
    let pid = '';
    run(async () => { pid = await createProject(me.id, name, desc); }, '평가룸을 만들었습니다. 룸 운영자로 지정되었어요.').then(ok => ok && nav(`/p/${pid}/admin`));
  };

  return (
    <div className="portal-home stack lg">
      <div className="portal-dashboard">
        <section className="widget portal-profile">
          <h2 className="widget-title">내 정보</h2>
          <div className="portal-person"><span className="profile-avatar">{me.name.slice(0, 1)}</span><div><strong>{me.name}</strong><small>{teamName(db, me.teamId)}</small></div></div>
          <dl className="profile-facts"><div><dt>이메일</dt><dd>{me.loginId}</dd></div><div><dt>참여 평가룸</dt><dd>{rows.length}개</dd></div></dl>
        </section>
        <div className="widget portal-stat stat-rating">
          <div className="widget-title">남은 평가 <span className="red">{totalTodo}</span>건</div>
          <p>점수를 기다리는 발표를 확인하세요.</p>
          <span className="stat-art" aria-hidden="true"><Icon name="star" size={52} /><span className="stat-art-badge"><Icon name="pencil" size={18} /></span></span>
        </div>
        <div className="widget portal-stat stat-room">
          <div className="widget-title">진행 중인 평가룸 <span className="red">{openCount}</span>개</div>
          <p>함께 참여하는 발표와 평가</p>
          <span className="stat-art" aria-hidden="true"><Icon name="folder" size={54} /><span className="stat-art-badge"><Icon name="play" size={18} /></span></span>
        </div>
        <div className="widget portal-live">
          <div className="widget-title">바로 평가하기</div>
          {next
            ? <div className="portal-live-content"><Link to={`/p/${next.p.id}`} className="live-line"><b>{next.p.name}</b><Icon name="right" size={15} /></Link><p className="muted small">평가할 발표 {next.todo}개</p><Link to={`/p/${next.p.id}`} className="btn primary">평가하러 가기</Link></div>
            : <div className="portal-empty"><Icon name="checkCircle" size={22} /><p>지금 평가할 발표가 없습니다.</p></div>}
        </div>
        <div className="widget join">
          <div className="widget-title">평가룸 입장</div>
          <div className="row gap">
            <input className="code-input" placeholder="ABC123" value={code} maxLength={6} aria-label="입장 코드"
              onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && code.length === 6 && join()} />
            <button className="btn primary solid" onClick={join} disabled={code.length < 6}>입장</button>
          </div>
        </div>
      </div>

      <section className="board-panel room-list-panel">
        <BoardHead title="내 평가룸" count={filtered.length} countLabel="전체 평가룸"
          right={<>
            <RoomOrderButton order={order} onChange={o => { setOrder(o); setPage(1); }} />
            <label className="board-search"><input placeholder="평가룸 이름 검색" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} aria-label="평가룸 검색" /><Icon name="search" size={16} /></label>
            <button className="btn primary solid" onClick={() => setCreating(c => !c)}>{creating ? '닫기' : <IconText icon="plus">평가룸 만들기</IconText>}</button>
          </>} />
        {creating && (
          <div className="create-box stack">
            <div className="row gap wrap">
              <Field label="평가룸 이름"><input value={name} onChange={e => setName(e.target.value)} placeholder="예: AI 공모전" /></Field>
              <Field label="설명 (선택)"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="어떤 발표를 평가하나요?" /></Field>
            </div>
            <div className="row between gap wrap">
              <span />
              <button className="btn primary solid" onClick={create}>평가룸 만들기</button>
            </div>
          </div>
        )}
        <div className="btable projects">
          <div className="bhead">
            <span className="c-no">No</span><span className="c-title">평가룸 이름</span><span className="c-role">내 역할</span>
            <span className="c-num">참여자</span><span className="c-num">발표</span><span className="c-todo">내 평가</span><span className="c-date">생성일</span><span className="c-state">상태</span>
          </div>
          {shown.length === 0 && <div className="bempty">{q ? '검색 결과가 없습니다.' : '참여 중인 평가룸이 없습니다. 입장 코드를 입력하거나 새로 만들어 보세요.'}</div>}
          {shown.map((r, i) => (
            <Link key={r.p.id} to={`/p/${r.p.id}`} className={`prow ${r.todo > 0 && r.p.status === 'OPEN' ? 'unread' : ''}`}>
              <span className="c-no">{myNo.get(r.p.id)}</span>
              <span className="c-title">
                <span className="t">{r.p.name}</span>
                <span className="t-sub">{r.p.description || ' '}</span>
              </span>
              <span className="c-role">{r.m.isAdmin ? <Chip tone="violet" icon="shield">룸 운영자</Chip> : <Chip icon="user">참여자</Chip>}</span>
              <span className="c-num">{members(db, r.p.id).length}명</span>
              <span className="c-num">{r.list.length}개</span>
              <span className="c-todo">
                {r.p.status === 'CLOSED' ? <span className="muted">-</span>
                  : r.todo > 0 ? <span className="red-text"><b>{r.todo}</b>건 남음</span>
                  : r.done > 0 ? <span className="green-text">완료</span> : <span className="muted">-</span>}
              </span>
              <span className="c-date">{dateText(r.p.createdAt)}</span>
              <span className="c-state">{r.p.status === 'OPEN' ? <Chip tone="green">진행 중</Chip> : <Chip>마감</Chip>}</span>
            </Link>
          ))}
        </div>
        <Pager page={page} total={pages} onChange={setPage} />
      </section>

      {me.canViewAll && <AllRooms />}
    </div>
  );
}

/** 전체 열람 권한자용: 모든 평가룸(내가 참여한 곳 포함, 진행 중·마감). 참여하지 않은 곳은 볼 수만 있다 */
function AllRooms() {
  const { db, me } = useMe();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<RoomOrder>('desc');
  const myRole = (pid: string) => db.memberships.find(m => m.projectId === pid && m.userId === me!.id);
  const rooms = [...db.projects]
    .sort((a, b) => byCreated(order)(a.createdAt, b.createdAt))
    .filter(p => !q.trim() || p.name.includes(q.trim()));
  const pages = Math.max(1, Math.ceil(rooms.length / PAGE_SIZE));
  const allNo = createdNo(db.projects);
  const shown = rooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <section className="board-panel room-list-panel">
      <BoardHead title="전체 평가룸" count={rooms.length} countLabel="전체"
        right={<>
          <RoomOrderButton order={order} onChange={o => { setOrder(o); setPage(1); }} />
          <label className="board-search"><input placeholder="평가룸 이름 검색" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} aria-label="전체 평가룸 검색" /><Icon name="search" size={16} /></label>
        </>} />
      <div className="btable projects">
        <div className="bhead">
          <span className="c-no">No</span><span className="c-title">평가룸 이름</span><span className="c-role">내 권한</span>
          <span className="c-num">참여자</span><span className="c-num">발표</span><span className="c-todo">운영자</span><span className="c-date">생성일</span><span className="c-state">상태</span>
        </div>
        {shown.length === 0 && <div className="bempty">{q ? '검색 결과가 없습니다.' : '평가룸이 없습니다.'}</div>}
        {shown.map((p, i) => {
          const admins = members(db, p.id).filter(m => m.isAdmin).map(m => userName(db, m.userId));
          return (
            <Link key={p.id} to={`/p/${p.id}`} className="prow">
              <span className="c-no">{allNo.get(p.id)}</span>
              <span className="c-title"><span className="t">{p.name}</span><span className="t-sub">{p.description || ' '}</span></span>
              <span className="c-role">{(() => {
                const r = myRole(p.id);
                return r ? (r.isAdmin ? <Chip tone="violet" icon="shield">룸 운영자</Chip> : <Chip icon="user">참여자</Chip>) : <Chip icon="eye">열람</Chip>;
              })()}</span>
              <span className="c-num">{members(db, p.id).length}명</span>
              <span className="c-num">{presentationsOf(db, p.id).length}개</span>
              <span className="c-todo ellipsis" title={admins.join(', ')}>{admins[0] ?? '-'}{admins.length > 1 && ` 외 ${admins.length - 1}명`}</span>
              <span className="c-date">{dateText(p.createdAt)}</span>
              <span className="c-state">{p.status === 'OPEN' ? <Chip tone="green">진행 중</Chip> : <Chip>마감</Chip>}</span>
            </Link>
          );
        })}
      </div>
      <Pager page={page} total={pages} onChange={setPage} />
    </section>
  );
}
