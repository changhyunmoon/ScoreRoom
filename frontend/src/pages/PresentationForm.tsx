import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AppError, canEditPresentation, deletePresentation, downloadAttachment, involvedIds, MAX_ATTACHMENT_MB, removeAttachment, savePresentation, uploadAttachments, MAX_ATTACHMENTS,
  type ID, type Presentation, type PresRole, type PresType,
} from '../store';
import { ConfirmButton, Empty, Field, IconText, run, toast, useMe } from '../ui';
import { Icon, type IconName } from '../icons';
import { fileSize, members, membership, presTypeText, teamName, userName, userOf } from '../logic';
import { BoardHead, ProjectShell } from './ProjectShell';
import { Presenters } from './ProjectHome';

const TYPE_INFO: Record<PresType, { icon: IconName; desc: string }> = {
  PERSONAL: { icon: 'user', desc: '혼자 발표' },
  TEAM: { icon: 'users', desc: '여러 명이 함께' },
};
/** 팀 발표 구성원을 고르는 방법. 저장되지 않는 화면 편의 기능이다 */
type Pick = 'MY_TEAM' | 'ANY';

type Role = 'LEADER' | PresRole;
const ROLE_TEXT: Record<Role, string> = { LEADER: '대표', PRESENTER: '발표자', MEMBER: '팀원' };
const ROLE_CLASS: Record<Role, string> = { LEADER: 'lead', PRESENTER: 'presenter', MEMBER: 'member' };

