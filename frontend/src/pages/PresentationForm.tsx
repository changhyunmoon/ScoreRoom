import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { canEditPresentation, deletePresentation, involvedIds, savePresentation, type ID, type Presentation, type PresRole, type PresType } from '../store';
import { ConfirmButton, Empty, Field, IconText, run, useMe } from '../ui';
import { Icon, type IconName } from '../icons';
import { members, membership, presTypeText, teamName, userName } from '../logic';
import { BoardHead, ProjectShell } from './ProjectShell';
import { Presenters } from './ProjectHome';

const TYPE_INFO: Record<PresType, { icon: IconName; desc: string }> = {
  PERSONAL: { icon: 'user', desc: '한 사람이 대표로 발표' },
  TEAM: { icon: 'building', desc: '같은 회사 팀원과 함께' },
  FREE: { icon: 'users', desc: '누구와든 함께' },
};

type Role = 'LEADER' | PresRole;
const ROLE_TEXT: Record<Role, string> = { LEADER: '대표', PRESENTER: '발표자', MEMBER: '팀원' };
const ROLE_CLASS: Record<Role, string> = { LEADER: 'lead', PRESENTER: 'presenter', MEMBER: 'member' };

/** 한 사람의 역할 선택: [제외] [대표] [발표자] [팀원] */
function RoleSeg({ value, options, onChange, isDisabled }: {
  value: Role | null; options: (Role | null)[]; onChange: (v: Role | null) => void; isDisabled: (v: Role | null) => boolean;
}) {
  return (
    <div className="segmented role-seg">
      {options.map(v => (
        <button key={v ?? 'none'} type="button" className={`${value === v ? 'on' : ''} ${v ? ROLE_CLASS[v] : 'none'}`}
          disabled={isDisabled(v)} onClick={() => onChange(v)}>{v ? ROLE_TEXT[v] : '제외'}</button>
      ))}
    </div>
  );
}

