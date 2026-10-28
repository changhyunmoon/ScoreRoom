import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BoardHead, Pager, ProjectShell } from './ProjectShell';
import { canEditPresentation, completeCurrentPresentation, involvedIds, submitRating, type DB, type ID, type Presentation, type Project } from '../store';
import { Chip, Empty, IconText, run, toast, useMe } from '../ui';
import { Icon, type IconName } from '../icons';
import {
  blockReason, blockText, crewNames, crewSummary, membership, myStatus, presTypeText, presentationsOf, statusMeta, teamName, timeText, userName, type MyStatus,
} from '../logic';

/** 발표 구성원을 대표 · 발표자 · 팀원으로 나눠 보여준다 */
export function Presenters({ db, project, pres }: { db: DB; project: Project; pres: Presentation }) {
  const person = (id: ID) => (
    <span key={id} className="person">
      {userName(db, id)}
      <small> · {teamName(db, membership(db, project.id, id)?.teamIdAtJoin ?? null)}</small>
    </span>
  );
  const members = pres.memberIds ?? [];
  return (
    <div className="crew">
      <div className="crew-row"><span className="crew-label lead">대표</span>{person(pres.leaderId)}</div>
      {pres.presenterIds.length > 0 && <div className="crew-row"><span className="crew-label presenter">발표자</span>{pres.presenterIds.map(person)}</div>}
      {members.length > 0 && <div className="crew-row"><span className="crew-label member">팀원</span>{members.map(person)}</div>}
    </div>
  );
}

export function StatusBadge({ s }: { s: MyStatus }) {
  const m = statusMeta[s];
  return <Chip tone={m.tone} icon={m.icon}>{m.label}</Chip>;
}

