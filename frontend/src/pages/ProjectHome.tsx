import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BoardHead, Pager, ProjectShell } from './ProjectShell';
import { canEditPresentation, downloadAttachment, involvedIds, MAX_FEEDBACK_LENGTH, submitRating, type DB, type ID, type Presentation, type Project } from '../store';
import { Chip, Empty, IconText, run, useMe } from '../ui';
import { Icon, type IconName } from '../icons';
import { teamPath } from './OrgTree';
import {
  blockReason, blockText, crewNames, crewOf, crewSummary, fileSize, membership, myProgress, myStatus, presSortText, presTypeText, presentationsOf, roleText,
  roomAccess, sortPresentations, statusMeta, teamName, timeText, userName, type CrewRole, type MyStatus, type PresSort,
} from '../logic';

const ROLE_CLASS = { LEADER: 'lead', LEADER_PRESENTER: 'lead', PRESENTER: 'presenter', MEMBER: 'member' } as const;

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

/** 발표 자료 내려받기와 배포 URL. 평가룸 참여자 누구나 볼 수 있다 */
export function PresMaterials({ project, pres }: { project: Project; pres: Presentation }) {
  if (!pres.attachments.length && !pres.deployUrl) return null;
  return (
    <div className="pres-materials">
      {pres.attachments.map(file => (
        <button key={file.id} type="button" className="material" onClick={() => run(() => downloadAttachment(project.id, pres.id, file))} title="내려받기">
          <Icon name="paperclip" size={16} />
          <span className="material-name">{file.name}</span>
          <small className="muted">{fileSize(file.size)}</small>
          <Icon name="download" size={16} />
        </button>
      ))}
      {pres.deployUrl && (
        <a className="material" href={pres.deployUrl} target="_blank" rel="noopener noreferrer" title={pres.deployUrl}>
          <Icon name="link" size={16} />
          <span className="material-name">{pres.deployUrl}</span>
        </a>
      )}
    </div>
  );
}

/** 발표 정보 표: 소개 / 구성원 / 발표 자료를 줄마다 나눠 보여준다. 평가 화면과 결과 현황 팝업이 함께 쓴다 */
export function PresInfo({ project, pres, showMyRole }: { project: Project; pres: Presentation; showMyRole?: boolean }) {
  const { db, me } = useMe();
  const hasMaterials = pres.attachments.length > 0 || !!pres.deployUrl;
  const mine = showMyRole && me && involvedIds(pres).includes(me.id);
  return (
    <dl className="info-table">
      <div className="info-row">
        <dt>소개</dt>
        <dd>{pres.intro ? <p className="intro">{pres.intro}</p> : <span className="muted">등록된 소개가 없어요.</span>}</dd>
      </div>
      <div className="info-row">
        <dt>구성원</dt>
        <dd>
          <Presenters db={db} project={project} pres={pres} />
          {mine && (
            <div className="my-role small">
              <Icon name="user" size={14} />내 역할:
              {pres.leaderId === me!.id ? <span className="crew-label lead">대표</span>
                : pres.presenterIds.includes(me!.id) ? <span className="crew-label presenter">발표자</span>
                : <span className="crew-label member">팀원</span>}
            </div>
          )}
        </dd>
      </div>
      {hasMaterials && (
        <div className="info-row">
          <dt>발표 자료</dt>
          <dd><PresMaterials project={project} pres={pres} /></dd>
        </div>
      )}
    </dl>
  );
}

export function StatusBadge({ s }: { s: MyStatus }) {
  const m = statusMeta[s];
  return <Chip tone={m.tone} icon={m.icon}>{m.label}</Chip>;
}

