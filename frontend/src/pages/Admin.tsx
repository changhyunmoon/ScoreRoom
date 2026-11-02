import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  cancelInvitation, closeProject, deletePresentation, inviteUsers, issueInvite, movePresentation, removalImpact, removeMember, reorderPresentations, revokeInvite,
  rangeChanged, setMemberAdmin, updateSettings, validateSettings, type Presentation, type Project, type Settings,
} from '../store';
import { Chip, ConfirmButton, Empty, IconText, Popup, SectionTitle, run, toast, useMe, useNow } from '../ui';
import { Icon, type IconName } from '../icons';
import {
  blockShort, computeResults, crewSummary, formatAvg, ratingsBlockedBy, members, membership, presTypeText, presentationsOf, roleText, teamName, timeText, userName, type Cell, type ResultRow,
} from '../logic';
import { PresInfo, Presenters } from './ProjectHome';
import { BoardHead, ProjectShell } from './ProjectShell';
import OrgDirectory from './OrgDirectory';
import { ResultSharePopup } from './ResultShare';

type Tab = 'run' | 'invite' | 'members' | 'settings';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'run', label: '발표 관리', icon: 'mic' },
  { key: 'invite', label: '초대·입장 코드', icon: 'ticket' },
  { key: 'members', label: '참여자', icon: 'users' },
  { key: 'settings', label: '설정', icon: 'sliders' },
];

const inviteState = (p: Project, now: number) =>
  !p.invite ? 'NONE' : p.invite.revokedAt ? 'REVOKED' : p.invite.expiresAt !== null && p.invite.expiresAt <= now ? 'EXPIRED' : 'ACTIVE';
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export default function AdminPage() {
  const { pid } = useParams();
  const { db, me } = useMe();
  const [sp, setSp] = useSearchParams();
  const now = useNow();
  const tabParam = sp.get('tab');
  const tab: Tab = TABS.some(t => t.key === tabParam) ? tabParam as Tab : 'run';
  const project = db.projects.find(p => p.id === pid);
  if (!project || !me) return <Navigate to="/" replace />;
  // 예전 '결과 보기' 탭은 결과 현황 페이지로 합쳤다
  if (tabParam === 'result') return <Navigate to={`/p/${project.id}/results`} replace />;
  const m = membership(db, project.id, me.id);
  if (!m?.isAdmin) return <Empty icon="lock">룸 운영자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  const list = presentationsOf(db, project.id);
  const sums = db.summaries.filter(x => list.some(p => p.id === x.presentationId));
  const scored = sums.reduce((a, x) => a + x.scored, 0);
  const eligible = sums.reduce((a, x) => a + x.eligible, 0);
  const inv = inviteState(project, now);
  const active = TABS.find(t => t.key === tab)!;

  return (
    <ProjectShell project={project} current={`admin-${tab}`}>
      <BoardHead title={active.label} />

      {project.status === 'CLOSED' && <div className="notice"><Icon name="flag" size={16} />{project.closedAt && timeText(project.closedAt)}에 마감된 평가룸이에요.</div>}

      <div className="overview">
        <div className="ov"><span className="ov-label"><Icon name="mic" size={14} />발표</span><b className="ov-value">{list.length}개</b></div>
        <div className="ov"><span className="ov-label"><Icon name="check" size={14} />평가 제출</span><b className="ov-value">{scored} / {eligible}</b></div>
        <div className="ov"><span className="ov-label"><Icon name="users" size={14} />참여자</span><b className="ov-value">{members(db, project.id).length}명</b></div>
        <div className="ov"><span className="ov-label"><Icon name="ticket" size={14} />입장 코드</span>
          <b className={`ov-value ${inv === 'ACTIVE' ? 'ok' : 'off'}`}>{inv === 'ACTIVE' ? (project.invite!.expiresAt === null ? '사용 중 · 무제한' : `사용 중 ${mmss(project.invite!.expiresAt - now)}`) : inv === 'REVOKED' ? '중지됨' : inv === 'EXPIRED' ? '만료됨' : '없음'}</b></div>
      </div>

      {tab === 'run' && <RunTab project={project} />}
      {tab === 'invite' && (project.status === 'CLOSED'
        ? <Empty icon="ticket">마감된 평가룸은 초대하거나 입장 코드를 발급할 수 없어요.</Empty>
        : <InvitePanel project={project} />)}
      {tab === 'members' && <MembersTab project={project} />}
      {tab === 'settings' && <SettingsTab project={project} />}
    </ProjectShell>
  );
}

/* ---------- 입장 코드 · 초대 ---------- */
// 유효기간 선택지. null은 무제한 (중지하거나 재발급할 때까지 유효)
const CODE_TTL: { minutes: number | null; label: string }[] = [
  { minutes: 5, label: '5분' }, { minutes: 30, label: '30분' }, { minutes: 60, label: '1시간' }, { minutes: 1440, label: '24시간' }, { minutes: null, label: '무제한' },
];

