// 발표 화면: 평가룸 참여자 전원을 팀 구조도 순으로 보여준다.
// 한 줄 = 한 사람. 옆에 발표 등록 상태가 보이고, 누르면 펼쳐져 그 사람의 발표 정보와 점수 입력이 보인다.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { BoardHead, Chip, ConfirmButton, IconText, run } from '../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../organization';
import { members, membership, ProjectShell, RoomNotFound, roomAccess, sortByTeamStructure, type Membership, type Project } from '../../projects';
import { myProgress, ratesInRoom, personStatus, RatingWidget, type MyStatus } from '../../ratings';
import type { Summary } from '../../results';
import { mutate, useSession } from '../../session';
import { deletePresentation } from '../api/presentations.api';
import { PresInfo } from '../components/PresInfo';
import { hasNames, RatingStatusPopup, type StatKind } from '../components/RatingStatusPopup';
import { RosterSummary } from '../components/RosterSummary';
import { canEditPresentation, involvedIds, presentationOfUser, presenterRoster, presTypeText } from '../model/crew';
import type { Presentation } from '../model/types';

/** 회색 정보 행: 왼쪽 라벨, 오른쪽 값 */
function Rule({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: 'ok' | 'no' }) {
  return (
    <div className="rule">
      <span className="rule-label"><Icon name={icon} size={15} />{label}</span>
      <b className={`rule-value ${tone ?? ''}`}>{value}</b>
    </div>
  );
}

const FILTERS: Record<string, { title: string }> = {
  all: { title: '발표' },
  mine: { title: '내 발표' },
};
type RegFilter = 'all' | 'done' | 'todo';
const REG_FILTERS: { key: RegFilter; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'done', label: '발표 등록 완료' }, { key: 'todo', label: '발표 등록 전' },
];
/** 무한 스크롤: 처음에 보여 줄 인원, 아래 끝에 닿을 때마다 더 보여 줄 인원 */
const PAGE_SIZE = 20;

/** 목록 끝 표시. 화면에 보이면 다음 묶음을 불러온다 (key를 바꿔 다시 붙이면 아직 보이는 경우에도 한 번 더 확인한다) */
function LoadMore({ onMore, rest }: { onMore: () => void; rest: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) onMore(); }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onMore]);
  return <div ref={ref} className="load-more muted small">아래로 내리면 {rest}명을 더 보여 드려요…</div>;
}

/** 한 사람에 대한 내 평가 (표에서는 짧게) */
const RATE_SHORT: Record<MyStatus, { text: string; cls: string }> = {
  TODO: { text: '평가 필요', cls: 'red' },
  DONE: { text: '완료', cls: 'ok' },
  BLOCKED: { text: '불가', cls: 'muted' },
  MISSED: { text: '안 함', cls: 'muted' },
};

/**
 * 발표 삭제. 발표 구성원(팀 발표면 팀원 모두), 만든 사람, 룸 관리자가 지울 수 있다.
 * 점수를 받은 발표는 다른 사람의 평가가 함께 지워지므로 룸 관리자만 지운다 (서버도 같은 규칙).
 */
export function DeletePresentation({ project, pres, isAdmin, size = 'sm' }: { project: Project; pres: Presentation; isAdmin: boolean; size?: 'sm' | 'md' }) {
  if (pres.hasRatings && !isAdmin) return <small className="muted">점수를 받은 발표는 룸 관리자만 삭제할 수 있어요.</small>;
  return (
    <ConfirmButton label="삭제" className={`btn ${size === 'sm' ? 'sm ' : ''}danger`} confirmLabel="발표 삭제"
      detail={<>'{pres.title}' 발표와 올린 자료가 모두 삭제돼요.{pres.type === 'TEAM' && ' 팀원 모두 발표 등록 전으로 돌아가요.'}{pres.hasRatings && ' 받은 평가도 함께 지워져요.'}</>}
      onConfirm={() => { run(() => mutate(deletePresentation(project.id, pres.id)), '발표를 삭제했습니다.'); }} />
  );
}

