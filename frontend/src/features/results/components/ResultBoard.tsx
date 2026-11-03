// 결과 표. 한 줄 = 발표 구성원 한 명 (이름 아래 발표 제목).
// - 룸 운영자(detail): 평가자별 점수·피드백·합계와 평가자별 점수표까지
// - 전체 열람 권한자: 인원·평균·순위만 (누가 몇 점을 줬는지와 피드백은 서버가 보내지 않는다)
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../shared/icons/Icon';
import { formatAvg, timeText } from '../../../shared/lib/format';
import { Chip, Empty, IconText, Popup, run } from '../../../shared/ui';
import { teamName, userName } from '../../organization';
import { PresInfo, presTypeText, roleClass, roleText, type Presentation } from '../../presentations';
import { members, membership, type Project } from '../../projects';
import { blockShort } from '../../ratings';
import { refresh, useSession } from '../../session';
import { computeResults, rankBy, type Cell, type ResultRow } from '../model/computeResults';
import { ResultSharePopup } from './ResultSharePopup';

type ScoreCell = Extract<Cell, { kind: 'SCORE' }>;
type SortKey = 'order' | 'avg' | 'inAvg';
const rankText = (n: number | undefined) => n === undefined ? '—' : `${n}위`;

function CellView({ c, onOpenFeedback }: { c: Cell; onOpenFeedback: (c: ScoreCell) => void }) {
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

/** 사람 이름 + 그 아래 발표 제목 (한 사람이 여러 발표를 할 수 있어서 발표 제목으로 구분한다) */
function PersonCell({ r, compact, onOpenPres }: { r: ResultRow; compact?: boolean; onOpenPres: (p: Presentation) => void }) {
  const { db } = useSession();
  return (
    <>
      <b>{userName(db, r.targetId)}</b>{!compact && <> <span className={`crew-label ${roleClass[r.role]}`}>{roleText[r.role]}</span></>}
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
  const [popupFeedback, setPopupFeedback] = useState<{ cell: ScoreCell; row: ResultRow } | null>(null);
  const s = project.settings;
  const hasAgg = s.aggMin !== null && s.aggMax !== null;
  // 인원·평균·순위는 서버 집계(summaries)를 쓴다. 합계와 평가자별 점수(detail)는 룸 운영자에게만 보이는 점수로 계산한다.
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
                const scored = r.cells.filter((c): c is ScoreCell => c.kind === 'SCORE');
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
                                  <td className="left small">{timeText(c.rating.submittedAt)}</td>
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
                  <td className="left sticky"><b>{userName(db, m.userId)}</b> <span className="muted small">{m.teamNameAtJoin ?? teamName(db, m.teamIdAtJoin)}</span></td>
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
