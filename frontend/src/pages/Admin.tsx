import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  closeProject, completeCurrentPresentation, deletePresentation, issueInvite, movePresentation, removalImpact, removeMember, reorderPresentations, revokeInvite,
  setCurrentPresentation, setMemberAdmin, updateSettings, validateSettings, type Presentation, type Project, type Settings,
} from '../store';
import { Chip, ConfirmButton, Empty, IconText, SectionTitle, run, toast, useMe, useNow } from '../ui';
import { Icon, type IconName } from '../icons';
import {
  computeResults, crewSummary, formatAvg, members, membership, presTypeText, presentationsOf, teamName, timeText, userName, type Cell,
} from '../logic';
import { Presenters } from './ProjectHome';
import { BoardHead, ProjectShell } from './ProjectShell';

type Tab = 'run' | 'result' | 'members' | 'settings';
const TABS: { key: Tab; label: string; icon: IconName; desc: string }[] = [
  { key: 'run', label: '진행 관리', icon: 'mic', desc: '입장 코드를 발급하고, 발표 순서와 지금 진행할 발표를 정해요.' },
  { key: 'result', label: '결과 보기', icon: 'chart', desc: '발표별 점수 집계와 누가 누구에게 몇 점을 줬는지 확인해요. 룸 운영자만 볼 수 있어요.' },
  { key: 'members', label: '참여자', icon: 'users', desc: '참여자에게 룸 운영자 권한을 주거나 평가룸에서 제거해요.' },
  { key: 'settings', label: '설정', icon: 'sliders', desc: '점수 범위와 평가 규칙을 정하고, 평가를 마감해요.' },
];

const inviteState = (p: Project, now: number) =>
  !p.invite ? 'NONE' : p.invite.revokedAt ? 'REVOKED' : p.invite.expiresAt <= now ? 'EXPIRED' : 'ACTIVE';
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export default function AdminPage() {
  const { pid } = useParams();
  const { db, me } = useMe();
  const [sp, setSp] = useSearchParams();
  const now = useNow();
  const tab = (sp.get('tab') as Tab) || 'run';
  const project = db.projects.find(p => p.id === pid);
  if (!project || !me) return <Navigate to="/" replace />;
  const m = membership(db, project.id, me.id);
  if (!m?.isAdmin) return <Empty icon="lock">룸 운영자만 볼 수 있는 화면이에요. <Link to={`/p/${project.id}`}>참여자 화면으로</Link></Empty>;

  const list = presentationsOf(db, project.id);
  const cur = list.find(p => p.id === project.currentPresentationId);
  const startedCount = list.filter(p => p.status === 'STARTED').length;
  const inv = inviteState(project, now);
  const active = TABS.find(t => t.key === tab)!;

  return (
    <ProjectShell project={project} current={`admin-${tab}`}>
      <BoardHead title={active.label} desc={active.desc} />

      {project.status === 'CLOSED' && <div className="notice"><Icon name="flag" size={16} />{project.closedAt && timeText(project.closedAt)}에 마감된 평가룸이에요. 수정은 할 수 없고 기록만 볼 수 있어요.</div>}

      <div className="overview">
        <div className="ov"><span className="ov-label"><Icon name="mic" size={14} />지금 발표</span><b className="ov-value ellipsis">{cur ? cur.title : '없음'}</b></div>
        <div className="ov"><span className="ov-label"><Icon name="check" size={14} />진행한 발표</span><b className="ov-value">{startedCount} / {list.length}</b></div>
        <div className="ov"><span className="ov-label"><Icon name="users" size={14} />참여자</span><b className="ov-value">{members(db, project.id).length}명</b></div>
        <div className="ov"><span className="ov-label"><Icon name="ticket" size={14} />입장 코드</span>
          <b className={`ov-value ${inv === 'ACTIVE' ? 'ok' : 'off'}`}>{inv === 'ACTIVE' ? `사용 중 ${mmss(project.invite!.expiresAt - now)}` : inv === 'REVOKED' ? '중지됨' : inv === 'EXPIRED' ? '만료됨' : '없음'}</b></div>
      </div>

      {tab === 'run' && <RunTab project={project} />}
      {tab === 'result' && <ResultTab project={project} />}
      {tab === 'members' && <MembersTab project={project} />}
      {tab === 'settings' && <SettingsTab project={project} />}
    </ProjectShell>
  );
}