/** 발표 구성원 한 명에 대한 내 평가: 점수(필수) + 피드백(선택). 피드백은 나와 룸 운영자만 본다 */
function PersonRating({ project, pres, targetId, role }: { project: Project; pres: Presentation; targetId: ID; role: CrewRole }) {
  const { db, me } = useMe();
  const { min, max, allowEdit } = project.settings;
  const mine = db.ratings.find(r => r.presentationId === pres.id && r.targetId === targetId && r.raterId === me!.id);
  const [val, setVal] = useState<string>(mine ? String(mine.score) : '');
  const [feedback, setFeedback] = useState(mine?.feedback ?? '');
  const [editing, setEditing] = useState(!mine);
  useEffect(() => {
    setEditing(!mine); setVal(mine ? String(mine.score) : ''); setFeedback(mine?.feedback ?? '');
  }, [mine?.id, mine?.score, mine?.feedback]);

  const block = blockReason(db, project, pres, me!.id, targetId);
  const closed = project.status === 'CLOSED';
  const who = (
    <div className="pr-who">
      <b>{userName(db, targetId)}</b>{targetId === me!.id && <small className="muted"> (나)</small>}
      <span className={`crew-label ${ROLE_CLASS[role]}`}>{roleText[role]}</span>
      <small className="muted">{teamName(db, membership(db, project.id, targetId)?.teamIdAtJoin ?? null)}</small>
    </div>
  );

  if (mine && (!editing || closed || block)) {
    return (
      <div className="person-rating done">
        {who}
        <div className="pr-body">
          <div className="pr-score"><Icon name="checkCircle" size={18} /><b className="score">{mine.score}</b><span className="muted"> / {max}점</span>
            <small className="muted">· {timeText(mine.submittedAt)} 제출</small></div>
          {mine.feedback && <p className="pr-feedback">{mine.feedback}</p>}
        </div>
        {!closed && !block && (allowEdit
          ? <button className="btn sm" onClick={() => setEditing(true)}><IconText icon="pencil">수정</IconText></button>
          : <small className="muted lock-note"><Icon name="lock" size={13} /> 수정 불가</small>)}
      </div>
    );
  }
  if (block) {
    return <div className="person-rating blocked">{who}<div className="pr-body muted small"><Icon name="lock" size={14} /> {blockText[block]}</div></div>;
  }
  if (closed) {
    return <div className="person-rating blocked">{who}<div className="pr-body muted small"><Icon name="ban" size={14} /> 평가 안 함 · 평가가 마감됐어요.</div></div>;
  }

  const n = Number(val);
  const valid = val !== '' && Number.isInteger(n) && n >= min && n <= max;
  const tooLong = feedback.length > MAX_FEEDBACK_LENGTH;
  const submit = () => run(() => submitRating(me!.id, project.id, pres.id, targetId, n, feedback),
    `${userName(db, targetId)}님 점수를 ${mine ? '수정' : '제출'}했습니다.`).then(ok => ok && setEditing(false));

  return (
    <div className="person-rating form">
      {who}
      <div className="pr-body stack sm">
        <div className="row gap">
          {/* 숫자를 직접 입력만 한다 (휠·화살표로 값이 바뀌지 않게 type="text"를 쓴다) */}
          <input type="text" inputMode="numeric" autoComplete="off" placeholder={`${min}~${max}`}
            className={`score-input ${val !== '' && !valid ? 'invalid' : ''}`} value={val} aria-label={`${userName(db, targetId)} 점수`}
            onChange={e => setVal(e.target.value.replace(min < 0 ? /[^\d-]/g : /\D/g, ''))} onKeyDown={e => e.key === 'Enter' && valid && !tooLong && submit()} />
          <button className="btn primary solid" disabled={!valid || tooLong} onClick={submit}><IconText icon="check">{mine ? '수정 저장' : '제출'}</IconText></button>
          {mine && <button className="btn ghost" onClick={() => setEditing(false)}>취소</button>}
        </div>
        <textarea className={`pr-feedback-input ${tooLong ? 'invalid' : ''}`} rows={2} value={feedback} placeholder="피드백 (선택) · 룸 운영자만 볼 수 있어요"
          aria-label={`${userName(db, targetId)} 피드백`} onChange={e => setFeedback(e.target.value)} />
        <div className="row between small">
          {val !== '' && !valid ? <span className="err-text">{min}~{max} 사이의 정수를 입력해 주세요.</span> : <span />}
          <span className={tooLong ? 'err-text' : 'muted'}>{feedback.length}/{MAX_FEEDBACK_LENGTH}</span>
        </div>
      </div>
    </div>
  );
}

