// 발표 화면: 평가룸 참여자 전원을 팀 구조도 순으로 보여준다.
// 한 줄 = 한 사람. 옆에 발표 등록 상태가 보이고, 누르면 펼쳐져 그 사람의 발표 정보와 점수 입력이 보인다.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { BoardHead, Chip, ConfirmButton, IconText, run } from '../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../organization';
import { groupByTeam, members, membership, ProjectShell, RoomNotFound, roomAccess, sortByTeamStructure, type Membership, type Project } from '../../projects';
import { blockReason, myRating, myStatus, ratesInRoom, RatingWidget, type MyStatus } from '../../ratings';
import type { Summary } from '../../results';
import { mutate, useSession } from '../../session';
import { deletePresentation } from '../api/presentations.api';
import { PresInfo } from '../components/PresInfo';
import { hasNames, RatingStatusPopup, type StatKind } from '../components/RatingStatusPopup';
import { RosterSummary } from '../components/RosterSummary';
import { canEditPresentation, crewOf, crewSummary, involvedIds, presentationOfUser, presentationsOf, presenterRoster, presTypeText, roleText } from '../model/crew';
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
/** 발표별 보기 정렬: 팀별(기본) / 룸 관리자가 정한 발표 순서 */
type PresSort = 'team' | 'order';
const PRES_SORTS: { key: PresSort; label: string }[] = [
  { key: 'team', label: '팀별' }, { key: 'order', label: '발표 순서' },
];
const PRES_SORT_HINT: Record<PresSort, string> = {
  team: '팀 구조도 순 (팀 발표는 대표의 팀 기준)',
  order: '룸 관리자가 정한 발표 순서',
};
/** 무한 스크롤: 처음에 보여 줄 인원, 아래 끝에 닿을 때마다 더 보여 줄 인원 */
const PAGE_SIZE = 20;

/** 목록 끝 표시. 화면에 보이면 다음 묶음을 불러온다 (key를 바꿔 다시 붙이면 아직 보이는 경우에도 한 번 더 확인한다) */
function LoadMore({ onMore, rest, unit }: { onMore: () => void; rest: number; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) onMore(); }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onMore]);
  return <div ref={ref} className="load-more muted small">아래로 내리면 {rest}{unit} 더 보여 드려요…</div>;
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
      onConfirm={() => { run(() => mutate(deletePresentation(project.id, pres.id)), '발표를 삭제했어요.'); }} />
  );
}

/**
 * 이 사람이 속한 발표의 평가 현황: 전체 참여자 / 평가함 / 평가 불가 / 미평가 인원 (팀 발표는 팀원 모두 같은 값).
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

/** 줄을 펼치면 보이는 발표 정보(편집·삭제)와 발표 점수 입력. 사람별·발표별 보기가 함께 쓴다 */
function PresDetail({ project, pres, viewer }: { project: Project; pres: Presentation; viewer: boolean }) {
  const { db, me } = useSession();
  const m = membership(db, project.id, me!.id);
  const canEdit = !viewer && project.status === 'OPEN' && canEditPresentation(pres, me!.id, !!m?.isAdmin);
  return <>
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
      : <RatingWidget project={project} pres={pres} />}
  </>;
}

/**
 * 발표별 보기의 한 줄 = 발표 하나 (팀 발표도 한 줄).
 * 발표 제목 · 유형 · 구성원 · 대표 소속 팀 · 평가 현황 · 내 평가. 누르면 발표 정보와 점수 입력이 펼쳐진다
 */
