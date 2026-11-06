// 결과 표. 한 줄 = 발표 구성원 한 명 (이름 아래 발표 제목).
// - 룸 관리자(detail): 평가자별 점수·피드백·합계와 평가자별 점수표까지
// - 전체 열람 권한자: 인원·평균·순위만 (누가 몇 점을 줬는지와 피드백은 서버가 보내지 않는다)
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../shared/icons/Icon';
import { formatAvg, roundAvg, timeText } from '../../../shared/lib/format';
import { Chip, Empty, IconText, Popup, run } from '../../../shared/ui';
import { teamName, teamPath, teamRank, userName, userOf } from '../../organization';
import { PresInfo, presTypeText, type Presentation } from '../../presentations';
import { members, membership, type Project } from '../../projects';
import { blockShort } from '../../ratings';
import { refresh, useSession } from '../../session';
import { computeResults, rankBy, type Cell, type ResultRow } from '../model/computeResults';
import { aggChanged, AggRangePanel, draftOf, previewSettings, type AggDraft } from './AggRangePanel';
import { ResultSharePopup } from './ResultSharePopup';

type ScoreCell = Extract<Cell, { kind: 'SCORE' }>;
type SortKey = 'team' | 'order' | 'avg' | 'inAvg';
const rankText = (n: number | undefined) => n === undefined ? '—' : `${n}위`;