function RatingWidget({ project, pres }: { project: Project; pres: Presentation }) {
  const { db, me } = useMe();
  const { min, max, allowEdit } = project.settings;
  const mine = db.ratings.find(r => r.presentationId === pres.id && r.raterId === me!.id);
  const [val, setVal] = useState<string>(mine ? String(mine.score) : '');
  const [editing, setEditing] = useState(!mine);
  useEffect(() => { setEditing(!mine); setVal(mine ? String(mine.score) : ''); }, [mine?.id, mine?.score]);

  const block = blockReason(db, project, pres, me!.id);
  const closed = project.status === 'CLOSED';

  if (mine && (!editing || closed || block)) {
    return (
      <div className="rate-box done">
        <Icon name="checkCircle" size={22} />
        <div className="grow">
          <div className="rate-label">내가 준 점수</div>
          <div><b className="score">{mine.score}</b><span className="muted"> / {max}점</span></div>
          <small className="muted">{timeText(mine.updatedAt)} {mine.updatedAt !== mine.submittedAt ? '수정' : '제출'}</small>
        </div>
        {!closed && !block && (allowEdit
          ? <button className="btn sm" onClick={() => setEditing(true)}><IconText icon="pencil">점수 수정</IconText></button>
          : <small className="muted lock-note"><Icon name="lock" size={13} /> 수정 불가</small>)}
      </div>
    );
  }
  if (block) {
    const scheduled = block === 'SCHEDULED';
    return (
      <div className={`rate-box ${scheduled ? 'wait' : 'blocked'}`}>
        <Icon name={scheduled ? 'clock' : 'lock'} size={20} />
        <div><div className="rate-label">{scheduled ? '아직 평가할 수 없어요' : '평가할 수 없는 발표예요'}</div><small>{scheduled ? '룸 운영자가 발표를 시작하면 점수를 줄 수 있어요.' : blockText[block]}</small></div>
      </div>
    );
  }
  if (closed) return <div className="rate-box blocked"><Icon name="ban" size={20} /><div><div className="rate-label">평가 안 함</div><small>평가가 마감되어 더 이상 제출할 수 없어요.</small></div></div>;

  const n = Number(val);
  const valid = val !== '' && Number.isInteger(n) && n >= min && n <= max;
  const submit = () => run(() => submitRating(me!.id, project.id, pres.id, n, d => {
    const b = blockReason(d, d.projects.find(p => p.id === project.id)!, d.presentations.find(p => p.id === pres.id)!, me!.id);
    return b ? blockText[b] : null;
  }), mine ? '점수를 수정했습니다.' : '점수를 제출했습니다.') && setEditing(false);

  return (
    <div className="rate-box form">
      <div className="rate-label"><Icon name="star" size={15} /> {mine ? '점수 수정하기' : '이 발표에 점수 주기'} <small className="muted">({min}~{max}점, 정수)</small></div>
      <div className="row gap">
        <input type="number" inputMode="numeric" min={min} max={max} step={1} placeholder="점수"
          className={`score-input ${val !== '' && !valid ? 'invalid' : ''}`} value={val} aria-label="점수"
          onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && valid && submit()} />
        <button className="btn primary solid grow" disabled={!valid} onClick={submit}><IconText icon="check">{mine ? '수정 저장' : '점수 제출'}</IconText></button>
        {mine && <button className="btn ghost" onClick={() => setEditing(false)}>취소</button>}
      </div>
      {val !== '' && !valid && <small className="err-text">{min}~{max} 사이의 정수를 입력해 주세요.</small>}
      {max - min <= 10 ? (
        <div className="score-pills">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(s => (
            <button key={s} className={`pill ${n === s && val !== '' ? 'on' : ''}`} onClick={() => setVal(String(s))}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="slider">
          <span>{min}</span>
          <input type="range" min={min} max={max} step={1} value={val === '' ? Math.round((min + max) / 2) : n} onChange={e => setVal(e.target.value)} aria-label="점수 슬라이더" />
          <span>{max}</span>
        </div>
      )}
      <small className="muted">{allowEdit ? '제출 후에도 평가 마감 전까지 수정할 수 있어요.' : '제출하면 수정할 수 없으니 신중하게 입력해 주세요.'}</small>
    </div>
  );
}

/** 회색 정보 행: 왼쪽 라벨, 오른쪽 값 */
function Rule({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: 'ok' | 'no' }) {
  return (
    <div className="rule">
      <span className="rule-label"><Icon name={icon} size={15} />{label}</span>
      <b className={`rule-value ${tone ?? ''}`}>{value}</b>
    </div>
  );
}

const FILTERS: Record<string, { title: string; desc: string }> = {
  all: { title: '전체 발표', desc: '발표를 누르면 내용을 보고 바로 점수를 줄 수 있어요.' },
  todo: { title: '평가 필요', desc: '시작된 발표 중 아직 점수를 주지 않은 발표예요. 평가 마감 전까지 평가할 수 있어요.' },
  done: { title: '평가 완료', desc: '내가 점수를 준 발표예요. 다른 사람의 점수는 볼 수 없어요.' },
  blocked: { title: '평가 불가', desc: '내가 대표·발표자·팀원인 발표이거나 같은 팀 발표라서 점수를 줄 수 없어요.' },
  scheduled: { title: '발표 전', desc: '룸 운영자가 발표를 시작하면 평가할 수 있어요.' },
  mine: { title: '내가 참여한 발표', desc: '대표·발표자·팀원으로 참여한 발표예요. 대표는 제목·소개·구성원을 직접 관리해요. 받은 점수는 룸 운영자만 볼 수 있어요.' },
};
const PAGE_SIZE = 10;

/** 발표 한 줄. 누르면 아래로 펼쳐져 내용과 점수 입력이 보인다 */
function PresRow({ project, pres, open, onToggle }: { project: Project; pres: Presentation; open: boolean; onToggle: () => void }) {
  const { db, me } = useMe();
  const m = membership(db, project.id, me!.id);
  const s = myStatus(db, project, pres, me!.id);
  const mine = db.ratings.find(r => r.presentationId === pres.id && r.raterId === me!.id);
  const live = project.currentPresentationId === pres.id;
  const canEdit = project.status === 'OPEN' && canEditPresentation(pres, me!.id, !!m?.isAdmin);
  const names = crewSummary(db, pres);
  return (
    <div className={`brow-wrap ${open ? 'open' : ''} ${live ? 'live' : ''}`}>
      <button className={`brow ${s === 'TODO' ? 'unread' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="c-no">{pres.order}</span>
        <span className="c-title">
          <span className="t">{live && <span className="live-tag"><span className="live-dot" />발표 중</span>}{pres.title}</span>
          <span className="t-sub">{presTypeText[pres.type]} · {names}</span>
        </span>
        <span className="c-type">{presTypeText[pres.type]}</span>
        <span className="c-who ellipsis" title={names}>{names}</span>
        <span className="c-status"><StatusBadge s={s} /></span>
        <span className="c-score">{mine ? <b>{mine.score}</b> : <span className="muted">-</span>}</span>
        <span className="c-chev"><Icon name={open ? 'up' : 'down'} size={16} /></span>
      </button>
      {open && (
        <div className="brow-detail">
          <div className="row between top gap">
            <div className="grow stack sm">
              {pres.intro && <p className="intro">{pres.intro}</p>}
              <Presenters db={db} project={project} pres={pres} />
              {involvedIds(pres).includes(me!.id) && (
                <div className="my-role small">
                  <Icon name="user" size={14} />내 역할:
                  {pres.leaderId === me!.id ? <span className="crew-label lead">대표</span>
                    : pres.presenterIds.includes(me!.id) ? <span className="crew-label presenter">발표자</span>
                    : <span className="crew-label member">팀원</span>}
                </div>
              )}
            </div>
            <div className="row gap-sm">
              {project.status === 'OPEN' && m?.isAdmin && live && (
                <button className="btn sm primary solid" onClick={() => run(() => {
                  const next = completeCurrentPresentation(me!.id, project.id, pres.id);
                  toast(next ? `발표를 완료하고 "${next}" 발표를 시작했습니다.` : '마지막 발표를 완료했습니다.');
                })}><IconText icon="check">발표 완료</IconText></button>
              )}
              {canEdit && <Link className="btn sm" to={`/p/${project.id}/pres/${pres.id}`}><IconText icon="pencil">편집</IconText></Link>}
            </div>
          </div>
          <RatingWidget project={project} pres={pres} />
        </div>
      )}
    </div>
  );
}

export default function ProjectHome() {
  const { pid } = useParams();
  const { db, me } = useMe();
  const [sp] = useSearchParams();
  const f = FILTERS[sp.get('f') ?? ''] ? sp.get('f')! : 'all';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const project = db.projects.find(p => p.id === pid);
  const m = project && me && membership(db, project.id, me.id);
  // 지금 발표 중인 발표는 처음부터 펼쳐서 바로 점수를 줄 수 있게 한다
  useEffect(() => { setPage(1); setOpenId(project?.currentPresentationId ?? null); }, [f, project?.currentPresentationId]);
  if (!project || !me) return <Navigate to="/" replace />;
  if (!m) return <Empty icon="lock">이 평가룸의 참여자가 아닙니다. <Link to="/">돌아가기</Link></Empty>;

  const all = presentationsOf(db, project.id);
  const statuses = all.map(p => myStatus(db, project, p, me.id));
  const total = statuses.filter(s => s === 'TODO' || s === 'DONE').length;
  const doneCount = statuses.filter(s => s === 'DONE').length;
  const remaining = total - doneCount;
  const s = project.settings;
  const closed = project.status === 'CLOSED';

  const kw = q.trim();
  const list = all
    .filter(p => f === 'all' ? true : f === 'mine' ? involvedIds(p).includes(me.id) : myStatus(db, project, p, me.id) === f.toUpperCase())
    .filter(p => !kw || p.title.includes(kw) || crewNames(db, p).some(n => n.includes(kw)));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const meta = FILTERS[f];

  return (
    <ProjectShell project={project} current={f}>
      <BoardHead title={meta.title} desc={meta.desc} count={list.length} search={q} onSearch={v => { setQ(v); setPage(1); }} />

      {closed && <div className="notice"><Icon name="flag" size={16} />마감된 평가룸이에요. 점수 제출·수정은 할 수 없고 기록만 볼 수 있어요.</div>}

      {(f === 'all' || f === 'todo') && (
        <div className="widgets">
          <div className="widget">
            <div className="widget-title">남은 평가 <span className="red">{remaining}</span>건</div>
            <p className="muted">평가 가능한 발표 {total}개 중 {doneCount}개 완료</p>
            <div className="bar"><span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>
          </div>
          <div className="widget rules">
            <Rule icon="star" label="점수 범위" value={`${s.min} ~ ${s.max}점`} />
            <Rule icon="pencil" label="제출 후 수정" value={s.allowEdit ? '가능' : '불가'} tone={s.allowEdit ? 'ok' : 'no'} />
            <Rule icon="users" label="같은 팀 평가" value={s.allowSameTeam ? '가능' : '불가'} tone={s.allowSameTeam ? 'ok' : 'no'} />
            <Rule icon="building" label="내 팀" value={teamName(db, m.teamIdAtJoin)} />
          </div>
        </div>
      )}

      {f === 'mine' && !closed && (
        <div className="board-tools"><Link to={`/p/${project.id}/pres/new`} className="btn primary solid"><IconText icon="plus">새 발표 등록</IconText></Link></div>
      )}

      <div className="btable">
        <div className="bhead">
          <span className="c-no">No</span><span className="c-title">발표 제목</span><span className="c-type">유형</span>
          <span className="c-who">구성원</span><span className="c-status">상태</span><span className="c-score">내 점수</span><span className="c-chev" />
        </div>
        {shown.length === 0 && <div className="bempty">{kw ? '검색 결과가 없습니다.' : '해당하는 발표가 없습니다.'}</div>}
        {shown.map(p => <PresRow key={p.id} project={project} pres={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />)}
      </div>
      <Pager page={page} total={pages} onChange={setPage} />
    </ProjectShell>
  );
}