function PresRow({ project, pres, no, open, onToggle, viewer, showStats }: {
  project: Project; pres: Presentation; no: number; open: boolean; onToggle: () => void; viewer: boolean; showStats: boolean;
}) {
  const { db, me } = useSession();
  const s = viewer ? null : myStatus(db, project, pres, me!.id);
  const summary = db.summaries.find(x => x.presentationId === pres.id);
  const [statKind, setStatKind] = useState<StatKind | null>(null);
  const crew = crewOf(pres);
  const leaderTeam = membership(db, project.id, pres.leaderId);
  const mine = involvedIds(pres).includes(me!.id);
  return (
    <div id={`pres-${pres.id}`} className={`brow-wrap ${open ? 'open' : ''}`}>
      {statKind && summary && (
        <RatingStatusPopup project={project} pres={pres} summary={summary} initial={statKind} onClose={() => setStatKind(null)} />
      )}
      <button className={`brow pres-row ${s === 'TODO' ? 'unread' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="c-no">{no}</span>
        <span className="c-title">
          <span className="t" title={pres.title}>
            {pres.title}
            {pres.attachments.length > 0 && <Icon name="paperclip" size={13} className="title-clip" />}
            {mine && <small className="muted"> (내 발표)</small>}
          </span>
          <span className="t-sub">{presTypeText[pres.type]} · {crewSummary(db, pres)}</span>
        </span>
        <span className="c-type">{presTypeText[pres.type]}</span>
        <span className="c-crew" title={crew.map(c => `${roleText[c.role]} ${userName(db, c.id)}`).join(', ')}>
          <b>{userName(db, pres.leaderId)}</b>
          {crew.length > 1 && <small className="muted"> 외 {crew.length - 1}명 · {crew.slice(1).map(c => userName(db, c.id)).join(', ')}</small>}
        </span>
        <span className="c-team ellipsis muted">{leaderTeam?.teamNameAtJoin ?? teamName(db, leaderTeam?.teamIdAtJoin ?? null)}</span>
        {showStats && <PersonStats summary={summary} onOpen={setStatKind} />}
        <span className="c-score">{s ? <b className={RATE_SHORT[s].cls}>{RATE_SHORT[s].text}</b> : <span className="muted">-</span>}</span>
        <span className="c-chev"><Icon name={open ? 'up' : 'down'} size={16} /></span>
      </button>
      {open && <div className="brow-detail"><PresDetail project={project} pres={pres} viewer={viewer} /></div>}
    </div>
  );
}

/** 참여자 한 줄. 누르면 아래로 펼쳐져 발표 내용과 그 사람의 점수 입력이 보인다 */
function PersonRow({ project, member, no, pres, open, onToggle, viewer, showStats }: {
  project: Project; member: Membership; no: number; pres: Presentation | undefined; open: boolean; onToggle: () => void; viewer: boolean;
  showStats: boolean;
}) {
  const { db, me } = useSession();
  const uid = member.userId;
  const user = userOf(db, uid);
  const isMe = uid === me!.id;
  const s = pres && !viewer ? myStatus(db, project, pres, me!.id) : null;
  const reg = pres ? <Chip tone="green" icon="checkCircle">발표 등록 완료</Chip> : <Chip icon="clock">발표 등록 전</Chip>;
  const summary = pres ? db.summaries.find(x => x.presentationId === pres.id) : undefined;
  const [statKind, setStatKind] = useState<StatKind | null>(null);
  return (
    <div className={`brow-wrap ${open ? 'open' : ''}`}>
      {statKind && pres && summary && (
        <RatingStatusPopup project={project} pres={pres} summary={summary} initial={statKind} onClose={() => setStatKind(null)} />
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
          {pres ? <PresDetail project={project} pres={pres} viewer={viewer} /> : (
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
  // 보기: 발표별(발표 하나씩, 팀 발표도 한 줄, 기본) / 사람별(참여자 한 명씩). 사람별은 주소(?view=person)에 남는다
  const byPres = sp.get('view') !== 'person';
  const setView = (pres: boolean) => {
    const next = new URLSearchParams(sp);
    if (pres) next.delete('view'); else next.set('view', 'person');
    setSp(next, { replace: true });
  };
  // 발표별 보기의 정렬: 팀별(기본) / 발표 순서(룸 관리자가 발표 관리에서 정한 순서). 발표 순서는 주소(?sort=order)에 남는다
  const sortParam = sp.get('sort');
  const presSort: PresSort = sortParam === 'order' ? 'order' : 'team';
  const setPresSort = (v: PresSort) => {
    const next = new URLSearchParams(sp);
    if (v === 'team') next.delete('sort'); else next.set('sort', v);
    setSp(next, { replace: true });
  };
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const m = project && me ? membership(db, project.id, me.id) : undefined;
  useEffect(() => { setLimit(PAGE_SIZE); setOpenId(null); }, [f, reg, byPres, presSort]);
  // 평가 요청 알림에서 왔으면(?open=발표) 그 발표를 펼치고 보이는 곳으로 스크롤한다. 위의 초기화보다 뒤에 둔다
  const openParam = sp.get('open');
  useEffect(() => {
    if (!openParam) return;
    setOpenId(openParam);
    setLimit(Number.MAX_SAFE_INTEGER); // 아래쪽 발표여도 목록에 그려지게
    const next = new URLSearchParams(sp);
    next.delete('open');
    setSp(next, { replace: true });
    const timer = setTimeout(() => document.getElementById(`pres-${openParam}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam]);
  if (!project || !me || !access) return <RoomNotFound />;

  const presOf = (uid: ID) => presentationOfUser(db, project.id, uid);
  const myPres = presOf(me.id);
  const all = db.presentations.filter(p => p.projectId === project.id);
  // 남은 평가는 발표 단위로 센다 (팀 발표도 발표에 한 번 평가)
  const ratable = all.filter(p => !blockReason(db, project, p, me.id));
  const total = ratable.length;
  const doneCount = ratable.filter(p => myRating(db, p, me.id)).length;
  const remaining = total - doneCount;
  const s = project.settings;
  const closed = project.status === 'CLOSED';
  // 사람별 평가 현황: 룸 관리자(와 전체 열람)는 항상, 참여자는 룸 관리자가 설정에서 켰을 때만
  const showStats = !!m?.isAdmin || viewer || s.showRatingStatus;

  // 팀 구조도 순: 참여 당시 팀(상위 팀 → 하위 팀), 같은 팀은 조직도 순서(위 = 높은 사람), 소속 없음은 맨 뒤
  // 룸 관리자는 발표하지 않으므로 목록·등록 인원에서 뺀다
  const everyone = sortByTeamStructure(db, presenterRoster(db, project.id, members(db, project.id), s.allowAdminPresent));
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

  // 발표별 보기. 검색은 발표 제목과 구성원 이름, '내 발표'는 내가 구성원인 발표만.
  // - 팀별: 조직도 팀 구조도 순 (사람별 보기와 같은 순서). 구성원이 여러 팀이면 대표의 참여 당시 팀을 기준으로 하고 팀마다 묶는다
  // - 발표 순서: 룸 관리자가 발표 관리에서 정한 순서
  const presRows = presentationsOf(db, project.id)
    .filter(p => f !== 'mine' || involvedIds(p).includes(me.id))
    .filter(p => !kw || p.title.includes(kw) || involvedIds(p).some(id => userName(db, id).includes(kw)))
    .map(p => {
      const lm = membership(db, project.id, p.leaderId);
      return { pres: p, userId: p.leaderId, teamIdAtJoin: lm?.teamIdAtJoin ?? null, teamNameAtJoin: lm?.teamNameAtJoin ?? null };
    });
  const presList = presSort === 'team' ? sortByTeamStructure(db, presRows) : presRows;
  const presShown = presList.slice(0, limit);
  const presTeamCounts = new Map<ID | null, number>();
  presList.forEach(x => presTeamCounts.set(x.teamIdAtJoin, (presTeamCounts.get(x.teamIdAtJoin) ?? 0) + 1));
  const count = byPres ? presList.length : list.length;
  const unit = byPres ? '개 발표를' : '명을'; // 숫자 뒤에 붙는 단위와 조사

  return (
    <ProjectShell project={project} current={f}>
      <BoardHead title={meta.title} search={q} onSearch={v => { setQ(v); setLimit(PAGE_SIZE); }} />

      {closed && <div className="notice"><Icon name="flag" size={16} />마감된 평가룸이에요.</div>}
      {viewer && <div className="notice info"><Icon name="eye" size={16} />전체 열람 권한으로 보고 있어요. 평가·발표 등록은 할 수 없어요.</div>}

      {!viewer && f === 'all' && (
        <div className="widgets">
          <div className="widget">
            {rates ? <>
              <div className="widget-title">남은 평가 <span className="red">{remaining}</span>개 발표</div>
              <p className="muted">평가할 발표 {total}개 중 {doneCount}개 완료 · 발표 등록 {registered}/{everyone.length}명</p>
              <div className="bar"><span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>
            </> : <>
              <div className="widget-title">평가하지 않는 룸 관리자</div>
              <p className="muted">이 평가룸은 룸 관리자가 평가하지 않아요. 설정에서 바꿀 수 있어요. · 발표 등록 {registered}/{everyone.length}명</p>
            </>}
          </div>
          <div className="widget rules">
            <Rule icon="star" label="점수 범위" value={`${s.min} ~ ${s.max}점`} />
            {/* 설정 화면의 평가 규칙과 같은 순서 */}
            <Rule icon="user" label="본인 발표 평가" value={s.allowSelf ? '가능' : '불가'} tone={s.allowSelf ? 'ok' : 'no'} />
            <Rule icon="users" label="같은 회사 팀 평가" value={s.allowSameTeam ? '가능' : '불가'} tone={s.allowSameTeam ? 'ok' : 'no'} />
            <Rule icon="pencil" label="제출 후 수정" value={s.allowEdit ? '가능' : '불가'} tone={s.allowEdit ? 'ok' : 'no'} />
            <Rule icon="mic" label="룸 관리자 발표" value={s.allowAdminPresent ? '함' : '안 함'} tone={s.allowAdminPresent ? 'ok' : 'no'} />
            <Rule icon="shield" label="룸 관리자 평가" value={s.allowAdminRating ? '함' : '안 함'} tone={s.allowAdminRating ? 'ok' : 'no'} />
            <Rule icon="building" label="내 팀" value={m?.teamNameAtJoin ?? teamName(db, m?.teamIdAtJoin ?? null)} />
          </div>
        </div>
      )}

      {/* 참여자 · 발표 등록 · 발표 미등록 인원 (누르면 목록 팝업). 룸 관리자(와 전체 열람)는 항상, 참여자는 설정이 켜져 있을 때.
          미등록자에게 발표 등록 요청은 룸 관리자만 */}
      {(m?.isAdmin || viewer || s.showRosterSummary) && f === 'all' && <RosterSummary project={project} />}

      <div className="board-tools">
        <span className="tool-group"><span className="muted small">보기</span>
        <div className="segmented">
          <button className={byPres ? 'on' : ''} onClick={() => setView(true)}><Icon name="mic" size={14} />발표별</button>
          <button className={!byPres ? 'on' : ''} onClick={() => setView(false)}><Icon name="user" size={14} />사람별</button>
        </div></span>
        {/* 발표별 보기는 등록된 발표만 보이므로 발표 등록 필터 대신 정렬을 고른다 */}
        {byPres && <span className="tool-group">
          <span className="muted small">정렬</span>
          <div className="segmented">
            {PRES_SORTS.map(o => (
              <button key={o.key} className={presSort === o.key ? 'on' : ''} onClick={() => setPresSort(o.key)}>{o.label}</button>
            ))}
          </div>
        </span>}
        {!byPres && <span className="tool-group">
          <span className="muted small">발표 등록</span>
          <div className="segmented">
            {REG_FILTERS.map(r => (
              <button key={r.key} className={reg === r.key ? 'on' : ''} onClick={() => setReg(r.key)}>{r.label}</button>
            ))}
          </div>
        </span>}
        <span className="grow" />
        {!viewer && !closed && (myPres
          ? f === 'mine' && <span className="row gap-sm">
              <Link to={`/p/${project.id}/pres/${myPres.id}`} className="btn"><IconText icon="pencil">내 발표 편집</IconText></Link>
              <DeletePresentation project={project} pres={myPres} isAdmin={!!m?.isAdmin} size="md" />
            </span>
          : (!m?.isAdmin || s.allowAdminPresent) && <Link to={`/p/${project.id}/pres/new`} className="btn primary solid"><IconText icon="plus">발표 등록</IconText></Link>)}
      </div>
      <p className="muted small team-sort-hint">{byPres
        ? `${PRES_SORT_HINT[presSort]} · 발표 ${presList.length}개`
        : '팀 구조도 순 · 팀 발표는 구성원 모두 등록 완료로 표시돼요.'}</p>

      {byPres ? (
        <div className={`btable by-pres ${presSort === 'team' ? 'team-sorted' : ''} ${showStats ? 'with-stats' : ''}`}>
          <div className="bhead">
            <span className="c-no">No</span><span className="c-title">발표 제목</span><span className="c-type">유형</span>
            <span className="c-crew">구성원</span><span className="c-team">대표 소속 팀</span>
            {showStats && <span className="c-stats" title="이 발표를 평가한 현황"><span className="st">전체</span><span className="st">평가</span><span className="st">불가</span><span className="st">미평가</span></span>}
            <span className="c-score">내 평가</span><span className="c-chev" />
          </div>
          {presShown.length === 0 && <div className="bempty">{kw ? '검색 결과가 없어요.' : f === 'mine' ? '아직 등록한 발표가 없어요.' : '아직 등록된 발표가 없어요.'}</div>}
          {/* 발표 순서는 묶지 않고 한 줄씩 */}
          {presSort !== 'team' && presShown.map(({ pres: p }, i) => (
            <PresRow key={p.id} project={project} pres={p} no={i + 1} viewer={viewer} showStats={showStats}
              open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
          ))}
          {/* 팀별: 대표의 팀마다 상자로 묶는다 (사람별 보기·결과 현황 팀별과 같은 모양) */}
          {presSort === 'team' && groupByTeam(presShown).map(g => {
            const first = g.rows[0];
            return (
              <div key={`${g.teamId ?? 'none'}-${first.index}`} className="team-box">
                <div className="team-head" role="heading" aria-level={3}>
                  <Icon name="building" size={14} />
                  <b>{first.item.teamNameAtJoin ?? teamName(db, g.teamId)}</b>
                  <span className="team-path">{teamPath(db.teams, g.teamId)}</span>
                  <span className="team-count">발표 {presTeamCounts.get(g.teamId) ?? 0}개</span>
                </div>
                {g.rows.map(({ item: { pres: p }, index }) => (
                  <PresRow key={p.id} project={project} pres={p} no={index + 1} viewer={viewer} showStats={showStats}
                    open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
      <div className={`btable team-sorted ${showStats ? 'with-stats' : ''}`}>
        <div className="bhead">
          <span className="c-no">No</span><span className="c-title">이름</span><span className="c-type">유형</span>
          <span className="c-who">발표 제목</span>
          {showStats && <span className="c-stats" title="이 사람이 속한 발표의 평가 현황"><span className="st">전체</span><span className="st">평가</span><span className="st">불가</span><span className="st">미평가</span></span>}<span className="c-status">발표 등록</span><span className="c-score">내 평가</span><span className="c-chev" />
        </div>
        {shown.length === 0 && <div className="bempty">{kw ? '검색 결과가 없어요.' : '해당하는 참여자가 없어요.'}</div>}
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
      )}
      {limit < count && <LoadMore key={limit} rest={count - limit} unit={unit} onMore={() => setLimit(l => l + PAGE_SIZE)} />}
      {limit >= count && count > PAGE_SIZE && <div className="load-more muted small">모두 {count}{unit} 보여 드렸어요.</div>}
    </ProjectShell>
  );
}