/**
 * 이 사람에 대한 평가 현황: 전체 참여자 / 평가함 / 평가 불가 / 미평가 인원.
 * 서버 집계(summaries)를 쓴다. 발표 등록 전이면 아직 평가 대상이 아니라 '-'로 둔다.
 */
function PersonStats({ summary, onOpen }: { summary: Summary | undefined; onOpen: (k: StatKind) => void }) {
  const n = (v: number | undefined) => (v === undefined ? '-' : v);
  // 사람 목록을 받은 경우(룸 관리자, 또는 설정이 켜진 참여자)에만 숫자를 눌러 목록을 연다.
  // 줄 전체가 버튼이라 안에 버튼을 둘 수 없어 role="button"으로 두고, 줄이 펼쳐지지 않게 막는다
  const open = hasNames(summary);
  const cell = (k: StatKind, cls: string, title: string, label: string, v: number | undefined) => (
    <span className={`st ${cls} ${open ? 'clickable' : ''}`} title={open ? `${title} 목록 보기` : title}
      {...(open ? {
        role: 'button', tabIndex: 0,
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); onOpen(k); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen(k); } },
      } : {})}>
      <b>{n(v)}</b><i>{label}</i>
    </span>
  );
  return (
    <span className={`c-stats ${summary ? '' : 'no-stats'}`}>
      {cell('all', '', '전체 참여자', '전체', summary?.total)}
      {cell('scored', 'ok', '평가함', '평가', summary?.scored)}
      {cell('blocked', 'off', '평가 불가', '불가', summary?.blocked)}
      {cell('notRated', 'red', '미평가', '미평가', summary?.notRated)}
    </span>
  );
}