export default function PresentationForm() {
  const { pid, prid } = useParams();
  const { db, me } = useMe();
  const nav = useNavigate();
  const project = db.projects.find(p => p.id === pid);
  const existing = prid ? db.presentations.find(p => p.id === prid) : undefined;
  const [f, setF] = useState(() => {
    const roles: Record<ID, PresRole> = {};
    existing?.presenterIds.forEach(id => { roles[id] = 'PRESENTER'; });
    existing?.memberIds?.forEach(id => { roles[id] = 'MEMBER'; });
    return {
      title: existing?.title ?? '', intro: existing?.intro ?? '', type: (existing?.type ?? 'PERSONAL') as PresType,
      leaderId: existing?.leaderId ?? me?.id ?? '', // 새 발표는 만든 사람을 대표로 시작하고, 원하면 바꾼다
      roles,
    };
  });
  if (!project || !me) return <Navigate to="/" replace />;
  const m = membership(db, project.id, me.id);
  if (!m) return <Navigate to="/" replace />;
  if (prid && !existing) return <Empty>발표를 찾을 수 없습니다.</Empty>;
  if (existing && !canEditPresentation(existing, me.id, m.isAdmin)) return <Empty>대표, 발표를 만든 사람, 룸 운영자만 편집할 수 있습니다.</Empty>;
  if (project.status === 'CLOSED') return <Empty>마감된 평가룸은 편집할 수 없습니다.</Empty>;

  const locked = existing?.status === 'STARTED';
  const lockedCrew = existing ? involvedIds(existing) : [];
  const ms = members(db, project.id);
  const teamOf = (id: ID) => membership(db, project.id, id)?.teamIdAtJoin ?? null;
  // 회사 팀 발표의 기준 팀: 대표의 팀 (대표가 아직 없으면 내 팀)
  const baseTeam = teamOf(f.leaderId || me.id);
  // 관리자가 아니면 개인 발표는 본인만 고를 수 있다
  const people = ms
    .filter(x => f.type === 'FREE' || (f.type === 'TEAM' ? x.teamIdAtJoin === baseTeam : (m.isAdmin || x.userId === me.id)))
    .sort((a, b) => (a.userId === me.id ? -1 : b.userId === me.id ? 1 : userName(db, a.userId).localeCompare(userName(db, b.userId))));
  const back = m.isAdmin && existing ? `/p/${project.id}/admin` : `/p/${project.id}`;
  const ratingCount = existing ? db.ratings.filter(r => r.presentationId === existing.id).length : 0;

  const roleOf = (id: ID): Role | null => (id === f.leaderId ? 'LEADER' : f.type === 'PERSONAL' ? null : f.roles[id] ?? null);
  const visible = new Set(people.map(p => p.userId));
  const leaderId = visible.has(f.leaderId) ? f.leaderId : '';
  const presenterIds = f.type === 'PERSONAL' ? [] : people.map(p => p.userId).filter(id => id !== leaderId && f.roles[id] === 'PRESENTER');
  const memberIds = f.type === 'PERSONAL' ? [] : people.map(p => p.userId).filter(id => id !== leaderId && f.roles[id] === 'MEMBER');
  const preview = {
    ...(existing ?? { id: 'preview', projectId: project.id, order: 0, status: 'SCHEDULED', createdBy: me.id }),
    title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds,
  } as Presentation;
  const meIncluded = [leaderId, ...presenterIds, ...memberIds].includes(me.id);

  const setRole = (id: ID, role: Role | null) => {
    const roles = { ...f.roles };
    let lead = f.leaderId;
    if (role === 'LEADER') {
      // 대표는 1명: 기존 대표는 발표자로 내려간다 (개인 발표는 제외)
      if (lead && lead !== id && f.type !== 'PERSONAL') roles[lead] = 'PRESENTER';
      delete roles[id];
      lead = id;
    } else {
      if (lead === id) lead = '';
      if (role) roles[id] = role; else delete roles[id];
    }
    setF({ ...f, leaderId: lead, roles });
  };
  const changeType = (type: PresType) => {
    if (type === 'PERSONAL') {
      // 개인 발표: 대표 1명만. 대표가 없으면 나를 대표로
      setF({ ...f, type, roles: {}, leaderId: f.leaderId || me.id });
      return;
    }
    const base = teamOf(f.leaderId || me.id);
    const roles: Record<ID, PresRole> = {};
    Object.entries(f.roles).forEach(([id, r]) => { if (type === 'FREE' || teamOf(id) === base) roles[id] = r; });
    setF({ ...f, type, roles });
  };
  const save = () => {
    if (run(() => savePresentation(me.id, project.id, { title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds }, existing?.id),
      existing ? '발표를 수정했습니다.' : '발표를 등록했습니다.')) nav(back);
  };

  const options: (Role | null)[] = f.type === 'PERSONAL' ? [null, 'LEADER'] : [null, 'LEADER', 'PRESENTER', 'MEMBER'];
  // 비활성 조건: 시작된 발표는 구성원 추가·제외 불가(역할 변경은 가능), 관리자가 아니면 본인은 제외 불가
  const disabledFor = (id: ID) => (v: Role | null) => {
    if (locked && (lockedCrew.includes(id) ? v === null : v !== null)) return true;
    if (v === null && id === me.id && !m.isAdmin) return true;
    return false;
  };
  const problems = [
    !leaderId && '대표를 1명 선택해 주세요.',
    !m.isAdmin && !meIncluded && '본인의 역할(대표·발표자·팀원)을 선택해 주세요.',
  ].filter(Boolean) as string[];

  return (
    <ProjectShell project={project} current="write">
      <BoardHead title={existing ? '발표 편집' : '새 발표 등록'} desc={existing ? '발표 정보와 구성원을 수정해요.' : '발표 정보를 입력하고 구성원마다 역할을 정해 주세요. 발표 순서는 룸 운영자가 정해요.'}
        right={<Link to={back} className="btn sm"><IconText icon="back">목록으로</IconText></Link>} />
      <div className="card stack portal-form presentation-fields">
        <Field label="발표 제목"><input value={f.title} placeholder="예: 쿠버네티스 비용 최적화 사례" onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="간단한 소개"><textarea rows={3} value={f.intro} placeholder="어떤 내용을 발표하나요?" onChange={e => setF({ ...f, intro: e.target.value })} /></Field>
        <div className="field">
          <span className="field-label">발표 유형</span>
          <div className="type-cards">
            {(Object.keys(presTypeText) as PresType[]).map(t => (
              <button key={t} type="button" disabled={locked} className={`type-card ${f.type === t ? 'on' : ''}`} onClick={() => changeType(t)}>
                <Icon name={TYPE_INFO[t].icon} size={20} />
                <b>{presTypeText[t]}</b>
                <small>{TYPE_INFO[t].desc}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="row between wrap gap">
          <div>
            <h2>발표 구성원</h2>
            <p className="muted small">사람마다 대표 · 발표자 · 팀원 중 하나를 골라 주세요. 초대·수락 없이 바로 등록돼요.</p>
          </div>
          <div className="row gap-sm">
            <span className="crew-label lead">대표 {leaderId ? 1 : 0}</span>
            <span className="crew-label presenter">발표자 {presenterIds.length}</span>
            <span className="crew-label member">팀원 {memberIds.length}</span>
          </div>
        </div>
        <ul className="role-guide">
          <li><span className="crew-label lead">대표</span>발표를 대표하고 내용·구성원을 관리해요. 꼭 1명이에요.</li>
          <li><span className="crew-label presenter">발표자</span>대표와 함께 발표하는 사람이에요.</li>
          <li><span className="crew-label member">팀원</span>함께 준비했지만 발표는 하지 않는 사람이에요.</li>
        </ul>
        {locked && <div className="notice"><Icon name="lock" size={15} />평가가 시작된 발표라 구성원을 추가하거나 뺄 수 없어요. 대표·발표자·팀원 역할 변경만 가능해요.</div>}

        <div className="crew-table">
          <div className="crew-head"><span>이름</span><span>팀</span><span>역할</span></div>
          {people.map(p => {
            const role = roleOf(p.userId);
            return (
              <div key={p.userId} className={`crew-line ${role === 'LEADER' ? 'leader' : role ? 'picked' : ''}`}>
                <span className="cl-name">
                  {p.userId === me.id ? <b>{userName(db, p.userId)}</b> : userName(db, p.userId)}
                  {p.userId === me.id && <small className="muted">(나)</small>}
                  {role && <span className={`crew-label ${ROLE_CLASS[role]}`}>{ROLE_TEXT[role]}</span>}
                </span>
                <span className="cl-team">{teamName(db, p.teamIdAtJoin)}</span>
                <span className="cl-role"><RoleSeg value={role} options={options} onChange={v => setRole(p.userId, v)} isDisabled={disabledFor(p.userId)} /></span>
              </div>
            );
          })}
          {f.type === 'TEAM' && people.length <= 1 && <div className="bempty">같은 팀의 다른 참여자가 없어요.</div>}
        </div>
        <span className="hint">
          {f.type === 'PERSONAL' && '개인 발표는 대표 1명으로 구성돼요. 함께할 사람이 있다면 회사 팀 또는 자유 구성을 선택하세요.'}
          {f.type === 'TEAM' && `${teamName(db, baseTeam)} 소속 참여자만 구성원으로 등록할 수 있어요.`}
          {f.type === 'FREE' && '평가룸 참여자 누구나 구성원으로 등록할 수 있어요.'}
          {' '}구성원 전원은 이 발표를 평가할 수 없어요.
        </span>
      </div>

      <div className="card stack">
        <h2>미리보기</h2>
        <p className="muted small">참여자 화면에는 이렇게 표시돼요.</p>
        {leaderId ? <Presenters db={db} project={project} pres={preview} /> : <p className="muted">대표를 선택하면 미리보기가 보여요.</p>}
        {problems.map(t => <div key={t} className="error"><Icon name="ban" size={15} />{t}</div>)}
        <button className="btn primary solid" disabled={problems.length > 0} onClick={save}><IconText icon="check">{existing ? '변경 사항 저장' : '발표 등록'}</IconText></button>
      </div>

      {existing && m.isAdmin && (
        <div className="card danger-zone stack">
          <h3>발표 삭제</h3>
          <ConfirmButton label="이 발표 삭제" confirmLabel="삭제"
            detail={ratingCount ? `제출된 평가 ${ratingCount}건과 수정 이력이 함께 삭제되고 결과가 다시 계산됩니다.` : '제출된 평가가 없습니다.'}
            onConfirm={() => run(() => deletePresentation(me.id, project.id, existing.id), '발표를 삭제했습니다.') && nav(back)} />
        </div>
      )}
    </ProjectShell>
  );
}