/** 한 사람의 역할 선택: [제외] [대표] [발표자] [팀원] */
/** 한 사람의 역할 선택. 대표는 발표자를 함께 고를 수 있다 (대표+발표자) */
function RoleSeg({ value, options, onChange, isDisabled }: {
  value: Role[]; options: (Role | null)[]; onChange: (v: Role | null) => void; isDisabled: (v: Role | null) => boolean;
}) {
  return (
    <div className="segmented role-seg">
      {options.map(v => (
        <button key={v ?? 'none'} type="button" className={`${(v ? value.includes(v) : value.length === 0) ? 'on' : ''} ${v ? ROLE_CLASS[v] : 'none'}`}
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
      // 대표가 발표도 하는지 (대표+발표자)
      leaderPresents: !!existing && existing.type !== 'PERSONAL' && existing.presenterIds.includes(existing.leaderId),
      deployUrl: existing?.deployUrl ?? '',
    };
  });
  // 발표 자료(여러 개): 새로 고른 파일(저장할 때 올림), 지울 기존 파일
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<ID[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  // 새 팀 발표는 우리 회사 팀에서 시작하고, 기존 발표는 전체 참여자에서 고른다
  const [pick, setPick] = useState<Pick>(existing ? 'ANY' : 'MY_TEAM');
  if (!project || !me) return <Navigate to="/" replace />;
  const m = membership(db, project.id, me.id);
  if (!m) return <Navigate to="/" replace />;
  if (prid && !existing) return <Empty>발표를 찾을 수 없습니다.</Empty>;
  if (existing && !canEditPresentation(existing, me.id, m.isAdmin)) return <Empty>대표, 발표를 만든 사람, 룸 운영자만 편집할 수 있습니다.</Empty>;
  if (project.status === 'CLOSED') return <Empty>마감된 평가룸은 편집할 수 없습니다.</Empty>;

  // 점수를 받은 발표는 평가 가능 여부가 바뀌지 않도록 구성원 추가·제외를 막는다 (역할 변경은 가능)
  const locked = !!existing?.hasRatings;
  const lockedCrew = existing ? involvedIds(existing) : [];
  const ms = members(db, project.id);
  const teamOf = (id: ID) => membership(db, project.id, id)?.teamIdAtJoin ?? null;
  // 우리 회사 팀으로 고를 때의 기준: 내 팀
  const myTeam = teamOf(me.id);
  // 조직도 순서 (위 = 높은 사람)
  const rankOf = (id: ID) => userOf(db, id)?.rank ?? Number.MAX_SAFE_INTEGER;
  const byName = (a: ID, b: ID) => userName(db, a).localeCompare(userName(db, b));
  // 개인 발표: 본인(편집이면 기존 대표) 한 명
  // 팀 발표: 우리 회사 팀이면 내 팀 참여자(조직도 순), 직접 고르기면 참여자 전원(나 먼저)
  const personalLeader = existing?.type === 'PERSONAL' ? existing.leaderId : me.id;
  const fromMyTeam = f.type === 'TEAM' && pick === 'MY_TEAM';
  const people = ms
    .filter(x => (f.type === 'PERSONAL' ? x.userId === personalLeader : fromMyTeam ? x.teamIdAtJoin === myTeam : true))
    .sort((a, b) => fromMyTeam
      ? rankOf(a.userId) - rankOf(b.userId) || byName(a.userId, b.userId)
      : (a.userId === me.id ? -1 : b.userId === me.id ? 1 : byName(a.userId, b.userId)));
  const back = m.isAdmin && existing ? `/p/${project.id}/admin` : `/p/${project.id}`;
  const ratingCount = existing ? db.ratings.filter(r => r.presentationId === existing.id).length : 0;

  const rolesOf = (id: ID): Role[] => (id === f.leaderId
    ? (f.leaderPresents && f.type !== 'PERSONAL' ? ['LEADER', 'PRESENTER'] : ['LEADER'])
    : f.type === 'PERSONAL' || !f.roles[id] ? [] : [f.roles[id]]);
  const visible = new Set(people.map(p => p.userId));
  const leaderId = visible.has(f.leaderId) ? f.leaderId : '';
  const presenterIds = f.type === 'PERSONAL' ? [] : [
    ...(leaderId && f.leaderPresents ? [leaderId] : []),
    ...people.map(p => p.userId).filter(id => id !== leaderId && f.roles[id] === 'PRESENTER'),
  ];
  const memberIds = f.type === 'PERSONAL' ? [] : people.map(p => p.userId).filter(id => id !== leaderId && f.roles[id] === 'MEMBER');
  const preview = {
    ...(existing ?? { id: 'preview', projectId: project.id, order: 0, createdBy: me.id, deployUrl: null, attachments: [] }),
    title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds,
  } as Presentation;
  const meIncluded = [leaderId, ...presenterIds, ...memberIds].includes(me.id);

  const setRole = (id: ID, role: Role | null) => {
    const roles = { ...f.roles };
    let lead = f.leaderId;
    let leaderPresents = f.leaderPresents;
    if (role === 'PRESENTER' && id === lead) {
      // 대표가 발표자를 누르면 대표+발표자를 켜고 끈다
      leaderPresents = !leaderPresents;
    } else if (role === 'LEADER') {
      if (lead === id) return;
      // 대표는 1명: 기존 대표는 발표자로 내려간다 (개인 발표는 제외). 발표자였던 사람이 대표가 되면 대표+발표자
      if (lead && f.type !== 'PERSONAL') roles[lead] = 'PRESENTER';
      leaderPresents = roles[id] === 'PRESENTER';
      delete roles[id];
      lead = id;
    } else {
      if (lead === id) { lead = ''; leaderPresents = false; }
      if (role) roles[id] = role; else delete roles[id];
    }
    setF({ ...f, leaderId: lead, roles, leaderPresents });
  };
  // 우리 회사 팀 불러오기: 내 팀 참여자 전원. 조직도에서 가장 위(높은) 사람이 대표, 나머지는 팀원으로 채운다
  const fillMyTeam = (type: PresType = f.type) => {
    const crew = ms.filter(x => x.teamIdAtJoin === myTeam).map(x => x.userId)
      .sort((a, b) => rankOf(a) - rankOf(b) || byName(a, b));
    const roles: Record<ID, PresRole> = {};
    crew.slice(1).forEach(id => { roles[id] = 'MEMBER'; });
    setF({ ...f, type, leaderId: crew[0] ?? me.id, roles, leaderPresents: false });
  };
  const changeType = (type: PresType) => {
    if (type === f.type) return;
    if (type === 'PERSONAL') {
      // 개인 발표: 본인이 대표 (구성원 선택 없음)
      setF({ ...f, type, roles: {}, leaderPresents: false, leaderId: existing?.type === 'PERSONAL' ? existing.leaderId : me.id });
      return;
    }
    // 팀 발표: 우리 회사 팀으로 시작
    setPick('MY_TEAM');
    fillMyTeam(type);
  };
  const changePick = (next: Pick) => {
    if (next === pick) return;
    setPick(next);
    // 우리 회사 팀을 다시 고르면 팀원을 새로 불러온다. 직접 고르기는 지금 선택을 그대로 두고 다른 참여자를 더 고른다
    if (next === 'MY_TEAM' && !locked) fillMyTeam();
  };
  const deployUrl = f.deployUrl.trim();
  const urlInvalid = deployUrl !== '' && !/^https?:\/\/\S+$/i.test(deployUrl);
  const keptFiles = (existing?.attachments ?? []).filter(a => !removeIds.includes(a.id));
  const fileCount = keptFiles.length + newFiles.length;
  const pickFiles = (picked: File[]) => {
    const tooBig = picked.filter(x => x.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (tooBig.length) toast(`${tooBig.map(x => x.name).join(', ')}: 파일당 ${MAX_ATTACHMENT_MB}MB 이하만 올릴 수 있습니다.`, 'err');
    const ok = picked.filter(x => x.size <= MAX_ATTACHMENT_MB * 1024 * 1024 && x.size > 0);
    const room = MAX_ATTACHMENTS - fileCount;
    if (ok.length > room) toast(`발표 자료는 ${MAX_ATTACHMENTS}개까지 올릴 수 있어요. ${ok.length - room}개는 빠졌어요.`, 'err');
    setNewFiles([...newFiles, ...ok.slice(0, Math.max(0, room))]);
  };
  const save = async () => {
    setSaving(true);
    let savedId = existing?.id ?? '';
    const ok = await run(async () => {
      savedId = await savePresentation(me.id, project.id,
        { title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds, deployUrl: deployUrl || null }, existing?.id);
      try {
        for (const id of removeIds) await removeAttachment(project.id, savedId, id);
        if (newFiles.length) await uploadAttachments(project.id, savedId, newFiles);
      } catch (e) {
        // 발표는 저장됐지만 파일만 실패한 경우: 편집 화면에서 다시 올릴 수 있게 한다
        nav(`/p/${project.id}/pres/${savedId}`, { replace: true });
        throw new AppError(`발표는 저장했지만 발표 자료를 올리지 못했습니다. ${e instanceof Error ? e.message : ''}`);
      }
    }, existing ? '발표를 수정했습니다.' : '발표를 등록했습니다.');
    setSaving(false);
    if (ok) nav(back);
  };

  const options: (Role | null)[] = f.type === 'PERSONAL' ? [null, 'LEADER'] : [null, 'LEADER', 'PRESENTER', 'MEMBER'];
  // 비활성 조건: 점수를 받은 발표는 구성원 추가·제외 불가(역할 변경은 가능), 관리자가 아니면 본인은 제외 불가
  const disabledFor = (id: ID) => (v: Role | null) => {
    if (locked && (lockedCrew.includes(id) ? v === null : v !== null)) return true;
    if (v === null && id === me.id && !m.isAdmin) return true;
    return false;
  };
  const problems = [
    !leaderId && '대표를 1명 선택해 주세요.',
    !m.isAdmin && !meIncluded && '본인의 역할(대표·발표자·팀원)을 선택해 주세요.',
    urlInvalid && '배포 URL은 http:// 또는 https://로 시작하는 주소로 입력해 주세요.',
  ].filter(Boolean) as string[];

  return (
    <ProjectShell project={project} current="write">
      <BoardHead title={existing ? '발표 편집' : '새 발표 등록'}
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
        <div className="field">
          <span className="field-label">발표 자료 (선택)</span>
          <input ref={fileInput} type="file" multiple hidden onChange={e => { pickFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <div className="file-box">
            {keptFiles.map(a => (
              <div key={a.id} className="file-pick">
                <Icon name="paperclip" size={16} />
                <button type="button" className="file-name link-btn" title="내려받기" onClick={() => run(() => downloadAttachment(project.id, existing!.id, a))}>{a.name}</button>
                <small className="muted">{fileSize(a.size)}</small>
                <span className="grow" />
                <button type="button" className="btn sm ghost" onClick={() => setRemoveIds([...removeIds, a.id])}>삭제</button>
              </div>
            ))}
            {newFiles.map((x, i) => (
              <div key={`${x.name}-${i}`} className="file-pick new">
                <Icon name="paperclip" size={16} />
                <span className="file-name">{x.name}</span>
                <small className="muted">{fileSize(x.size)} · 저장하면 올라가요</small>
                <span className="grow" />
                <button type="button" className="btn sm ghost" onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}>빼기</button>
              </div>
            ))}
            {removeIds.length > 0 && (
              <div className="file-note small">
                <span className="muted">기존 파일 {removeIds.length}개는 저장하면 삭제돼요.</span>
                <button type="button" className="link-btn" onClick={() => setRemoveIds([])}>되돌리기</button>
              </div>
            )}
            <div className="file-pick no-file">
              <button type="button" className="btn sm" disabled={fileCount >= MAX_ATTACHMENTS} onClick={() => fileInput.current?.click()}>
                <IconText icon="paperclip">{fileCount ? '파일 추가' : '파일 선택'}</IconText>
              </button>
              <small className="muted">{fileCount}/{MAX_ATTACHMENTS}개, 파일당 {MAX_ATTACHMENT_MB}MB 이하 (PPT, PDF, HWP 등) · 여러 개를 한 번에 고를 수 있어요</small>
            </div>
          </div>
        </div>
        <Field label="배포 URL (선택)">
          <input type="url" inputMode="url" value={f.deployUrl} placeholder="https://" className={urlInvalid ? 'invalid' : ''}
            onChange={e => setF({ ...f, deployUrl: e.target.value })} />
        </Field>
      </div>

      {f.type !== 'PERSONAL' && <div className="card stack">
        <div className="row between wrap gap">
          <div>
            <h2>발표 구성원</h2>
          </div>
          <div className="row gap-sm">
            <span className="crew-label lead">대표 {leaderId ? 1 : 0}</span>
            <span className="crew-label presenter">발표자 {presenterIds.length}</span>
            <span className="crew-label member">팀원 {memberIds.length}</span>
          </div>
        </div>
        <div className="segmented pick-seg" role="group" aria-label="구성원 고르는 방법">
          <button type="button" className={pick === 'MY_TEAM' ? 'on' : ''} onClick={() => changePick('MY_TEAM')}>
            <Icon name="building" size={15} />우리 회사 팀
          </button>
          <button type="button" className={pick === 'ANY' ? 'on' : ''} onClick={() => changePick('ANY')}>
            <Icon name="users" size={15} />직접 고르기
          </button>
        </div>
        <ul className="role-guide">
          <li><span className="crew-label lead">대표</span>꼭 1명 필요해요. 대표가 발표도 하면 발표자를 함께 눌러 주세요.</li>
        </ul>
        {locked && <div className="notice"><Icon name="lock" size={15} />점수를 받은 발표라 역할만 바꿀 수 있어요.</div>}

        <div className="crew-table">
          <div className="crew-head"><span>이름</span><span>팀</span><span>역할</span></div>
          {people.map(p => {
            const roles = rolesOf(p.userId);
            const role = roles[0] ?? null;
            return (
              <div key={p.userId} className={`crew-line ${role === 'LEADER' ? 'leader' : role ? 'picked' : ''}`}>
                <span className="cl-name">
                  {p.userId === me.id ? <b>{userName(db, p.userId)}</b> : userName(db, p.userId)}
                  {userOf(db, p.userId)?.position && <small className="muted">{userOf(db, p.userId)!.position}</small>}
                  {p.userId === me.id && <small className="muted">(나)</small>}
                  {roles.map(r => <span key={r} className={`crew-label ${ROLE_CLASS[r]}`}>{ROLE_TEXT[r]}</span>)}
                </span>
                <span className="cl-team">{teamName(db, p.teamIdAtJoin)}</span>
                <span className="cl-role"><RoleSeg value={roles} options={options} onChange={v => setRole(p.userId, v)} isDisabled={disabledFor(p.userId)} /></span>
              </div>
            );
          })}
          {fromMyTeam && people.length <= 1 && <div className="bempty">같은 팀의 다른 참여자가 없어요. 직접 고르기로 다른 참여자를 고를 수 있어요.</div>}
        </div>
        <span className="hint">
          {fromMyTeam ? `${teamName(db, myTeam)} 참여자를 불러왔어요. 조직도에서 가장 위 사람이 대표, 나머지는 팀원으로 먼저 선택돼요.` : '평가룸 참여자 누구나 고를 수 있어요.'}
        </span>
      </div>}

      <div className="card stack">
        <h2>미리보기</h2>
        {leaderId ? <Presenters db={db} project={project} pres={preview} /> : <p className="muted">대표를 선택하면 미리보기가 보여요.</p>}
        {problems.map(t => <div key={t} className="error"><Icon name="ban" size={15} />{t}</div>)}
        <button className="btn primary solid" disabled={problems.length > 0 || saving} onClick={save}><IconText icon="check">{existing ? '변경 사항 저장' : '발표 등록'}</IconText></button>
      </div>

      {existing && m.isAdmin && (
        <div className="card danger-zone stack">
          <h3>발표 삭제</h3>
          <ConfirmButton label="이 발표 삭제" confirmLabel="삭제"
            detail={ratingCount ? `제출된 평가 ${ratingCount}건이 함께 삭제되고 결과가 다시 계산됩니다.` : '제출된 평가가 없습니다.'}
            onConfirm={() => run(() => deletePresentation(me.id, project.id, existing.id), '발표를 삭제했습니다.').then(ok => ok && nav(back))} />
        </div>
      )}
    </ProjectShell>
  );
}