function CellView({ c, onOpenFeedback }: { c: Cell; onOpenFeedback: (c: ScoreCell) => void }) {
  if (c.kind === 'SCORE') {
    // 집계에서 뺀 점수는 취소선으로 흐리게 (점수 자체는 남아 있다)
    const cls = `ss-score ${c.inRange === false ? 'ss-out' : ''} ${c.counted ? '' : 'ss-excluded'}`;
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

/** 사람 이름 + 발표 제목 (누르면 발표 정보). 대표·발표자·팀원 같은 역할은 결과 표에 보이지 않는다 */
function PersonCell({ r, onOpenPres }: { r: ResultRow; compact?: boolean; onOpenPres: (p: Presentation) => void }) {
  const { db } = useSession();
  return (
    <>
      <b>{userName(db, r.targetId)}</b>
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
function FeedbackPopup({ project, cell, row, onClose }: { project: Project; cell: ScoreCell; row: ResultRow; onClose: () => void }) {
  const { db } = useSession();
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

export function ResultBoard({ project, detail = true }: { project: Project; detail?: boolean }) {
  const { db, loadedAt } = useSession();
  const [decimals, setDecimals] = useState(true);
  // 보기(구성원별 집계/평가자별 점수표)와 정렬은 주소에 남겨서 새로 고침해도 유지한다
  const [sp, setSp] = useSearchParams();
  const view: 'topic' | 'matrix' = detail && sp.get('view') === 'sheet' ? 'matrix' : 'topic';
  const sortParam = sp.get('sort');
  // 기본은 팀별 순서. 다른 정렬은 주소(?sort=)에 남는다
  const sortBy: SortKey = sortParam === 'avg' || sortParam === 'inAvg' || sortParam === 'order' ? sortParam : 'team';
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp);
    if (value === null) next.delete(key); else next.set(key, value);
    setSp(next, { replace: true });
  };
  const setView = (v: 'topic' | 'matrix') => setParam('view', v === 'matrix' ? 'sheet' : null);
  const setSortBy = (k: SortKey) => setParam('sort', k === 'team' ? null : k);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [popupPres, setPopupPres] = useState<Presentation | null>(null);
  const [sharing, setSharing] = useState(false);
  const [popupFeedback, setPopupFeedback] = useState<{ cell: ScoreCell; row: ResultRow } | null>(null);
  // 평가자별 점수표에서 누른 칸: 그 칸은 진하게, 같은 줄(평가자)·같은 열(발표자)은 연하게 표시한다
  const [sel, setSel] = useState<{ rater: string; col: string } | null>(null);
  // 구성원별 집계에서 누른 칸 (같은 방식). 상세 펼치기와는 따로 움직인다
  const [tsel, setTsel] = useState<{ row: string; col: string } | null>(null);
  const tcell = (rowKey: string, col: string, cls = '') => ({
    className: `${cls} ${tsel?.col === col ? 'x-col' : ''} ${tsel?.row === rowKey && tsel.col === col ? 'x-cell' : ''}`,
    onClick: () => setTsel(tsel?.row === rowKey && tsel.col === col ? null : { row: rowKey, col }),
  });
  const thc = (col: string, cls = '') => `${cls} ${tsel?.col === col ? 'x-col' : ''}`;
  // 집계 기준 범위 미리보기 (룸 관리자). null이면 저장된 기준을 따른다
  const [aggDraft, setAggDraft] = useState<AggDraft | null>(null);
  const preview = detail && aggDraft ? previewSettings(project, aggDraft).settings : project.settings;
  const previewing = aggChanged(preview, project.settings);
  const s = preview;
  const hasAgg = s.aggMin !== null && s.aggMax !== null;
  // 인원·평균·순위는 서버 집계(summaries)를 쓴다. 합계와 평가자별 점수(detail)는 룸 관리자에게만 보이는 점수로 계산한다.
  // 집계 기준을 미리보기 중이면 룸 관리자가 가진 점수로 기준 안 평균을 바로 다시 계산한다 (저장하면 서버 집계와 같아진다)
  const base = computeResults(db, previewing ? { ...project, settings: preview } : project);
  const summaryOf = (r: ResultRow) => db.summaries.find(x => x.presentationId === r.pres.id && x.targetId === r.targetId);
  const inAvgOf = (r: ResultRow) => (previewing ? r.inAvg : summaryOf(r)?.inAvg ?? null);
  // 미리보기 중이면 룸 관리자가 가진 점수로 전체 평균도 다시 계산한다 (점수 포함·미포함이 바뀌면 전체 평균도 바뀐다)
  const avgOf = (r: ResultRow) => (previewing ? r.avg : summaryOf(r)?.avg ?? null);
  // 순위는 화면에 보이는 평균(소수점 넷째 자리 / 정수 반올림 설정)으로 매긴다. 보이는 값이 같으면 같은 순위
  const rank = rankBy(base, r => roundAvg(avgOf(r), decimals));
  const inRank = rankBy(base, r => roundAvg(inAvgOf(r), decimals));
  const sortKey: SortKey = sortBy === 'inAvg' && !hasAgg ? 'team' : sortBy;
  // 팀별 순서: 발표자의 참여 당시 팀(팀 구조도 위 → 아래), 같은 팀은 조직도 순서(위 = 높은 사람), 그다음 발표 순서. 소속 없음은 맨 뒤
  const teamOf = (r: ResultRow) => membership(db, project.id, r.targetId)?.teamIdAtJoin ?? null;
  const tRank = teamRank(db);
  const teamRankOf = (r: ResultRow) => { const t = teamOf(r); return t !== null && tRank.has(t) ? tRank.get(t)! : Number.MAX_SAFE_INTEGER; };
  const userRankOf = (r: ResultRow) => userOf(db, r.targetId)?.rank ?? Number.MAX_SAFE_INTEGER;
  const rows = sortKey === 'order' ? base : [...base].sort((a, b) => {
    if (sortKey === 'team') return teamRankOf(a) - teamRankOf(b) || (teamOf(a) ?? '').localeCompare(teamOf(b) ?? '')
      || userRankOf(a) - userRankOf(b) || a.pres.order - b.pres.order;
    const ra = (sortKey === 'avg' ? rank : inRank).get(a.key) ?? Infinity;
    const rb = (sortKey === 'avg' ? rank : inRank).get(b.key) ?? Infinity;
    return ra - rb || a.pres.order - b.pres.order;
  });
  // 표 묶음: 팀별 순서면 팀마다, 아니면 하나
  const groups: { key: string; team: { name: string; path: string } | null; rows: ResultRow[] }[] = [];
  for (const r of rows) {
    const key = sortKey === 'team' ? teamOf(r) ?? 'none' : 'all';
    const last = groups[groups.length - 1];
    if (last && last.key === key) { last.rows.push(r); continue; }
    const t = teamOf(r);
    const m = membership(db, project.id, r.targetId);
    groups.push({
      key, rows: [r],
      team: sortKey === 'team' ? { name: m?.teamNameAtJoin ?? teamName(db, t), path: t ? teamPath(db.teams, t) : '' } : null,
    });
  }
  // 지금 보이는 순서대로 1, 2, 3 … (팀별 순서여도 팀을 넘어 이어서 센다)
  const noOf = new Map(rows.map((r, i) => [r.key, i + 1]));
  // 평가자별 점수표: 팀별 순서면 팀이 시작되는 발표자 열에 구분선을 넣는다
  const teamStart = new Set(sortKey === 'team' ? groups.map(g => g.rows[0].key) : []);
  const colCls = (key: string) => `${teamStart.has(key) ? 'edge-l' : ''} ${sel?.col === key ? 'x-col' : ''}`;
  const colCount = 1 + 1 + 5 + (detail ? 3 : 2) + (hasAgg ? (detail ? 3 : 2) : 0) + (detail ? 1 : 0);
  // 평가자는 팀 구조도 순 (팀 위 → 아래, 같은 팀은 조직도 순서)
  const raterTeamRank = (t: string | null) => (t !== null && tRank.has(t) ? tRank.get(t)! : Number.MAX_SAFE_INTEGER);
  const raters = members(db, project.id).filter(m => project.settings.allowAdminRating || !m.isAdmin).sort((a, b) => raterTeamRank(a.teamIdAtJoin) - raterTeamRank(b.teamIdAtJoin)
    || (a.teamIdAtJoin ?? '').localeCompare(b.teamIdAtJoin ?? '')
    || (userOf(db, a.userId)?.rank ?? Number.MAX_SAFE_INTEGER) - (userOf(db, b.userId)?.rank ?? Number.MAX_SAFE_INTEGER)
    || userName(db, a.userId).localeCompare(userName(db, b.userId)));

  return (
    <div className="stack lg">
      <div className="result-bar card">
        <div className="row between wrap gap">
          {project.status === 'OPEN'
            ? <div className="row gap">
                <span className="result-badge"><Icon name="clock" size={14} />{timeText(loadedAt)} 기준 중간 결과</span>
                <button className="btn sm" onClick={() => run(refresh)}><IconText icon="refresh">새로 고침</IconText></button>
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
          {!detail && <span><Icon name="sliders" size={13} />집계 기준 {hasAgg ? <b>{s.aggMin}~{s.aggMax}</b> : '없음'}</span>}
        </div>
        {detail && <AggRangePanel project={project} draft={aggDraft ?? draftOf(project)} onChange={setAggDraft} onReset={() => setAggDraft(null)} />}
      </div>

      {rows.length === 0 && <Empty icon="chart">아직 발표가 없어요.</Empty>}

      {rows.length > 0 && (
        <div className="row gap wrap sort-bar">
          <span className="muted small">정렬</span>
          <div className="segmented">
            <button className={sortKey === 'team' ? 'on' : ''} onClick={() => setSortBy('team')}>팀별 순서</button>
            <button className={sortKey === 'order' ? 'on' : ''} onClick={() => setSortBy('order')}>발표 순서</button>
            <button className={sortKey === 'avg' ? 'on' : ''} onClick={() => setSortBy('avg')}>전체 점수 순위</button>
            {hasAgg && <button className={sortKey === 'inAvg' ? 'on' : ''} onClick={() => setSortBy('inAvg')}>집계 기준 순위</button>}
          </div>
          {detail && view === 'topic' && <button className="btn sm share-btn" onClick={() => setSharing(true)}><IconText icon="share">결과 공유</IconText></button>}
        </div>
      )}

      {view === 'topic' && rows.length > 0 && (
        <div className="table-wrap">
          <table className={`tbl board-tbl results sort-${sortKey}`}>
            <thead>
              <tr>
                <th rowSpan={2} className={thc('no', 'c-rno')}>No</th>
                <th rowSpan={2} className={thc('pres', 'left')}>발표자 · 발표</th>
                <th colSpan={5} className="grp edge-l">인원</th>
                <th colSpan={detail ? 3 : 2} className="grp col-avg edge-l edge-r">전체 점수</th>
                {hasAgg && <th colSpan={detail ? 3 : 2} className="grp agg edge-l edge-r">집계 기준 {s.aggMin}~{s.aggMax}점</th>}
                {detail && <th rowSpan={2} />}
              </tr>
              <tr>
                <th className={thc('total', 'edge-l')} title="이 평가룸의 전체 참여자">참여</th>
                <th className={thc('blocked')} title="본인·같은 발표 팀원·같은 회사 팀이라 평가할 수 없는 인원">평가 불가</th>
                <th className={thc('eligible')} title="참여 - 평가 불가">평가 가능</th>
                <th className={thc('scored')} title="점수를 제출한 인원">평가함</th>
                <th className={thc('notRated')} title="평가할 수 있는데 아직 점수를 주지 않은 인원">미평가</th>
                {detail && <th className={thc('sum', 'col-avg edge-l')}>합계</th>}<th className={thc('avg', `col-avg ${detail ? '' : 'edge-l'}`)}>평균</th><th className={thc('rank', 'col-avg edge-r')} title="전체 평균이 높은 순">순위</th>
                {hasAgg && <>{detail && <th className={thc('inSum', 'agg edge-l')}>합계</th>}<th className={thc('inAvg', `agg ${detail ? '' : 'edge-l'}`)}>평균</th><th className={thc('inRank', 'agg edge-r')} title="집계 기준 평균이 높은 순">순위</th></>}
              </tr>
            </thead>
            {/* 팀별 순서면 팀마다 tbody로 묶어 테두리를 두르고 팀 이름 줄을 넣는다 */}
            {groups.map(g => (
            <tbody key={g.key} className={g.team ? 'team-group' : undefined}>
              {g.team && (
                <tr className="team-row">
                  <td colSpan={colCount}>
                    <div className="team-head">
                      <Icon name="building" size={14} />
                      <b>{g.team.name}</b>
                      {g.team.path && <span className="team-path">{g.team.path}</span>}
                      <span className="team-count">발표자 {g.rows.length}명</span>
                    </div>
                  </td>
                </tr>
              )}
              {g.rows.map(r => {
                const open = detail && openKey === r.key;
                const scored = r.cells.filter((c): c is ScoreCell => c.kind === 'SCORE');
                const notRated = r.cells.filter(c => c.kind === 'NOT_RATED');
                const blocked = r.cells.filter((c): c is Extract<Cell, { kind: 'BLOCKED' }> => c.kind === 'BLOCKED');
                const span = colCount;
                const sm = summaryOf(r);
                return (
                  <Fragment key={r.key}>
                    {/* 칸을 누르면 그 칸·줄·열을 표시하고, 상세(평가자별 점수·피드백)는 맨 오른쪽 펼치기 버튼으로만 연다 */}
                    <tr className={`${open ? 'open' : ''} ${tsel?.row === r.key ? 'x-row' : ''}`}>
                      <td {...tcell(r.key, 'no', 'c-rno')}>{noOf.get(r.key)}</td>
                      <td {...tcell(r.key, 'pres', 'left')}><PersonCell r={r} onOpenPres={setPopupPres} /></td>
                      <td {...tcell(r.key, 'total', 'edge-l')}>{sm?.total ?? 0}</td>
                      <td {...tcell(r.key, 'blocked', 'muted')}>{sm?.blocked ?? 0}</td>
                      <td {...tcell(r.key, 'eligible')}>{sm?.eligible ?? 0}</td>
                      <td {...tcell(r.key, 'scored')}>{sm?.scored ?? 0}</td>
                      <td {...tcell(r.key, 'notRated', sm?.notRated ? 'red' : 'muted')}>{sm?.notRated ?? 0}</td>
                      {detail && <td {...tcell(r.key, 'sum', 'col-avg edge-l')}>{r.sum}</td>}<td {...tcell(r.key, 'avg', `key col-avg ${detail ? '' : 'edge-l'}`)}>{formatAvg(avgOf(r), decimals)}</td>
                      <td {...tcell(r.key, 'rank', `rank col-avg edge-r ${sortKey === 'avg' ? 'on' : ''}`)}>{rankText(rank.get(r.key))}</td>
                      {hasAgg && <>
                        {detail && <td {...tcell(r.key, 'inSum', 'agg edge-l')}>{r.inSum}</td>}<td {...tcell(r.key, 'inAvg', `key agg ${detail ? '' : 'edge-l'}`)}>{formatAvg(inAvgOf(r), decimals)}</td>
                        <td {...tcell(r.key, 'inRank', `rank agg edge-r ${sortKey === 'inAvg' ? 'on' : ''}`)}>{rankText(inRank.get(r.key))}</td>
                      </>}
                      {detail && (
                        <td className="c-expand">
                          <button type="button" className="expand-btn" aria-expanded={open} title={open ? '상세 닫기' : '평가자별 점수·피드백 보기'}
                            onClick={() => setOpenKey(open ? null : r.key)}>
                            <Icon name={open ? 'up' : 'down'} size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr className="detail-row">
                        <td colSpan={span}>
                          <div className="detail-inner">
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
                                    {!c.counted && <> <Chip>집계 제외</Chip></>}
                                  </td>
                                  <td className="left feedback-cell">{c.rating.feedback ?? <span className="muted">-</span>}</td>
                                  <td className="left small">{timeText(c.rating.submittedAt)}</td>
                                </tr>
                              ))}
                              {notRated.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={3} className="left"><Chip tone="amber">평가 안 함</Chip></td></tr>)}
                              {blocked.map(c => <tr key={c.userId} className="dim"><td className="left">{userName(db, c.userId)}</td><td colSpan={3} className="left"><Chip icon="lock">평가 불가 · {blockShort[c.reason]}</Chip></td></tr>)}
                            </tbody>
                          </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            ))}
          </table>
        </div>
      )}

      {detail && view === 'matrix' && rows.length > 0 && <>
        <div className="table-wrap">
          <table className={`tbl board-tbl score-sheet sort-${sortKey}`}>
            <thead>
              {/* 팀별 순서면 발표자 열을 팀마다 묶는다 (구성원별 집계의 팀 묶음과 같은 순서) */}
              {sortKey === 'team' && (
                <tr>
                  <th rowSpan={2} className="c-rno">No</th>
                  <th rowSpan={2} className="left sticky">평가자</th>
                  {groups.map(g => <th key={g.key} colSpan={g.rows.length} className="grp edge-l" title={g.team?.path}>{g.team?.name}</th>)}
                </tr>
              )}
              <tr>
                {sortKey !== 'team' && <><th className="c-rno">No</th><th className="left sticky">평가자</th></>}
                {rows.map(r => (
                  <th key={r.key} className={`ss-person ${colCls(r.key)}`} title={`${userName(db, r.targetId)} · ${r.pres.title}`}>
                    <span className="ss-no">{noOf.get(r.key)}</span>
                    <PersonCell r={r} compact onOpenPres={setPopupPres} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raters.map((m, i) => (
                <tr key={m.userId} className={`${i > 0 && raters[i - 1].teamIdAtJoin !== m.teamIdAtJoin ? 'team-start' : ''} ${sel?.rater === m.userId ? 'x-row' : ''}`}>
                  <td className="c-rno">{i + 1}</td>
                  <td className="left sticky"><b>{userName(db, m.userId)}</b> <span className="muted small">{m.teamNameAtJoin ?? teamName(db, m.teamIdAtJoin)}</span></td>
                  {rows.map(r => (
                    <td key={r.key} className={`${colCls(r.key)} ${sel?.rater === m.userId && sel.col === r.key ? 'x-cell' : ''}`}
                      onClick={() => setSel(sel?.rater === m.userId && sel.col === r.key ? null : { rater: m.userId, col: r.key })}>
                      <CellView c={r.cells.find(c => c.userId === m.userId)!} onOpenFeedback={cell => setPopupFeedback({ cell, row: r })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {/* 집계: 전체 점수(연한 파랑)와 집계 기준(연보라). 고른 정렬의 평균·순위 줄을 강조한다 */}
            <tfoot>
              <tr className="sum-start"><td className="c-rno col-avg" /><td className="left sticky col-avg">합계</td>{rows.map(r => <td key={r.key} className={`col-avg ${colCls(r.key)}`}>{r.sum}</td>)}</tr>
              <tr className={sortKey === 'avg' ? 'hl' : undefined}><td className="c-rno col-avg" /><td className="left sticky col-avg">평균</td>{rows.map(r => <td key={r.key} className={`key col-avg ${colCls(r.key)}`}>{formatAvg(avgOf(r), decimals)}</td>)}</tr>
              <tr className={sortKey === 'avg' ? 'hl' : undefined}><td className="c-rno col-avg" /><td className="left sticky col-avg">순위</td>{rows.map(r => <td key={r.key} className={`rank col-avg ${colCls(r.key)}`}>{rankText(rank.get(r.key))}</td>)}</tr>
              {hasAgg && <>
                <tr className="agg-start"><td className="c-rno agg" /><td className="left sticky agg">기준 내 합계</td>{rows.map(r => <td key={r.key} className={`agg ${colCls(r.key)}`}>{r.inSum}</td>)}</tr>
                <tr className={sortKey === 'inAvg' ? 'hl' : undefined}><td className="c-rno agg" /><td className="left sticky agg">기준 내 평균</td>{rows.map(r => <td key={r.key} className={`key agg ${colCls(r.key)}`}>{formatAvg(inAvgOf(r), decimals)}</td>)}</tr>
                <tr className={sortKey === 'inAvg' ? 'hl' : undefined}><td className="c-rno agg" /><td className="left sticky agg">기준 내 순위</td>{rows.map(r => <td key={r.key} className={`rank agg ${colCls(r.key)}`}>{rankText(inRank.get(r.key))}</td>)}</tr>
              </>}
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
      {sharing && <ResultSharePopup db={db} project={previewing ? { ...project, settings: preview } : project} rows={base} decimals={decimals} onClose={() => setSharing(false)}
        avgOf={avgOf} inAvgOf={inAvgOf} />}
      {popupFeedback && <FeedbackPopup project={project} cell={popupFeedback.cell} row={popupFeedback.row} onClose={() => setPopupFeedback(null)} />}
    </div>
  );
}
