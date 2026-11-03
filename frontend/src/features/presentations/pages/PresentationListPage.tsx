// 평가룸 발표 목록: 한 줄을 누르면 펼쳐져 발표 정보와 구성원별 평가 입력이 보인다
import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { BoardHead, Chip, IconText, Pager } from '../../../shared/ui';
import { teamName, teamPath } from '../../organization';
import { membership, ProjectShell, RoomNotFound, roomAccess, type Project } from '../../projects';
import { myProgress, myStatus, RatingWidget, StatusBadge } from '../../ratings';
import { useSession } from '../../session';
import { PresInfo } from '../components/PresInfo';
import {
  canEditPresentation, crewNames, crewSummary, involvedIds, presSortText, presTypeText, presentationsOf, sortPresentations, type PresSort,
} from '../model/crew';
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
  all: { title: '전체 발표' },
  mine: { title: '내가 참여한 발표' },
};
const SORT_CHOICES: PresSort[] = ['team', 'order', 'created'];
const PAGE_SIZE = 10;

/** 발표 한 줄. 누르면 아래로 펼쳐져 내용과 점수 입력이 보인다 */
function PresRow({ project, pres, open, onToggle, viewer }: { project: Project; pres: Presentation; open: boolean; onToggle: () => void; viewer: boolean }) {
  const { db, me } = useSession();
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

export default function PresentationListPage() {
  const { pid } = useParams();
  const { db, me } = useSession();
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
  if (!project || !me || !access) return <RoomNotFound />;

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
            <Rule icon="building" label="내 팀" value={m?.teamNameAtJoin ?? teamName(db, m?.teamIdAtJoin ?? null)} />
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