function InvitePanel({ project }: { project: Project }) {
  const { me } = useMe();
  const now = useNow();
  const [minutes, setMinutes] = useState<number | null>(30);
  if (project.status === 'CLOSED') return null;
  const inv = project.invite;
  const state = inviteState(project, now);
  const isActive = state === 'ACTIVE';
  return (
    <div className="stack lg">
      <InvitePeople project={project} />
      <section className="card stack">
        <SectionTitle icon="ticket" title="입장 코드"
          right={isActive ? <Chip tone="green" icon="check">사용 중</Chip> : state === 'REVOKED' ? <Chip tone="red" icon="stop">중지됨</Chip> : state === 'EXPIRED' ? <Chip icon="clock">만료됨</Chip> : <Chip>없음</Chip>} />
        {inv && (
          <div className={`invite ${isActive ? '' : 'inactive'}`}>
            <div className="invite-code mono">{inv.code}</div>
            <div className="small">
              {isActive && (inv.expiresAt === null
                ? <div><Icon name="clock" size={13} /> <b>기간 무제한</b> · 중지할 때까지 유효</div>
                : <div><Icon name="clock" size={13} /> <b>{mmss(inv.expiresAt - now)}</b> 후 만료</div>)}
              {state === 'REVOKED' && <div>{timeText(inv.revokedAt!)}에 중지됨 · 이 코드로는 참여할 수 없어요</div>}
              {state === 'EXPIRED' && inv.expiresAt !== null && <div>{timeText(inv.expiresAt)}에 만료됨</div>}
              <div className="muted">{timeText(inv.issuedAt)} 발급</div>
            </div>
            {isActive && (
              <div className="row gap-sm">
                <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(inv.code); toast('코드를 복사했어요.'); }}><IconText icon="copy">복사</IconText></button>
                <button className="btn sm danger" onClick={() => run(() => revokeInvite(me!.id, project.id), '입장 코드를 중지했습니다. 이제 이 코드로 입장할 수 없어요.')}><IconText icon="stop">중지</IconText></button>
              </div>
            )}
          </div>
        )}
        <div className="invite-issue">
          <span className="field-label">새 코드 유효기간</span>
          <div className="row gap wrap">
            <div className="segmented">
              {CODE_TTL.map(t => <button key={t.label} className={minutes === t.minutes ? 'on' : ''} onClick={() => setMinutes(t.minutes)}>{t.label}</button>)}
            </div>
            <button className="btn primary solid" onClick={() => run(() => issueInvite(me!.id, project.id, minutes), isActive ? '새 코드를 발급했어요. 이전 코드는 무효화됩니다.' : '코드를 발급했어요.')}>
              <IconText icon={isActive ? 'refresh' : 'plus'}>{isActive ? '재발급' : '코드 발급'}</IconText>
            </button>
          </div>
        </div>
        <ul className="help-list">
          <li><b>재발급</b> 이전 코드를 즉시 무효화하고 새 코드를 만들어요.</li>
          <li><b>중지</b> 새 코드를 발급하기 전까지 아무도 참여할 수 없어요.</li>
          <li>어느 경우든 이미 참여한 사람은 그대로 남아요.</li>
        </ul>
      </section>
    </div>
  );
}

/** 조직도에서 사람을 골라 초대한다. 받은 사람은 우측 상단 알림에서 참여하거나 거절한다 */
function InvitePeople({ project }: { project: Project }) {
  const { db } = useMe();
  const [picking, setPicking] = useState(false);
  const pending = db.invitations.filter(i => i.projectId === project.id);
  const isMember = (id: string) => !!membership(db, project.id, id);
  const isPending = (id: string) => pending.some(i => i.inviteeId === id);
  return (
    <section className="card stack">
      <SectionTitle icon="users" title="사람 초대"
        right={<button className="btn primary solid" onClick={() => setPicking(true)}><IconText icon="plus">초대하기</IconText></button>} />
      {pending.length === 0
        ? <p className="muted small">대기 중인 초대가 없어요.</p>
        : (
          <div className="invite-list">
            {pending.map(i => (
              <div key={i.id} className="invite-row">
                <span><b>{userName(db, i.inviteeId)}</b> <span className="muted small">{teamName(db, db.users.find(u => u.id === i.inviteeId)?.teamId ?? null)}</span></span>
                <span className="muted small">{timeText(i.createdAt)} 초대 · 응답 대기</span>
                <button className="btn sm ghost" onClick={() => run(() => cancelInvitation(i.id), '초대를 취소했습니다.')}>취소</button>
              </div>
            ))}
          </div>
        )}
      {picking && (
        <OrgDirectory onClose={() => setPicking(false)} picker={{
          title: `'${project.name}'에 초대`,
          hint: '사람 옆의 체크박스를 눌러 초대 목록에 담으세요.',
          listTitle: '초대 목록',
          confirmLabel: '초대',
          disabledReason: id => (isMember(id) ? '참여 중' : isPending(id) ? '초대함' : null),
          onConfirm: async ids => {
            let invited = 0;
            const ok = await run(async () => { invited = await inviteUsers(project.id, ids); });
            if (ok) toast(`${invited}명에게 초대를 보냈어요.`);
            return ok;
          },
        }} />
      )}
    </section>
  );
}

/* ---------- 진행: 발표 테이블 드래그 정렬 ---------- */
/**
 * 마우스는 4px 이상 움직이면 바로 드래그를 시작하고,
 * 터치는 스크롤과 구분하기 위해 250ms 길게 누른 뒤 시작한다. 버튼·링크 위에서는 시작하지 않는다.
 */