/* ---------- 진행: 초대 코드 ---------- */
function InvitePanel({ project }: { project: Project }) {
  const { me } = useMe();
  const now = useNow();
  const [minutes, setMinutes] = useState(30);
  if (project.status === 'CLOSED') return null;
  const inv = project.invite;
  const state = inviteState(project, now);
  const isActive = state === 'ACTIVE';
  return (
    <section className="card stack">
      <SectionTitle icon="ticket" title="입장 코드" desc="참여자는 이 코드를 입력해 평가룸에 들어와요."
        right={isActive ? <Chip tone="green" icon="check">사용 중</Chip> : state === 'REVOKED' ? <Chip tone="red" icon="stop">중지됨</Chip> : state === 'EXPIRED' ? <Chip icon="clock">만료됨</Chip> : <Chip>없음</Chip>} />
      {inv && (
        <div className={`invite ${isActive ? '' : 'inactive'}`}>
          <div className="invite-code mono">{inv.code}</div>
          <div className="small">
            {isActive && <div><Icon name="clock" size={13} /> <b>{mmss(inv.expiresAt - now)}</b> 후 만료</div>}
            {state === 'REVOKED' && <div>{timeText(inv.revokedAt!)}에 중지됨 · 이 코드로는 참여할 수 없어요</div>}
            {state === 'EXPIRED' && <div>{timeText(inv.expiresAt)}에 만료됨</div>}
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
            {[1, 5, 30, 60].map(mn => <button key={mn} className={minutes === mn ? 'on' : ''} onClick={() => setMinutes(mn)}>{mn === 60 ? '1시간' : `${mn}분`}</button>)}
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

function presStage(project: Project, p: Presentation) {
  if (project.currentPresentationId === p.id) return { cls: 'stage-live', chip: <Chip tone="red"><span className="live-dot" />지금 발표 중</Chip> };
  if (p.status === 'STARTED') return { cls: 'stage-done', chip: <Chip tone="blue" icon="check">발표 끝남 · 평가 가능</Chip> };
  return { cls: 'stage-wait', chip: <Chip icon="clock">발표 전</Chip> };
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
      <InvitePanel project={project} />
      <section className="stack">
        <div className="board-tools">
          <span className="bt-title">발표 순서 <b>{list.length}</b></span>
          <span className="muted small grow">{open ? '행을 끌거나 ▲▼ 버튼으로 순서를 바꿔요. 모바일은 길게 누른 뒤 끌어요.' : '마감된 평가룸의 발표 순서예요.'}</span>
          {open && <Link to={`/p/${project.id}/pres/new`} className="btn primary"><IconText icon="plus">발표 추가</IconText></Link>}
        </div>
        <div className="btable admin">
          <div className="bhead">
            <span className="c-no">순서</span><span className="c-title">발표 제목</span><span className="c-state">상태</span>
            <span className="c-count">제출 / 미평가</span><span className="c-act">관리</span>
          </div>
          {list.length === 0 && <div className="bempty">등록된 발표가 없습니다. 참여자가 등록하거나 직접 추가할 수 있어요.</div>}
          {list.map((p, i) => {
            const isCur = project.currentPresentationId === p.id;
            const r = results.find(x => x.pres.id === p.id)!;
            const notRated = r.cells.filter(c => c.kind === 'NOT_RATED').length;
            const stage = presStage(project, p);
            const names = crewSummary(db, p);
            return (
              <div key={p.id} ref={cardRef(p.id)} style={cardStyle(i)}
                onPointerDown={open ? e => onPointerDown(e, i) : undefined}
                className={`arow ${isCur ? 'live' : ''} ${open ? 'draggable' : ''} ${drag?.from === i ? 'drag-active' : ''}`}>
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
                <span className="c-state">{stage.chip}</span>
                <span className="c-count">
                  {p.status === 'STARTED'
                    ? <><b className="green-text">{r.count}</b><span className="muted"> / </span><b className={notRated ? 'red' : 'muted'}>{notRated}</b></>
                    : <span className="muted">-</span>}
                </span>
                <span className="c-act">
                  {open && <>
                    {isCur
                      ? <button className="btn sm primary solid" onClick={() => run(() => {
                          const next = completeCurrentPresentation(me!.id, project.id, p.id);
                          toast(next ? `발표를 완료하고 "${next}" 발표를 시작했습니다.` : '마지막 발표를 완료했습니다.');
                        })}><IconText icon="check">발표 완료</IconText></button>
                      : <button className="btn sm primary solid" onClick={() => run(() => setCurrentPresentation(me!.id, project.id, p.id), `"${p.title}" 발표를 시작했습니다.`)}>
                          <IconText icon="play">{p.status === 'STARTED' ? '다시 진행' : '발표 시작'}</IconText>
                        </button>}
                    <Link to={`/p/${project.id}/pres/${p.id}`} className="btn sm" title="편집"><Icon name="pencil" size={15} /></Link>
                    <ConfirmButton className="btn sm danger" label="삭제" confirmLabel="삭제"
                      detail={r.count ? `평가 ${r.count}건과 수정 이력이 함께 삭제됩니다.` : '제출된 평가가 없습니다.'}
                      onConfirm={() => run(() => deletePresentation(me!.id, project.id, p.id), '발표를 삭제했습니다.')} />
                  </>}
                </span>
              </div>
            );
          })}
        </div>
        {open && list.length > 0 && <p className="hint"><b>발표 완료</b>를 누르면 다음 순서의 미시작 발표가 바로 진행돼요. 마지막 발표를 완료하면 현재 발표가 비워집니다. 완료한 발표도 평가 마감 전까지 평가할 수 있어요.</p>}
      </section>
    </div>
  );
}

/* ---------- 결과 ---------- */
function CellView({ c }: { c: Cell }) {
  if (c.kind === 'SCORE') return (
    <span className={`cell score ${c.inRange === false ? 'out' : ''}`} title={c.history.length ? '수정 이력\n' + c.history.map(h => `${h.before}→${h.after} (${timeText(h.at)})`).join('\n') : undefined}>
      {c.rating.score}{c.history.length > 0 && <sup>✎</sup>}
    </span>
  );
  if (c.kind === 'BLOCKED') return <span className="cell blocked" title={c.reason === 'SELF' ? '본인 참여 발표' : '같은 팀'}><Icon name="lock" size={12} /></span>;
  if (c.kind === 'PENDING') return <span className="cell pending">대기</span>;
  return <span className="cell not-rated">안 함</span>;
}

function Metric({ label, value, hint, strong }: { label: string; value: React.ReactNode; hint?: string; strong?: boolean }) {
  return <div className={`metric ${strong ? 'key' : ''}`}><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;
}

function ResultTab({ project }: { project: Project }) {
  const { db } = useMe();
  const [decimals, setDecimals] = useState(true);
  const [view, setView] = useState<'topic' | 'matrix'>('topic');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const rows = computeResults(db, project);
  const s = project.settings;
  const hasAgg = s.aggMin !== null && s.aggMax !== null;
  const ms = members(db, project.id);
  const sig = db.ratings.filter(r => r.projectId === project.id).map(r => r.id + r.score).join();
  useEffect(() => { setPulse(true); const t = setTimeout(() => setPulse(false), 900); return () => clearTimeout(t); }, [sig]);

  return (
    <div className="stack lg">
      <div className="result-bar card">
        <div className="row between wrap gap">
          <div className={`live-badge ${pulse ? 'pulse' : ''} ${project.status === 'CLOSED' ? 'final' : ''}`}>
            {project.status === 'OPEN' ? <><span className="live-dot" />실시간 반영 중</> : <><Icon name="flag" size={14} />최종 결과</>}
          </div>
          <label className="switch"><input type="checkbox" checked={decimals} onChange={e => setDecimals(e.target.checked)} /><span />평균 소수점 {decimals ? '넷째 자리까지' : '정수로 반올림'}</label>
        </div>
        <div className="segmented full">
          <button className={view === 'topic' ? 'on' : ''} onClick={() => setView('topic')}><Icon name="list" size={15} />발표별 집계</button>
          <button className={view === 'matrix' ? 'on' : ''} onClick={() => setView('matrix')}><Icon name="grid" size={15} />누가 누구에게 몇 점</button>
        </div>
        <div className="rule-row small">
          <span><Icon name="star" size={13} />점수 범위 <b>{s.min}~{s.max}</b></span>
          <span><Icon name="sliders" size={13} />집계 기준 {hasAgg ? <b>{s.aggMin}~{s.aggMax}</b> : '없음'}</span>
        </div>
      </div>

      {rows.length === 0 && <Empty icon="chart">아직 발표가 없어요.</Empty>}

      {view === 'topic' && rows.length > 0 && (
        <div className="table-wrap">
          <table className="tbl board-tbl results">
            <thead>
              <tr>
                <th rowSpan={hasAgg ? 2 : 1} className="c-no">No</th>
                <th rowSpan={hasAgg ? 2 : 1} className="left">발표 제목</th>
                <th colSpan={3} className="grp">전체 점수</th>
                {hasAgg && <th colSpan={3} className="grp agg">집계 기준 {s.aggMin}~{s.aggMax}점</th>}
                <th rowSpan={hasAgg ? 2 : 1}>평가 안 함</th>
                <th rowSpan={hasAgg ? 2 : 1}>평가 불가</th>
                <th rowSpan={hasAgg ? 2 : 1} />
              </tr>
              {hasAgg && (
                <tr><th>인원</th><th>합계</th><th>평균</th><th className="agg">인원</th><th className="agg">합계</th><th className="agg">평균</th></tr>
              )}
            </thead>
            <tbody>
              {rows.map(r => {
                const open = openId === r.pres.id;
                const scored = r.cells.filter((c): c is Extract<Cell, { kind: 'SCORE' }> => c.kind === 'SCORE');
                const notRated = r.cells.filter(c => c.kind === 'NOT_RATED');
                const blocked = r.cells.filter((c): c is Extract<Cell, { kind: 'BLOCKED' }> => c.kind === 'BLOCKED');
                const span = hasAgg ? 11 : 8;
                return (
                  <Fragment key={r.pres.id}>
                    <tr className={`click ${open ? 'open' : ''}`} onClick={() => setOpenId(open ? null : r.pres.id)}>
                      <td className="c-no">{r.pres.order}</td>
                      <td className="left">
                        <b>{r.pres.title}</b>
                        <div className="muted small">{crewSummary(db, r.pres)}{r.pres.status === 'SCHEDULED' && ' · 발표 전'}</div>
                      </td>
                      {!hasAgg ? <>
                        <td>{r.count}명</td><td>{r.sum}</td><td className="key">{formatAvg(r.avg, decimals)}</td>
                      </> : <>
                        <td>{r.count}</td><td>{r.sum}</td><td className="key">{formatAvg(r.avg, decimals)}</td>
                        <td className="agg">{r.inCount}</td><td className="agg">{r.inSum}</td><td className="key agg">{formatAvg(r.inAvg, decimals)}</td>
                      </>}
                      <td className={notRated.length ? 'red' : 'muted'}>{notRated.length}</td>
                      <td className="muted">{blocked.length}</td>
                      <td><Icon name={open ? 'up' : 'down'} size={16} /></td>
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={span}>
                          <div className="detail-title">평가자별 점수</div>
                          <table className="tbl inner">
                            <thead><tr><th className="left">평가자</th><th>점수</th><th className="left">제출 · 수정 이력</th></tr></thead>
                            <tbody>
                              {scored.sort((a, b) => b.rating.score - a.rating.score).map(c => (
                                <tr key={c.userId}>
                                  <td className="left">{userName(db, c.userId)} <span className="muted small">{teamName(db, membership(db, project.id, c.userId)?.teamIdAtJoin ?? null)}</span></td>
                                  <td>
                                    <b className={c.inRange === false ? 'out' : ''}>{c.rating.score}</b>
                                    {c.inRange === false && <> <Chip tone="amber">기준 밖</Chip></>}
                                    {c.outOfInput && <> <Chip tone="red">현재 범위 밖</Chip></>}
                                  </td>
                                  <td className="left small">
                                    {timeText(c.rating.submittedAt)} 제출
                                    {c.history.map(h => <span key={h.id} className="muted"> · <Icon name="history" size={12} /> {h.before}→{h.after} ({timeText(h.at)})</span>)}
                                  </td>
                                </tr>
                              ))}
                              {notRated.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={2} className="left"><Chip tone="amber">평가 안 함</Chip></td></tr>)}
                              {blocked.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={2} className="left"><Chip icon="lock">평가 불가 · {c.reason === 'SELF' ? '본인 참여 발표' : '같은 팀'}</Chip></td></tr>)}
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
      {view === 'topic' && rows.length > 0 && <p className="hint">행을 누르면 평가자별 점수와 수정 이력을 볼 수 있어요. 평균은 평가 안 함을 제외하고 계산해요.</p>}

      {view === 'matrix' && rows.length > 0 && (
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>가로는 발표, 세로는 평가자예요. 각 칸은 그 평가자가 준 점수예요.</p>
          <div className="matrix-wrap">
            <table className="tbl matrix">
              <thead>
                <tr><th className="sticky">평가자</th>{rows.map(r => <th key={r.pres.id} title={r.pres.title}><span className="order-no sm">{r.pres.order}</span><div className="th-title">{r.pres.title}</div></th>)}</tr>
              </thead>
              <tbody>
                {ms.map(m => (
                  <tr key={m.userId}>
                    <td className="sticky">{userName(db, m.userId)}<div className="muted small">{teamName(db, m.teamIdAtJoin)}</div></td>
                    {rows.map(r => <td key={r.pres.id}><CellView c={r.cells.find(c => c.userId === m.userId)!} /></td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="sticky">합계</td>{rows.map(r => <td key={r.pres.id}>{r.sum}</td>)}</tr>
                <tr className="key"><td className="sticky">평균</td>{rows.map(r => <td key={r.pres.id}>{formatAvg(r.avg, decimals)}</td>)}</tr>
                {hasAgg && <tr><td className="sticky">기준 내 합계</td>{rows.map(r => <td key={r.pres.id}>{r.inSum}</td>)}</tr>}
                {hasAgg && <tr className="key agg"><td className="sticky">기준 내 평균</td>{rows.map(r => <td key={r.pres.id}>{formatAvg(r.inAvg, decimals)}</td>)}</tr>}
              </tfoot>
            </table>
          </div>
          <div className="legend small">
            <span><span className="cell score">72</span> 제출한 점수</span>
            {hasAgg && <span><span className="cell score out">90</span> 집계 기준 밖</span>}
            <span><span className="cell score">81<sup>✎</sup></span> 수정됨</span>
            <span><span className="cell not-rated">안 함</span> 평가 안 함</span>
            <span><span className="cell blocked"><Icon name="lock" size={12} /></span> 본인·같은 팀</span>
            <span><span className="cell pending">대기</span> 발표 전</span>
          </div>
        </div>
      )}
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
                        제출한 평가 {impact.ratings}건 삭제
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
function Toggle({ checked, disabled, onChange, title, desc }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label className="toggle-row">
      <div className="grow"><div className="toggle-title">{title}</div><div className="hint">{desc}</div></div>
      <span className="switch"><input type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
    </label>
  );
}

function SettingsTab({ project }: { project: Project }) {
  const { db, me } = useMe();
  const s = project.settings;
  const [f, setF] = useState({
    min: String(s.min), max: String(s.max), aggOn: s.aggMin !== null,
    aggMin: String(s.aggMin ?? s.min), aggMax: String(s.aggMax ?? s.max), allowSameTeam: s.allowSameTeam, allowEdit: s.allowEdit,
  });
  const open = project.status === 'OPEN';
  const next: Settings = {
    min: Number(f.min), max: Number(f.max), aggMin: f.aggOn ? Number(f.aggMin) : null, aggMax: f.aggOn ? Number(f.aggMax) : null,
    allowSameTeam: f.allowSameTeam, allowEdit: f.allowEdit,
  };
  const blank = [f.min, f.max, ...(f.aggOn ? [f.aggMin, f.aggMax] : [])].some(v => v.trim() === '');
  const err = blank ? '빈 값이 있습니다.' : validateSettings(next);
  const dirty = JSON.stringify(next) !== JSON.stringify(s);
  const outside = db.ratings.filter(r => r.projectId === project.id && (r.score < next.min || r.score > next.max)).length;
  const num = (k: 'min' | 'max' | 'aggMin' | 'aggMax', label: string) => (
    <label className="num-field"><span>{label}</span>
      <input type="number" inputMode="numeric" step={1} disabled={!open || ((k === 'aggMin' || k === 'aggMax') && !f.aggOn)} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack lg">
      <section className="card stack">
        <SectionTitle icon="star" title="점수 입력 범위" desc="참여자가 줄 수 있는 점수예요. 정수만 쓸 수 있어요." />
        <div className="range-row">{num('min', '최소')}<span className="tilde">~</span>{num('max', '최대')}<span className="unit">점</span></div>
      </section>

      <section className="card stack">
        <SectionTitle icon="sliders" title="집계 기준 범위" desc="이 범위 밖의 점수는 '기준 내' 합계·평균에서 빼요. 원래 점수 기록은 지워지지 않아요."
          right={<span className="switch"><input type="checkbox" disabled={!open} checked={f.aggOn} onChange={e => setF({ ...f, aggOn: e.target.checked })} aria-label="집계 기준 사용" /><span /></span>} />
        {f.aggOn ? (
          <>
            <div className="range-row">{num('aggMin', '최저치')}<span className="tilde">~</span>{num('aggMax', '최대치')}<span className="unit">점</span></div>
            <p className="hint" style={{ marginTop: -4 }}>최저치·최대치와 같은 점수도 포함돼요.</p>
            <div className="example small">
              <b>예시</b> 받은 점수 22, 24, 31, 45, 50, 81, 90 · 기준 30~80 → 31, 45, 50만 포함 → 기준 내 합계 126, 평균 42
            </div>
          </>
        ) : <p className="muted small">사용 안 함 · 결과에는 전체 점수 기준 지표만 표시돼요.</p>}
      </section>

      <section className="card stack">
        <SectionTitle icon="users" title="평가 규칙" />
        <Toggle disabled={!open} checked={f.allowSameTeam} onChange={v => setF({ ...f, allowSameTeam: v })}
          title="같은 팀 발표도 평가 허용" desc="끄면 발표자 중 한 명이라도 같은 팀인 발표는 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowEdit} onChange={v => setF({ ...f, allowEdit: v })}
          title="제출한 점수 수정 허용" desc="켜면 참여자가 평가 마감 전까지 자기 점수를 고칠 수 있어요." />
        <div className="notice info small"><Icon name="info" size={15} />본인 발표는 설정과 관계없이 항상 평가할 수 없어요.</div>
      </section>

      {open && (
        <div className="save-bar">
          {err ? <div className="error"><Icon name="ban" size={15} />{err}</div>
            : outside > 0 && <div className="notice small"><Icon name="info" size={15} />기존 점수 {outside}건이 새 범위를 벗어나요. 지워지지 않고 집계에 남으며, 새 범위는 이후 입력·수정부터 적용돼요.</div>}
          <button className="btn primary solid block" disabled={!!err || !dirty} onClick={() => run(() => updateSettings(me!.id, project.id, next), '설정을 저장했습니다.')}>
            <IconText icon="check">{dirty ? '변경 사항 저장' : '저장됨'}</IconText>
          </button>
        </div>
      )}

      {open && (
        <section className="card danger-zone stack">
          <SectionTitle icon="flag" tone="red" title="평가 마감" desc="점수 제출·수정과 설정 변경이 모두 막히고, 다시 열 수 없어요. 결과와 기록은 계속 볼 수 있어요." />
          <ConfirmButton label="평가 마감하기" confirmLabel="마감합니다" detail="마감 후에는 되돌릴 수 없습니다." onConfirm={() => run(() => closeProject(me!.id, project.id), '평가를 마감했습니다.')} />
        </section>
      )}
    </div>
  );
}