/** 참여자 한 줄. 누르면 아래로 펼쳐져 발표 내용과 그 사람의 점수 입력이 보인다 */
function PersonRow({ project, member, no, pres, open, onToggle, viewer, showStats }: {
  project: Project; member: Membership; no: number; pres: Presentation | undefined; open: boolean; onToggle: () => void; viewer: boolean;
  showStats: boolean;
}) {
  const { db, me } = useSession();
  const m = membership(db, project.id, me!.id);
  const uid = member.userId;
  const user = userOf(db, uid);
  const isMe = uid === me!.id;
  const s = pres && !viewer ? personStatus(db, project, pres, me!.id, uid) : null;
  const canEdit = !!pres && !viewer && project.status === 'OPEN' && canEditPresentation(pres, me!.id, !!m?.isAdmin);
  const reg = pres ? <Chip tone="green" icon="checkCircle">발표 등록 완료</Chip> : <Chip icon="clock">발표 등록 전</Chip>;
  const summary = pres ? db.summaries.find(x => x.presentationId === pres.id && x.targetId === uid) : undefined;
  const [statKind, setStatKind] = useState<StatKind | null>(null);
  return (
    <div className={`brow-wrap ${open ? 'open' : ''}`}>
      {statKind && pres && summary && (
        <RatingStatusPopup project={project} pres={pres} targetId={uid} summary={summary} initial={statKind} onClose={() => setStatKind(null)} />
      )}
      <button className={`brow ${s === 'TODO' ? 'unread' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="c-no">{no}</span>
        <span className="c-title">
          <span className="t">
            {userName(db, uid)}
            {user?.position && <small className="muted"> {user.position}</small>}
            {isMe && <small className="muted"> (나)</small>}
          </span>
          <span className="t-sub">{pres ? `${presTypeText[pres.type]} · ${pres.title}` : '발표 등록 전'}</span>
        </span>
        <span className="c-type">{pres ? presTypeText[pres.type] : <span className="muted">-</span>}</span>
        <span className="c-who ellipsis" title={pres?.title}>
          {pres ? <>{pres.title}{pres.attachments.length > 0 && <Icon name="paperclip" size={13} className="title-clip" />}</> : <span className="muted">-</span>}
        </span>
        {showStats && <PersonStats summary={summary} onOpen={setStatKind} />}
        <span className="c-status">{reg}</span>
        <span className="c-score">{s ? <b className={RATE_SHORT[s].cls}>{RATE_SHORT[s].text}</b> : <span className="muted">-</span>}</span>
        <span className="c-chev"><Icon name={open ? 'up' : 'down'} size={16} /></span>
      </button>
      {open && (
        <div className="brow-detail">
          {pres ? <>
            <section className="detail-block">
              <div className="detail-block-head">
                <span><Icon name="mic" size={15} /> 발표 정보</span>
                {canEdit && <span className="row gap-sm">
                  <Link className="btn sm" to={`/p/${project.id}/pres/${pres.id}`}><IconText icon="pencil">편집</IconText></Link>
                  <DeletePresentation project={project} pres={pres} isAdmin={!!m?.isAdmin} />
                </span>}
              </div>
              <PresInfo project={project} pres={pres} showMyRole />
            </section>
            {viewer
              ? <div className="notice info small"><Icon name="eye" size={15} />열람 전용이에요. 평가는 평가룸 참여자만 할 수 있어요.</div>
              : <RatingWidget project={project} pres={pres} only={uid} />}
          </> : (
            <div className="notice info small">
              <Icon name="info" size={15} />
              <span>
                {isMe ? '아직 발표를 등록하지 않았어요.' : `${userName(db, uid)}님은 아직 발표를 등록하지 않았어요. 발표를 등록하면 평가할 수 있어요.`}
                {isMe && !viewer && project.status === 'OPEN' && <> <Link to={`/p/${project.id}/pres/new`}>발표 등록하기</Link></>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PresentationListPage() {
  const { pid } = useParams();
  const { db, me } = useSession();
  const [sp, setSp] = useSearchParams();
  const project = db.projects.find(p => p.id === pid);
  const access = project && me ? roomAccess(db, project.id, me) : null;
  const viewer = access === 'viewer';
  // 열람 전용은 '내 발표'가 없으므로 전체 참여자만 본다
  const f = !viewer && FILTERS[sp.get('f') ?? ''] ? sp.get('f')! : 'all';
  // 발표 등록 상태 필터는 주소에 남겨서 새로 고침해도 유지한다
  const regParam = sp.get('reg');
  const reg: RegFilter = regParam === 'done' || regParam === 'todo' ? regParam : 'all';
  const setReg = (v: RegFilter) => {
    const next = new URLSearchParams(sp);
    if (v === 'all') next.delete('reg'); else next.set('reg', v);
    setSp(next, { replace: true });
  };
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const m = project && me ? membership(db, project.id, me.id) : undefined;
  useEffect(() => { setLimit(PAGE_SIZE); setOpenId(null); }, [f, reg]);
  if (!project || !me || !access) return <RoomNotFound />;

  const presOf = (uid: ID) => presentationOfUser(db, project.id, uid);
  const myPres = presOf(me.id);
  const all = db.presentations.filter(p => p.projectId === project.id);
  // 남은 평가는 사람 단위로 센다 (발표 구성원 한 명씩 평가)
  const progress = all.map(p => myProgress(db, project, p, me.id));
  const total = progress.reduce((a, x) => a + x.ratable, 0);
  const doneCount = progress.reduce((a, x) => a + x.rated, 0);
  const remaining = total - doneCount;
  const s = project.settings;
  const closed = project.status === 'CLOSED';
  // 사람별 평가 현황: 룸 관리자(와 전체 열람)는 항상, 참여자는 룸 관리자가 설정에서 켰을 때만
  const showStats = !!m?.isAdmin || viewer || s.showRatingStatus;

  // 팀 구조도 순: 참여 당시 팀(상위 팀 → 하위 팀), 같은 팀은 조직도 순서(위 = 높은 사람), 소속 없음은 맨 뒤
  // 룸 관리자는 발표하지 않으므로 목록·등록 인원에서 뺀다
  const everyone = sortByTeamStructure(db, presenterRoster(db, project.id, members(db, project.id)));
  const rates = ratesInRoom(project, m);
  const registered = everyone.filter(x => presOf(x.userId)).length;

  const kw = q.trim();
  const list = everyone
    .filter(x => f === 'mine' ? (myPres ? involvedIds(myPres).includes(x.userId) : x.userId === me.id) : true)
    .filter(x => reg === 'all' || (reg === 'done') === !!presOf(x.userId))
    .filter(x => !kw || userName(db, x.userId).includes(kw) || (presOf(x.userId)?.title.includes(kw) ?? false));
  const shown = list.slice(0, limit);
  const teamCounts = new Map<ID | null, { total: number; done: number }>();
  list.forEach(x => {
    const c = teamCounts.get(x.teamIdAtJoin) ?? { total: 0, done: 0 };
    teamCounts.set(x.teamIdAtJoin, { total: c.total + 1, done: c.done + (presOf(x.userId) ? 1 : 0) });
  });
  // 이 페이지에 보이는 사람들을 팀별로 묶는다 (앞 페이지에서 이어지는 팀이면 표시)
  const shownGroups: { rows: { m: Membership; i: number }[] }[] = [];
  shown.forEach((m, i) => {
    const last = shownGroups[shownGroups.length - 1];
    if (last && last.rows[last.rows.length - 1].m.teamIdAtJoin === m.teamIdAtJoin) last.rows.push({ m, i });
    else shownGroups.push({ rows: [{ m, i }] });
  });
  const meta = FILTERS[f];

  return (
    <ProjectShell project={project} current={f}>
      <BoardHead title={meta.title} search={q} onSearch={v => { setQ(v); setLimit(PAGE_SIZE); }} />

      {closed && <div className="notice"><Icon name="flag" size={16} />마감된 평가룸이에요.</div>}
      {viewer && <div className="notice info"><Icon name="eye" size={16} />전체 열람 권한으로 보고 있어요. 평가·발표 등록은 할 수 없어요.</div>}

      {!viewer && f === 'all' && (
        <div className="widgets">
          <div className="widget">
            {rates ? <>
              <div className="widget-title">남은 평가 <span className="red">{remaining}</span>명</div>
              <p className="muted">평가할 구성원 {total}명 중 {doneCount}명 완료 · 발표 등록 {registered}/{everyone.length}명</p>
              <div className="bar"><span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>
            </> : <>
              <div className="widget-title">평가하지 않는 룸 관리자</div>
              <p className="muted">이 평가룸은 룸 관리자가 평가하지 않아요. 설정에서 바꿀 수 있어요. · 발표 등록 {registered}/{everyone.length}명</p>
            </>}
          </div>
          <div className="widget rules">
            <Rule icon="star" label="점수 범위" value={`${s.min} ~ ${s.max}점`} />
            {/* 설정 화면의 평가 규칙과 같은 순서 */}
            <Rule icon="user" label="본인 평가" value={s.allowSelf ? '가능' : '불가'} tone={s.allowSelf ? 'ok' : 'no'} />
            <Rule icon="users" label="같은 회사 팀 평가" value={s.allowSameTeam ? '가능' : '불가'} tone={s.allowSameTeam ? 'ok' : 'no'} />
            <Rule icon="mic" label="같은 발표 팀원 평가" value={s.allowSameCrew ? '가능' : '불가'} tone={s.allowSameCrew ? 'ok' : 'no'} />
            <Rule icon="pencil" label="제출 후 수정" value={s.allowEdit ? '가능' : '불가'} tone={s.allowEdit ? 'ok' : 'no'} />
            <Rule icon="shield" label="관리자 평가" value={s.allowAdminRating ? '함' : '안 함'} tone={s.allowAdminRating ? 'ok' : 'no'} />
            <Rule icon="building" label="내 팀" value={m?.teamNameAtJoin ?? teamName(db, m?.teamIdAtJoin ?? null)} />
          </div>
        </div>
      )}

      {/* 참여자 · 발표 등록 · 발표 미등록 인원 (누르면 목록 팝업). 룸 관리자(와 전체 열람)는 항상, 참여자는 설정이 켜져 있을 때.
          미등록자에게 발표 등록 요청은 룸 관리자만 */}
      {(m?.isAdmin || viewer || s.showRosterSummary) && f === 'all' && <RosterSummary project={project} />}

      <div className="board-tools">
        <span className="muted small">발표 등록</span>
        <div className="segmented">
          {REG_FILTERS.map(r => (
            <button key={r.key} className={reg === r.key ? 'on' : ''} onClick={() => setReg(r.key)}>{r.label}</button>
          ))}
        </div>
        <span className="grow" />
        {!viewer && !closed && (myPres
          ? f === 'mine' && <span className="row gap-sm">
              <Link to={`/p/${project.id}/pres/${myPres.id}`} className="btn"><IconText icon="pencil">내 발표 편집</IconText></Link>
              <DeletePresentation project={project} pres={myPres} isAdmin={!!m?.isAdmin} size="md" />
            </span>
          : !m?.isAdmin && <Link to={`/p/${project.id}/pres/new`} className="btn primary solid"><IconText icon="plus">발표 등록</IconText></Link>)}
      </div>
      <p className="muted small team-sort-hint">팀 구조도 순 · 팀 발표는 한 명이 등록하면 구성원 모두 발표 등록 완료로 바뀌어요.</p>

      <div className={`btable team-sorted ${showStats ? 'with-stats' : ''}`}>
        <div className="bhead">
          <span className="c-no">No</span><span className="c-title">이름</span><span className="c-type">유형</span>
          <span className="c-who">발표 제목</span>
          {showStats && <span className="c-stats" title="이 사람을 평가한 현황"><span className="st">전체</span><span className="st">평가</span><span className="st">불가</span><span className="st">미평가</span></span>}<span className="c-status">발표 등록</span><span className="c-score">내 평가</span><span className="c-chev" />
        </div>
        {shown.length === 0 && <div className="bempty">{kw ? '검색 결과가 없습니다.' : '해당하는 참여자가 없습니다.'}</div>}
        {/* 팀마다 상자로 묶는다. 결과 현황의 팀별 순서와 같은 모양 (팀 이름 줄 + 진한 테두리) */}
        {shownGroups.map(g => {
          const first = g.rows[0];
          const c = teamCounts.get(first.m.teamIdAtJoin)!;
          return (
            <div key={`${first.m.teamIdAtJoin ?? 'none'}-${first.i}`} className="team-box">
              <div className="team-head" role="heading" aria-level={3}>
                <Icon name="building" size={14} />
                <b>{first.m.teamNameAtJoin ?? teamName(db, first.m.teamIdAtJoin)}</b>
                <span className="team-path">{teamPath(db.teams, first.m.teamIdAtJoin)}</span>
                <span className="team-count">{c.total}명 · 등록 {c.done}명</span>
              </div>
              {g.rows.map(({ m: x, i }) => (
                <PersonRow key={x.userId} project={project} member={x} no={i + 1} pres={presOf(x.userId)} viewer={viewer} showStats={showStats}
                  open={openId === x.userId} onToggle={() => setOpenId(openId === x.userId ? null : x.userId)} />
              ))}
            </div>
          );
        })}
      </div>
      {limit < list.length && <LoadMore key={limit} rest={list.length - limit} onMore={() => setLimit(l => l + PAGE_SIZE)} />}
      {limit >= list.length && list.length > PAGE_SIZE && <div className="load-more muted small">모두 {list.length}명을 보여 드렸어요.</div>}
    </ProjectShell>
  );
}