type DragState = { from: number; to: number; dy: number; shift: number };
function useDragReorder(ids: string[], onDrop: (ids: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const cardRef = (id: string) => (el: HTMLElement | null) => { els.current[id] = el; };

  const onPointerDown = (e: React.PointerEvent, from: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    const isMouse = e.pointerType === 'mouse';
    const startY = e.clientY;
    const rects = ids.map(id => els.current[id]!.getBoundingClientRect());
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 12;
    let started = false;
    let state: DragState = { from, to: from, dy: 0, shift: rects[from].height + gap };

    const begin = () => {
      started = true;
      document.body.classList.add('dragging');
      if (!isMouse) navigator.vibrate?.(15);
      setDrag(state);
    };
    const timer = isMouse ? 0 : window.setTimeout(begin, 250);

    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!started) {
        if (isMouse && Math.abs(dy) > 4) begin();
        else { if (!isMouse && Math.abs(dy) > 8) cleanup(); return; } // 길게 누르기 전에 움직이면 스크롤로 본다
      }
      const center = rects[from].top + rects[from].height / 2 + dy;
      const to = rects.filter((r, j) => j !== from && r.top + r.height / 2 < center).length;
      state = { ...state, dy, to };
      setDrag(state);
    };
    const blockTouch = (ev: TouchEvent) => { if (started) ev.preventDefault(); };
    const up = () => {
      const wasStarted = started;
      cleanup();
      if (wasStarted && state.to !== state.from) {
        const next = ids.slice();
        const [moved] = next.splice(state.from, 1);
        next.splice(state.to, 0, moved);
        onDrop(next);
      }
    };
    function cleanup() {
      clearTimeout(timer);
      started = false;
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockTouch);
      setDrag(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', blockTouch, { passive: false });
  };

  return { drag, cardRef, onPointerDown };
}