/** 발표 구성원(대표·발표자·팀원) 한 명씩 평가한다 */
function RatingWidget({ project, pres }: { project: Project; pres: Presentation }) {
  const { db, me } = useMe();
  const { min, max, allowEdit } = project.settings;
  const { ratable, rated } = myProgress(db, project, pres, me!.id);
  return (
    <div className="rate-box people">
      <div className="rate-label">
        <Icon name="star" size={15} /> 구성원별 점수 <small className="muted">({min}~{max}점, 정수 · {rated}/{ratable}명 평가)</small>
      </div>
      {crewOf(pres).map(c => <PersonRating key={c.id} project={project} pres={pres} targetId={c.id} role={c.role} />)}
      {!allowEdit && project.status === 'OPEN' && <small className="muted">제출하면 수정할 수 없어요.</small>}
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

const FILTERS: Record<string, { title: string }> = {
  all: { title: '전체 발표' },
  mine: { title: '내가 참여한 발표' },
};
const SORT_CHOICES: PresSort[] = ['team', 'order', 'created'];
const PAGE_SIZE = 10;

/** 발표 한 줄. 누르면 아래로 펼쳐져 내용과 점수 입력이 보인다 */
function PresRow({ project, pres, open, onToggle, viewer }: { project: Project; pres: Presentation; open: boolean; onToggle: () => void; viewer: boolean }) {
  const { db, me } = useMe();
  const m = membership(db, project.id, me!.id);
  const s = myStatus(db, project, pres, me!.id);
  const progress = myProgress(db, project, pres, me!.id);
  const canEdit = !viewer && project.status === 'OPEN' && canEditPresentation(pres, me!.id, !!m?.isAdmin);
  const names = crewSummary(db, pres);
  return (
    <div className={`brow-wrap ${open ? 'open' : ''}`}>
      <button className={`brow ${!viewer && s === 'TODO' ? 'unread' : ''}`} onClick={onToggle} aria-expanded={open}>
        <span className="c-no">{pres.order}</span>
        <span className="c-title">
          <span className="t">{pres.title}{pres.attachments.length > 0 && <Icon name="paperclip" size={13} className="title-clip" />}</span>
          <span className="t-sub">{presTypeText[pres.type]} · {names}</span>
        </span>
        <span className="c-type">{presTypeText[pres.type]}</span>
        <span className="c-who ellipsis" title={names}>{names}</span>
        <span className="c-status">{viewer ? <Chip icon="eye">열람</Chip> : <StatusBadge s={s} />}</span>
        <span className="c-score">{viewer || progress.ratable === 0 ? <span className="muted">-</span> : <span><b>{progress.rated}</b><span className="muted">/{progress.ratable}명</span></span>}</span>
        <span className="c-chev"><Icon name={open ? 'up' : 'down'} size={16} /></span>
      </button>
      {open && (
        <div className="brow-detail">
          <section className="detail-block">
            <div className="detail-block-head">
              <span><Icon name="mic" size={15} /> 발표 정보</span>
              {canEdit && <Link className="btn sm" to={`/p/${project.id}/pres/${pres.id}`}><IconText icon="pencil">편집</IconText></Link>}
            </div>
            <PresInfo project={project} pres={pres} showMyRole />
          </section>
          {viewer
            ? <div className="notice info small"><Icon name="eye" size={15} />열람 전용이에요. 평가는 평가룸 참여자만 할 수 있어요.</div>
            : <RatingWidget project={project} pres={pres} />}
        </div>
      )}
    </div>
  );
}

export default function ProjectHome() {
  const { pid } = useParams();
  const { db, me } = useMe();
  const [sp, setSp] = useSearchParams();
  const project = db.projects.find(p => p.id === pid);
  const access = project && me ? roomAccess(db, project.id, me) : null;
  const viewer = access === 'viewer';
  // 열람 전용은 평가 관련 필터가 없으므로 전체 발표만 본다
  const f = !viewer && FILTERS[sp.get('f') ?? ''] ? sp.get('f')! : 'all';
  // 정렬은 주소에 남겨서 새로 고침해도 유지한다 (기본: 관리자 설정 순)
  const sortParam = sp.get('sort');
  const sort: PresSort = sortParam === 'created' || sortParam === 'team' ? sortParam : 'order';
  const setSort = (v: PresSort) => {
    const next = new URLSearchParams(sp);
    if (v === 'order') next.delete('sort'); else next.set('sort', v);
    setSp(next, { replace: true });
  };
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const m = project && me ? membership(db, project.id, me.id) : undefined;
  useEffect(() => { setPage(1); setOpenId(null); }, [f, sort]);
  if (!project || !me) return <Navigate to="/" replace />;
  if (!access) return <Empty icon="lock">이 평가룸의 참여자가 아닙니다. <Link to="/">돌아가기</Link></Empty>;

  const all = presentationsOf(db, project.id);
  // 남은 평가는 사람 단위로 센다 (발표 구성원 한 명씩 평가)
  const progress = all.map(p => myProgress(db, project, p, me.id));
  const total = progress.reduce((a, x) => a + x.ratable, 0);
  const doneCount = progress.reduce((a, x) => a + x.rated, 0);
  const remaining = total - doneCount;
  const s = project.settings;
  const closed = project.status === 'CLOSED';

  const kw = q.trim();
  const list = sortPresentations(db, project, all, sort)
    .filter(p => f === 'mine' ? involvedIds(p).includes(me.id) : true)
    .filter(p => !kw || p.title.includes(kw) || crewNames(db, p).some(n => n.includes(kw)));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const shown = list.slice(pageStart, pageStart + PAGE_SIZE);
  const leaderTeam = (p: Presentation) => membership(db, project.id, p.leaderId)?.teamIdAtJoin ?? null;
  const teamCounts = new Map<ID | null, number>();
  if (sort === 'team') list.forEach(p => {
    const teamId = leaderTeam(p);
    teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1);
  });
  const meta = FILTERS[f];

  return (
    <ProjectShell project={project} current={f}>
      <BoardHead title={meta.title} count={list.length} search={q} onSearch={v => { setQ(v); setPage(1); }} />

      {closed && <div className="notice"><Icon name="flag" size={16} />마감된 평가룸이에요.</div>}
      {viewer && <div className="notice info"><Icon name="eye" size={16} />전체 열람 권한으로 보고 있어요. 평가·발표 등록은 할 수 없어요.</div>}

      {!viewer && f === 'all' && (
        <div className="widgets">
          <div className="widget">
            <div className="widget-title">남은 평가 <span className="red">{remaining}</span>명</div>
            <p className="muted">평가할 구성원 {total}명 중 {doneCount}명 완료</p>
            <div className="bar"><span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>
          </div>
          <div className="widget rules">
            <Rule icon="star" label="점수 범위" value={`${s.min} ~ ${s.max}점`} />
            <Rule icon="pencil" label="제출 후 수정" value={s.allowEdit ? '가능' : '불가'} tone={s.allowEdit ? 'ok' : 'no'} />
            <Rule icon="user" label="본인 평가" value={s.allowSelf ? '가능' : '불가'} tone={s.allowSelf ? 'ok' : 'no'} />
            <Rule icon="mic" label="같은 발표 팀원 평가" value={s.allowSameCrew ? '가능' : '불가'} tone={s.allowSameCrew ? 'ok' : 'no'} />
            <Rule icon="users" label="같은 팀 평가" value={s.allowSameTeam ? '가능' : '불가'} tone={s.allowSameTeam ? 'ok' : 'no'} />
            <Rule icon="building" label="내 팀" value={teamName(db, m?.teamIdAtJoin ?? null)} />
          </div>
        </div>
      )}

      <div className="board-tools">
        <span className="muted small">정렬</span>
        <div className="segmented">
          {SORT_CHOICES.map(k => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{presSortText[k]}</button>
          ))}
        </div>
        <span className="grow" />
        {!viewer && f === 'mine' && !closed && <Link to={`/p/${project.id}/pres/new`} className="btn primary solid"><IconText icon="plus">새 발표 등록</IconText></Link>}
      </div>
      {sort === 'team' && list.length > 0 && <p className="muted small team-sort-hint">발표 대표의 소속 팀 기준 · 같은 팀은 관리자 설정 순서로 표시</p>}

      <div className={`btable ${sort === 'team' ? 'team-sorted' : ''}`}>
        <div className="bhead">
          <span className="c-no" title={sort === 'team' ? '관리자 설정 순서' : undefined}>{sort === 'team' ? '관리자순' : 'No'}</span><span className="c-title">발표 제목</span><span className="c-type">유형</span>
          <span className="c-who">구성원</span><span className="c-status">상태</span><span className="c-score">내 평가</span><span className="c-chev" />
        </div>
        {shown.length === 0 && <div className="bempty">{kw ? '검색 결과가 없습니다.' : '해당하는 발표가 없습니다.'}</div>}
        {shown.map((p, i) => {
          const teamId = leaderTeam(p);
          const previous = i > 0 ? shown[i - 1] : list[pageStart - 1];
          const startsGroup = sort === 'team' && (!previous || leaderTeam(previous) !== teamId || i === 0);
          const continued = i === 0 && !!previous && leaderTeam(previous) === teamId;
          return <Fragment key={p.id}>
            {startsGroup && <div className="bgroup" role="heading" aria-level={3}>
              <span className="bgroup-icon"><Icon name="building" size={16} /></span>
              <span className="bgroup-label">
                <strong>{teamName(db, teamId)}</strong>
                <small>{teamPath(db.teams, teamId)}</small>
              </span>
              <span className="bgroup-count">발표 {teamCounts.get(teamId)}개</span>
              {continued && <span className="bgroup-cont">이전 페이지에서 계속</span>}
            </div>}
            <PresRow project={project} pres={p} viewer={viewer} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
          </Fragment>;
        })}
      </div>
      <Pager page={page} total={pages} onChange={setPage} />
    </ProjectShell>
  );
}