function RunTab({ project }: { project: Project }) {
  const { db, me } = useMe();
  const list = presentationsOf(db, project.id);
  const open = project.status === 'OPEN';
  const results = computeResults(db, project);
  const { drag, cardRef, onPointerDown } = useDragReorder(list.map(p => p.id), ids => run(() => reorderPresentations(me!.id, project.id, ids), '발표 순서를 변경했습니다.'));

  // 드래그 중: 잡은 카드는 포인터를 따라가고, 사이에 있는 카드는 한 칸씩 밀려난다
  const cardStyle = (i: number): React.CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none', zIndex: 5, position: 'relative' };
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-drag.shift}px)` };
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${drag.shift}px)` };
    return undefined;
  };

  return (
    <div className="stack lg">
      <section className="stack">
        <div className="board-tools">
          <span className="bt-title">발표 순서 <b>{list.length}</b></span>
          <span className="muted small grow">{open ? '행을 끌거나 ▲▼ 버튼으로 순서를 바꿔요. 모바일은 길게 누른 뒤 끌어요.' : '마감된 평가룸의 발표 순서예요.'}</span>
          {open && <Link to={`/p/${project.id}/pres/new`} className="btn primary"><IconText icon="plus">발표 추가</IconText></Link>}
        </div>
        <div className="btable admin">
          <div className="bhead">
            <span className="c-no">순서</span><span className="c-title">발표 제목</span><span className="c-state">발표 자료</span>
            <span className="c-count">제출 / 미평가</span><span className="c-act">관리</span>
          </div>
          {list.length === 0 && <div className="bempty">등록된 발표가 없습니다. 참여자가 등록하거나 직접 추가할 수 있어요.</div>}
          {list.map((p, i) => {
            // 발표 구성원 전원의 합: 제출된 점수 수 / 아직 안 준 점수 수
            const crewRows = results.filter(x => x.pres.id === p.id);
            const r = { count: crewRows.reduce((a, x) => a + x.count, 0) };
            const notRated = crewRows.reduce((a, x) => a + x.cells.filter(c => c.kind === 'NOT_RATED').length, 0);
            const names = crewSummary(db, p);
            return (
              <div key={p.id} ref={cardRef(p.id)} style={cardStyle(i)}
                onPointerDown={open ? e => onPointerDown(e, i) : undefined}
                className={`arow ${open ? 'draggable' : ''} ${drag?.from === i ? 'drag-active' : ''}`}>
                <span className="c-no">
                  {open && <span className="grip" title="끌어서 순서 변경"><Icon name="grip" size={16} /></span>}
                  <b>{p.order}</b>
                  {open && (
                    <span className="mini-arrows">
                      <button disabled={i === 0} onClick={() => run(() => movePresentation(me!.id, project.id, p.id, -1))} aria-label="한 칸 위로" title="한 칸 위로"><Icon name="up" size={12} /></button>
                      <button disabled={i === list.length - 1} onClick={() => run(() => movePresentation(me!.id, project.id, p.id, 1))} aria-label="한 칸 아래로" title="한 칸 아래로"><Icon name="down" size={12} /></button>
                    </span>
                  )}
                </span>
                <span className="c-title">
                  <span className="t">{p.title}</span>
                  <span className="t-sub">{presTypeText[p.type]} · {names}</span>
                </span>
                <span className="c-state">{p.attachments.length ? <Chip tone="blue" icon="paperclip">{p.attachments.length}개</Chip> : <span className="muted">-</span>}</span>
                <span className="c-count">
                  <b className="green-text">{r.count}</b><span className="muted"> / </span><b className={notRated ? 'red' : 'muted'}>{notRated}</b>
                </span>
                <span className="c-act">
                  {open && <>
                    <Link to={`/p/${project.id}/pres/${p.id}`} className="btn sm" title="편집"><Icon name="pencil" size={15} /></Link>
                    <ConfirmButton className="btn sm danger" label="삭제" confirmLabel="삭제"
                      detail={r.count ? `평가 ${r.count}건이 함께 삭제됩니다.` : '제출된 평가가 없습니다.'}
                      onConfirm={() => run(() => deletePresentation(me!.id, project.id, p.id), '발표를 삭제했습니다.')} />
                  </>}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------- 결과 ---------- */
function CellView({ c, onOpenFeedback }: { c: Cell; onOpenFeedback: (c: Extract<Cell, { kind: 'SCORE' }>) => void }) {
  if (c.kind === 'SCORE') {
    const cls = `ss-score ${c.inRange === false ? 'ss-out' : ''}`;
    // 피드백이 있으면 눌러서 팝업으로 본다
    if (c.rating.feedback) return (
      <button type="button" className={`${cls} ss-feedback`} title="피드백 보기" onClick={() => onOpenFeedback(c)}>
        {c.rating.score}<span className="ss-mark">💬</span>
      </button>
    );
    return <span className={cls}>{c.rating.score}</span>;
  }
  if (c.kind === 'BLOCKED') return <span className="muted small" title={blockShort[c.reason]}>불가</span>;
  return <span className="red-text small">미평가</span>;
}

function Metric({ label, value, hint, strong }: { label: string; value: React.ReactNode; hint?: string; strong?: boolean }) {
  return <div className={`metric ${strong ? 'key' : ''}`}><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;
}

type SortKey = 'order' | 'avg' | 'inAvg';
/** 평균이 높은 순으로 순위를 매긴다. 같은 평균은 같은 순위(1, 1, 3), 평균이 없으면 순위 없음 */
function rankBy(rows: ResultRow[], value: (r: ResultRow) => number | null) {
  const vals = rows.map(r => ({ key: r.key, v: value(r) })).filter((x): x is { key: string; v: number } => x.v !== null);
  return new Map(vals.map(x => [x.key, 1 + vals.filter(y => y.v > x.v).length]));
}
const rankText = (n: number | undefined) => n === undefined ? '—' : `${n}위`;
const ROLE_CLASS = { LEADER: 'lead', LEADER_PRESENTER: 'lead', PRESENTER: 'presenter', MEMBER: 'member' } as const;

/** 사람 이름 + 그 아래 발표 제목 (한 사람이 여러 발표를 할 수 있어서 발표 제목으로 구분한다) */
function PersonCell({ r, compact, onOpenPres }: { r: ResultRow; compact?: boolean; onOpenPres: (p: Presentation) => void }) {
  const { db } = useMe();
  return (
    <>
      <b>{userName(db, r.targetId)}</b>{!compact && <> <span className={`crew-label ${ROLE_CLASS[r.role]}`}>{roleText[r.role]}</span></>}
      <button type="button" className="result-pres" title="발표 설명 보기"
        onClick={e => { e.stopPropagation(); onOpenPres(r.pres); }}>{r.pres.title}</button>
    </>
  );
}

/** 결과 현황에서 발표 제목을 누르면 뜨는 발표 설명 창 */
function PresentationPopup({ project, pres, onClose }: { project: Project; pres: Presentation; onClose: () => void }) {
  return (
    <Popup label={pres.title} onClose={onClose} head={<><Chip>{presTypeText[pres.type]}</Chip><h2>{pres.title}</h2></>}>
      <PresInfo project={project} pres={pres} />
    </Popup>
  );
}

/** 평가자별 점수표에서 💬 점수를 누르면 뜨는 피드백 창 */
function FeedbackPopup({ project, cell, row, onClose }: {
  project: Project; cell: Extract<Cell, { kind: 'SCORE' }>; row: ResultRow; onClose: () => void;
}) {
  const { db } = useMe();
  const rater = userName(db, cell.userId);
  const target = userName(db, row.targetId);
  return (
    <Popup label={`${rater}의 피드백`} onClose={onClose} head={<><Chip>피드백</Chip><h2>{rater} → {target}</h2></>}>
      <dl className="info-table">
        <div className="info-row"><dt>발표</dt><dd>{row.pres.title}</dd></div>
        <div className="info-row"><dt>평가자</dt><dd>{rater} <span className="muted small">{teamName(db, membership(db, project.id, cell.userId)?.teamIdAtJoin ?? null)}</span></dd></div>
        <div className="info-row"><dt>점수</dt><dd><b className="feedback-score">{cell.rating.score}</b><span className="muted"> / {project.settings.max}점</span> <span className="muted small">· {timeText(cell.rating.submittedAt)} 제출</span></dd></div>
        <div className="info-row"><dt>피드백</dt><dd><p className="feedback-text">{cell.rating.feedback}</p></dd></div>
      </dl>
    </Popup>
  );
}

/**
 * 결과 표. 한 줄 = 발표 구성원 한 명 (이름 아래 발표 제목).
 * detail=false면 평가자별 점수·피드백·합계와 평가자별 점수표를 숨기고 인원·평균·순위만 보여준다 (전체 열람 권한자용).
 */
export function ResultTab({ project, detail = true }: { project: Project; detail?: boolean }) {
  const { db } = useMe();
  const [decimals, setDecimals] = useState(true);
  // 보기(구성원별 집계/평가자별 점수표)와 정렬은 주소에 남겨서 새로 고침해도 유지한다
  const [sp, setSp] = useSearchParams();
  const view: 'topic' | 'matrix' = detail && sp.get('view') === 'sheet' ? 'matrix' : 'topic';
  const sortParam = sp.get('sort');
  const sortBy: SortKey = sortParam === 'avg' || sortParam === 'inAvg' ? sortParam : 'order';
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp);
    if (value === null) next.delete(key); else next.set(key, value);
    setSp(next, { replace: true });
  };
  const setView = (v: 'topic' | 'matrix') => setParam('view', v === 'matrix' ? 'sheet' : null);
  const setSortBy = (k: SortKey) => setParam('sort', k === 'order' ? null : k);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [popupPres, setPopupPres] = useState<Presentation | null>(null);
  const [sharing, setSharing] = useState(false);
  const [popupFeedback, setPopupFeedback] = useState<{ cell: Extract<Cell, { kind: 'SCORE' }>; row: ResultRow } | null>(null);
  const s = project.settings;
  const hasAgg = s.aggMin !== null && s.aggMax !== null;
  // 인원·평균·순위는 목업 API가 계산한 집계(summaries)를 쓴다. 합계와 평가자별 점수(detail)는 룸 운영자에게만 보이는 점수로 계산한다.
  const base = computeResults(db, project);
  const summaryOf = (r: ResultRow) => db.summaries.find(x => x.presentationId === r.pres.id && x.targetId === r.targetId);
  const rank = rankBy(base, r => summaryOf(r)?.avg ?? null);
  const inRank = rankBy(base, r => summaryOf(r)?.inAvg ?? null);
  const sortKey: SortKey = sortBy === 'inAvg' && !hasAgg ? 'order' : sortBy;
  const rows = sortKey === 'order' ? base : [...base].sort((a, b) => {
    const ra = (sortKey === 'avg' ? rank : inRank).get(a.key) ?? Infinity;
    const rb = (sortKey === 'avg' ? rank : inRank).get(b.key) ?? Infinity;
    return ra - rb || a.pres.order - b.pres.order;
  });
  const ms = members(db, project.id);
  // 실시간 반영은 하지 않는다. 화면을 연(새로 고침한) 시각 기준의 결과를 보여준다.
  const [loadedAt] = useState(() => Date.now());

  return (
    <div className="stack lg">
      <div className="result-bar card">
        <div className="row between wrap gap">
          {project.status === 'OPEN'
            ? <div className="row gap">
                <span className="result-badge"><Icon name="clock" size={14} />{timeText(loadedAt)} 기준 중간 결과</span>
                <button className="btn sm" onClick={() => window.location.reload()}><IconText icon="refresh">새로 고침</IconText></button>
              </div>
            : <span className="result-badge"><Icon name="flag" size={14} />최종 결과</span>}
          <label className="switch"><input type="checkbox" checked={decimals} onChange={e => setDecimals(e.target.checked)} /><span />평균 소수점 {decimals ? '넷째 자리까지' : '정수로 반올림'}</label>
        </div>
        {detail && <div className="segmented full">
          <button className={view === 'topic' ? 'on' : ''} onClick={() => setView('topic')}><Icon name="list" size={15} />구성원별 집계</button>
          <button className={view === 'matrix' ? 'on' : ''} onClick={() => setView('matrix')}><Icon name="grid" size={15} />평가자별 점수표</button>
        </div>}
        <div className="rule-row small">
          <span><Icon name="star" size={13} />점수 범위 <b>{s.min}~{s.max}</b></span>
          <span><Icon name="sliders" size={13} />집계 기준 {hasAgg ? <b>{s.aggMin}~{s.aggMax}</b> : '없음'}</span>
        </div>
      </div>

      {rows.length === 0 && <Empty icon="chart">아직 발표가 없어요.</Empty>}

      {rows.length > 0 && (
        <div className="row gap wrap sort-bar">
          <span className="muted small">정렬</span>
          <div className="segmented">
            <button className={sortKey === 'order' ? 'on' : ''} onClick={() => setSortBy('order')}>발표 순서</button>
            <button className={sortKey === 'avg' ? 'on' : ''} onClick={() => setSortBy('avg')}>전체 점수 순위</button>
            {hasAgg && <button className={sortKey === 'inAvg' ? 'on' : ''} onClick={() => setSortBy('inAvg')}>집계 기준 순위</button>}
          </div>
          {detail && view === 'topic' && <button className="btn sm share-btn" onClick={() => setSharing(true)}><IconText icon="share">결과 공유</IconText></button>}
        </div>
      )}

      {view === 'topic' && rows.length > 0 && (
        <div className="table-wrap">
          <table className="tbl board-tbl results">
            <thead>
              <tr>
                <th rowSpan={2} className="left">발표자 · 발표</th>
                <th colSpan={5} className="grp">인원</th>
                <th colSpan={detail ? 3 : 2} className="grp">전체 점수</th>
                {hasAgg && <th colSpan={detail ? 3 : 2} className="grp agg">집계 기준 {s.aggMin}~{s.aggMax}점</th>}
                {detail && <th rowSpan={2} />}
              </tr>
              <tr>
                <th title="이 평가룸의 전체 참여자">참여</th>
                <th title="본인·같은 발표 팀원·같은 회사 팀이라 평가할 수 없는 인원">평가 불가</th>
                <th title="참여 - 평가 불가">평가 가능</th>
                <th title="점수를 제출한 인원">평가함</th>
                <th title="평가할 수 있는데 아직 점수를 주지 않은 인원">미평가</th>
                {detail && <th>합계</th>}<th>평균</th><th title="전체 평균이 높은 순">순위</th>
                {hasAgg && <>{detail && <th className="agg">합계</th>}<th className="agg">평균</th><th className="agg" title="집계 기준 평균이 높은 순">순위</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const open = detail && openKey === r.key;
                const scored = r.cells.filter((c): c is Extract<Cell, { kind: 'SCORE' }> => c.kind === 'SCORE');
                const notRated = r.cells.filter(c => c.kind === 'NOT_RATED');
                const blocked = r.cells.filter((c): c is Extract<Cell, { kind: 'BLOCKED' }> => c.kind === 'BLOCKED');
                const span = hasAgg ? 13 : 10;
                const sm = summaryOf(r);
                return (
                  <Fragment key={r.key}>
                    <tr className={detail ? `click ${open ? 'open' : ''}` : undefined} onClick={detail ? () => setOpenKey(open ? null : r.key) : undefined}>
                      <td className="left"><PersonCell r={r} onOpenPres={setPopupPres} /></td>
                      <td>{sm?.total ?? 0}</td>
                      <td className="muted">{sm?.blocked ?? 0}</td>
                      <td>{sm?.eligible ?? 0}</td>
                      <td>{sm?.scored ?? 0}</td>
                      <td className={sm?.notRated ? 'red' : 'muted'}>{sm?.notRated ?? 0}</td>
                      {detail && <td>{r.sum}</td>}<td className="key">{formatAvg(sm?.avg ?? null, decimals)}</td>
                      <td className={`rank ${sortKey === 'avg' ? 'on' : ''}`}>{rankText(rank.get(r.key))}</td>
                      {hasAgg && <>
                        {detail && <td className="agg">{r.inSum}</td>}<td className="key agg">{formatAvg(sm?.inAvg ?? null, decimals)}</td>
                        <td className={`rank agg ${sortKey === 'inAvg' ? 'on' : ''}`}>{rankText(inRank.get(r.key))}</td>
                      </>}
                      {detail && <td><Icon name={open ? 'up' : 'down'} size={16} /></td>}
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={span}>
                          <div className="detail-title">{userName(db, r.targetId)}에게 준 점수 · 피드백</div>
                          <table className="tbl inner">
                            <thead><tr><th className="left">평가자</th><th>점수</th><th className="left">피드백</th><th className="left">제출 시각</th></tr></thead>
                            <tbody>
                              {scored.sort((a, b) => b.rating.score - a.rating.score).map(c => (
                                <tr key={c.userId}>
                                  <td className="left nowrap">{userName(db, c.userId)} <span className="muted small">{teamName(db, membership(db, project.id, c.userId)?.teamIdAtJoin ?? null)}</span></td>
                                  <td className="nowrap">
                                    <b className={c.inRange === false ? 'out' : ''}>{c.rating.score}</b>
                                    {c.inRange === false && <> <Chip tone="amber">기준 밖</Chip></>}
                                    {c.outOfInput && <> <Chip tone="red">현재 범위 밖</Chip></>}
                                  </td>
                                  <td className="left feedback-cell">{c.rating.feedback ?? <span className="muted">-</span>}</td>
                                  <td className="left small">
                                    {timeText(c.rating.submittedAt)}
                                  </td>
                                </tr>
                              ))}
                              {notRated.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={3} className="left"><Chip tone="amber">평가 안 함</Chip></td></tr>)}
                              {blocked.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={3} className="left"><Chip icon="lock">평가 불가 · {blockShort[c.reason]}</Chip></td></tr>)}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && view === 'matrix' && rows.length > 0 && <>
        <div className="table-wrap">
          <table className="tbl board-tbl score-sheet">
            <thead>
              <tr>
                <th className="left sticky">평가자</th>
                {rows.map(r => <th key={r.key} className="ss-person" title={`${userName(db, r.targetId)} · ${r.pres.title}`}><PersonCell r={r} compact onOpenPres={setPopupPres} /></th>)}
              </tr>
            </thead>
            <tbody>
              {ms.map(m => (
                <tr key={m.userId}>
                  <td className="left sticky"><b>{userName(db, m.userId)}</b> <span className="muted small">{teamName(db, m.teamIdAtJoin)}</span></td>
                  {rows.map(r => <td key={r.key}><CellView c={r.cells.find(c => c.userId === m.userId)!} onOpenFeedback={cell => setPopupFeedback({ cell, row: r })} /></td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td className="left sticky">합계</td>{rows.map(r => <td key={r.key}>{r.sum}</td>)}</tr>
              <tr><td className="left sticky">평균</td>{rows.map(r => <td key={r.key} className="key">{formatAvg(r.avg, decimals)}</td>)}</tr>
              {hasAgg && <tr><td className="left sticky agg">기준 내 합계</td>{rows.map(r => <td key={r.key} className="agg">{r.inSum}</td>)}</tr>}
              {hasAgg && <tr><td className="left sticky agg">기준 내 평균</td>{rows.map(r => <td key={r.key} className="key agg">{formatAvg(r.inAvg, decimals)}</td>)}</tr>}
            </tfoot>
          </table>
        </div>
        <p className="hint">
          <span className="ss-mark">💬</span> 피드백 있음(누르면 보여요)
          {hasAgg && <> · <span className="ss-out">밑줄</span> 집계 기준 밖</>}
          {' '}· <span className="red-text">미평가</span> · <span className="muted">불가</span>
        </p>
      </>}
      {popupPres && <PresentationPopup project={project} pres={popupPres} onClose={() => setPopupPres(null)} />}
      {sharing && <ResultSharePopup db={db} project={project} rows={base} decimals={decimals} onClose={() => setSharing(false)}
        avgOf={r => summaryOf(r)?.avg ?? null} inAvgOf={r => summaryOf(r)?.inAvg ?? null} />}
      {popupFeedback && <FeedbackPopup project={project} cell={popupFeedback.cell} row={popupFeedback.row} onClose={() => setPopupFeedback(null)} />}
    </div>
  );
}

/* ---------- 참여자 ---------- */
function MembersTab({ project }: { project: Project }) {
  const { db, me } = useMe();
  const [q, setQ] = useState('');
  const ms = members(db, project.id).slice()
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || userName(db, a.userId).localeCompare(userName(db, b.userId)))
    .filter(m => !q.trim() || userName(db, m.userId).includes(q.trim()) || teamName(db, m.teamIdAtJoin).includes(q.trim()));
  const open = project.status === 'OPEN';
  return (
    <section className="stack">
      <div className="board-tools">
        <span className="bt-title">참여자 <b>{members(db, project.id).length}</b></span>
        <span className="muted small grow">팀은 참여한 시점의 소속으로 고정되어 같은 팀 평가 제한에 쓰여요.</span>
        <label className="board-search sm"><input placeholder="이름·팀 검색" value={q} onChange={e => setQ(e.target.value)} aria-label="참여자 검색" /><Icon name="search" size={15} /></label>
      </div>
      <div className="btable members">
        <div className="bhead"><span className="c-name">이름</span><span className="c-team">팀 (참여 당시)</span><span className="c-date">참여일</span><span className="c-role">권한</span><span className="c-act">관리</span></div>
        {ms.length === 0 && <div className="bempty">검색 결과가 없습니다.</div>}
        {ms.map(m => {
          const impact = removalImpact(db, project.id, m.userId);
          const name = userName(db, m.userId);
          return (
            <div key={m.userId} className="mrow">
              <span className="c-name"><span className={`avatar sm ${m.isAdmin ? '' : 'plain'}`}>{name.slice(0, 1)}</span><b>{name}</b>{m.userId === me!.id && <small className="muted"> (나)</small>}</span>
              <span className="c-team">{teamName(db, m.teamIdAtJoin)}</span>
              <span className="c-date muted">{timeText(m.joinedAt)}</span>
              <span className="c-role">{m.isAdmin ? <Chip tone="violet" icon="shield">룸 운영자</Chip> : <Chip icon="user">참여자</Chip>}</span>
              <span className="c-act">
                {open && <>
                  <button className="btn sm" onClick={() => run(() => setMemberAdmin(me!.id, project.id, m.userId, !m.isAdmin), m.isAdmin ? '룸 운영자 권한을 해제했습니다.' : '룸 운영자 권한을 부여했습니다.')}>
                    {m.isAdmin ? '운영자 해제' : '운영자 지정'}
                  </button>
                  {m.userId !== me!.id && (
                    <ConfirmButton className="btn sm danger" label="제거" confirmLabel="제거"
                      detail={<>
                        주고받은 평가 {impact.ratings}건 삭제
                        {impact.soloPresentations.length > 0 && <> · 단독 발표 {impact.soloPresentations.length}개({impact.soloPresentations.map(p => p.title).join(', ')}) 삭제</>}
                        {impact.sharedPresentations.length > 0 && <> · 공동 발표 {impact.sharedPresentations.length}개에서 발표자 제외</>}
                      </>}
                      onConfirm={() => run(() => removeMember(me!.id, project.id, m.userId), '참여자를 제거하고 결과를 다시 계산했습니다.')} />
                  )}
                </>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- 설정 ---------- */
function Toggle({ checked, disabled, onChange, title, desc }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; title: string; desc?: string }) {
  return (
    <label className="toggle-row">
      <div className="grow"><div className="toggle-title">{title}</div>{desc && <div className="hint">{desc}</div>}</div>
      <span className="switch"><input type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
    </label>
  );
}

function SettingsTab({ project }: { project: Project }) {
  const { db, me } = useMe();
  const s = project.settings;
  const [f, setF] = useState({
    min: String(s.min), max: String(s.max), aggOn: s.aggMin !== null,
    aggMin: String(s.aggMin ?? s.min), aggMax: String(s.aggMax ?? s.max), allowSelf: s.allowSelf, allowSameTeam: s.allowSameTeam, allowSameCrew: s.allowSameCrew, allowEdit: s.allowEdit,
  });
  const open = project.status === 'OPEN';
  // 점수 입력 범위를 바꾸면 기존 평가가 모두 지워지고 집계 기준도 '사용 안 함'으로 초기화된다
  const reset = f.min.trim() !== '' && f.max.trim() !== '' && rangeChanged(s, { min: Number(f.min), max: Number(f.max) });
  const aggOn = f.aggOn && !reset;
  const next: Settings = {
    min: Number(f.min), max: Number(f.max), aggMin: aggOn ? Number(f.aggMin) : null, aggMax: aggOn ? Number(f.aggMax) : null,
    allowSelf: f.allowSelf, allowSameTeam: f.allowSameTeam, allowSameCrew: f.allowSameCrew, allowEdit: f.allowEdit,
  };
  const blank = [f.min, f.max, ...(aggOn ? [f.aggMin, f.aggMax] : [])].some(v => v.trim() === '');
  const err = blank ? '빈 값이 있습니다.' : validateSettings(next);
  const dirty = JSON.stringify(next) !== JSON.stringify(s);
  const ratingCount = db.ratings.filter(r => r.projectId === project.id).length;
  // 평가 규칙을 '불가'로 바꾸면 새 규칙에 맞지 않게 되는 기존 평가가 지워진다 (점수 범위 변경은 전부 지워지므로 따로 셈)
  const ruleRemoved = reset || err ? 0 : ratingsBlockedBy(db, project, next).length;
  const destructive = reset || ruleRemoved > 0;
  const removeCount = reset ? ratingCount : ruleRemoved;
  const save = async () => {
    let removed = 0;
    const ok = await run(async () => { removed = await updateSettings(me!.id, project.id, next); });
    if (!ok) return;
    if (reset) {
      setF({ ...f, aggOn: false, aggMin: f.min, aggMax: f.max });
      toast(removed ? `설정을 저장했습니다. 평가 ${removed}건을 지우고 집계 기준을 초기화했어요.` : '설정을 저장했습니다. 집계 기준을 초기화했어요.');
    } else toast(removed ? `설정을 저장했습니다. 새 평가 규칙에 맞지 않는 평가 ${removed}건을 지웠어요.` : '설정을 저장했습니다.');
  };
  const num = (k: 'min' | 'max' | 'aggMin' | 'aggMax', label: string) => (
    <label className="num-field"><span>{label}</span>
      <input type="number" inputMode="numeric" step={1} disabled={!open || ((k === 'aggMin' || k === 'aggMax') && !aggOn)} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack lg">
      <section className="card stack">
        <SectionTitle icon="star" title="점수 입력 범위" />
        <div className="range-row">{num('min', '최소')}<span className="tilde">~</span>{num('max', '최대')}<span className="unit">점</span></div>
      </section>

      <section className="card stack">
        <SectionTitle icon="sliders" title="집계 기준 범위"
          right={<span className="switch"><input type="checkbox" disabled={!open || reset} checked={aggOn} onChange={e => setF({ ...f, aggOn: e.target.checked })} aria-label="집계 기준 사용" /><span /></span>} />
        {reset ? (
          <p className="muted small">저장하면 '사용 안 함'으로 초기화돼요.</p>
        ) : f.aggOn ? (
          <div className="range-row">{num('aggMin', '최저치 (이상)')}<span className="tilde">~</span>{num('aggMax', '최대치 (이하)')}<span className="unit">점</span></div>
        ) : <p className="muted small">사용 안 함</p>}
      </section>

      <section className="card stack">
        <SectionTitle icon="users" title="평가 규칙" />
        <Toggle disabled={!open} checked={f.allowSelf} onChange={v => setF({ ...f, allowSelf: v })}
          title="본인 평가 허용" />
        <Toggle disabled={!open} checked={f.allowSameTeam} onChange={v => setF({ ...f, allowSameTeam: v })}
          title="같은 회사 팀 평가 허용" desc="끄면 나와 같은 회사 팀인 사람을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowSameCrew} onChange={v => setF({ ...f, allowSameCrew: v })}
          title="같은 발표 팀원 평가 허용" desc="끄면 내가 참여한 발표의 다른 구성원을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowEdit} onChange={v => setF({ ...f, allowEdit: v })}
          title="제출한 점수 수정 허용" />
      </section>

      {open && (
        <div className="save-bar">
          {err ? <div className="error"><Icon name="ban" size={15} />{err}</div>
            : reset ? <div className="notice small"><Icon name="info" size={15} />저장하면 평가 {ratingCount}건이 모두 지워지고 집계 기준이 초기화돼요.</div>
            : ruleRemoved > 0 && <div className="notice small"><Icon name="info" size={15} />바뀐 평가 규칙에 맞지 않는 기존 평가 {ruleRemoved}건이 저장할 때 지워져요.</div>}
          {destructive && !err
            ? <ConfirmButton label={reset ? '변경 사항 저장 (평가 초기화)' : `변경 사항 저장 (평가 ${removeCount}건 삭제)`} className="btn danger solid block" confirmLabel={`평가 ${removeCount}건 지우고 저장`}
                detail="지운 평가는 되돌릴 수 없습니다." onConfirm={save} />
            : <button className="btn primary solid block" disabled={!!err || !dirty} onClick={save}>
                <IconText icon="check">{dirty ? '변경 사항 저장' : '저장됨'}</IconText>
              </button>}
        </div>
      )}

      {open && (
        <section className="card danger-zone stack">
          <SectionTitle icon="flag" tone="red" title="평가 마감" desc="마감하면 다시 열 수 없어요." />
          <ConfirmButton label="평가 마감하기" confirmLabel="마감합니다" detail="마감 후에는 되돌릴 수 없습니다." onConfirm={() => run(() => closeProject(me!.id, project.id), '평가를 마감했습니다.')} />
        </section>
      )}
    </div>
  );
}
