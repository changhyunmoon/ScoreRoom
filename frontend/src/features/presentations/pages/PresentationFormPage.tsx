// 발표 등록·편집: 제목/소개/유형, 발표 자료, 배포 URL, 구성원(대표·팀원). 발표자 구분은 없다
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import { fileSize } from '../../../shared/lib/format';
import type { ID } from '../../../shared/lib/types';
import { BoardHead, ConfirmButton, Empty, errorMessage, Field, IconText, run, toast } from '../../../shared/ui';
import { downloadAttachment, MAX_ATTACHMENT_MB, MAX_ATTACHMENTS, removeAttachment, uploadAttachment } from '../../attachments';
import { teamName, userName, userOf } from '../../organization';
import { members, membership, ProjectShell, RoomNotFound } from '../../projects';
import { mutate, refresh, useSession } from '../../session';
import { deletePresentation, savePresentation } from '../api/presentations.api';
import { Presenters } from '../components/PresInfo';
import { canEditPresentation, involvedIds, presentationOfUser, presTypeText } from '../model/crew';
import type { Presentation, PresType } from '../model/types';

const TYPE_INFO: Record<PresType, { icon: IconName; desc: string }> = {
  PERSONAL: { icon: 'user', desc: '혼자 발표' },
  TEAM: { icon: 'users', desc: '여러 명이 함께' },
};
/** 팀 발표 구성원을 고르는 방법. 저장되지 않는 화면 편의 기능이다 */
type Pick = 'MY_TEAM' | 'ANY';

type Role = 'LEADER' | 'MEMBER';
const ROLE_TEXT: Record<Role, string> = { LEADER: '대표', MEMBER: '팀원' };
const ROLE_CLASS: Record<Role, string> = { LEADER: 'lead', MEMBER: 'member' };

/** 한 사람의 역할 선택: [제외] [대표] [팀원] (개인 발표는 [제외] [대표]) */
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

export default function PresentationFormPage() {
  const { pid, prid } = useParams();
  const { db, me } = useSession();
  const nav = useNavigate();
  const project = db.projects.find(p => p.id === pid);
  const existing = prid ? db.presentations.find(p => p.id === prid) : undefined;
  const [f, setF] = useState(() => {
    // 예전 데이터의 발표자도 팀원으로 불러온다
    const roles: Record<ID, 'MEMBER'> = {};
    [...(existing?.presenterIds ?? []), ...(existing?.memberIds ?? [])]
      .filter(id => id !== existing?.leaderId).forEach(id => { roles[id] = 'MEMBER'; });
    return {
      title: existing?.title ?? '', intro: existing?.intro ?? '', type: (existing?.type ?? 'PERSONAL') as PresType,
      // 새 발표는 만든 사람을 대표로 시작하고, 원하면 바꾼다. 이미 다른 발표에 있으면 비워 둔다 (한 사람은 발표 하나)
      leaderId: existing?.leaderId ?? (me && pid && !presentationOfUser(db, pid, me.id) ? me.id : ''),
      roles,
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
  const [crewQuery, setCrewQuery] = useState('');
  if (!project || !me) return <RoomNotFound />;
  const m = membership(db, project.id, me.id);
  if (!m) return <RoomNotFound />;
  if (prid && !existing) return <Empty>발표를 찾을 수 없습니다. 삭제됐을 수 있어요. <Link to={`/p/${project.id}`}>목록으로</Link></Empty>;
  if (existing && !canEditPresentation(existing, me.id, m.isAdmin)) return <Empty>발표 구성원, 발표를 만든 사람, 룸 관리자만 편집할 수 있습니다.</Empty>;
  if (project.status === 'CLOSED') return <Empty>마감된 평가룸은 편집할 수 없습니다.</Empty>;

  // 한 사람은 평가룸에서 발표 하나에만 참여한다. 다른 발표에 이미 들어 있는 사람의 그 발표
  const takenBy = (id: ID) => {
    const p = presentationOfUser(db, project.id, id);
    return p && p.id !== existing?.id ? p : undefined;
  };
  const myOther = takenBy(me.id);
  if (!existing && myOther && !m.isAdmin) {
    return (
      <Empty icon="mic">
        이미 <b>'{myOther.title}'</b> 발표에 등록돼 있어요. 한 사람은 발표 하나에만 참여할 수 있어요.{' '}
        <Link to={`/p/${project.id}/pres/${myOther.id}`}>내 발표 편집</Link>
      </Empty>
    );
  }

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
  // 룸 관리자는 평가룸의 모든 평가를 받으므로 삭제될 평가 수를 정확히 보여줄 수 있다
  const ratingCount = existing ? db.ratings.filter(r => r.presentationId === existing.id).length : 0;

  const rolesOf = (id: ID): Role[] => (id === f.leaderId ? ['LEADER'] : f.type === 'PERSONAL' || !f.roles[id] ? [] : ['MEMBER']);
  // 직접 고르기에서 이름·팀으로 찾는다. 이미 고른 사람은 검색과 상관없이 계속 보인다
  const crewKey = crewQuery.trim().toLowerCase();
  const shownPeople = fromMyTeam || !crewKey ? people : people.filter(p => rolesOf(p.userId).length > 0
    || userName(db, p.userId).toLowerCase().includes(crewKey)
    || (p.teamNameAtJoin ?? teamName(db, p.teamIdAtJoin)).toLowerCase().includes(crewKey));
  const visible = new Set(people.map(p => p.userId));
  const leaderId = visible.has(f.leaderId) ? f.leaderId : '';
  // 발표자 구분은 없다 (서버도 팀원으로 받는다)
  const presenterIds: ID[] = [];
  const memberIds = f.type === 'PERSONAL' ? [] : people.map(p => p.userId).filter(id => id !== leaderId && f.roles[id] === 'MEMBER');
  const crewDraft = {
    ...(existing ?? { id: 'preview', projectId: project.id, order: 0, createdBy: me.id, createdAt: 0, deployUrl: null, attachments: [], hasRatings: false }),
    title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds,
  } as Presentation;
  const meIncluded = [leaderId, ...presenterIds, ...memberIds].includes(me.id);

  const setRole = (id: ID, role: Role | null) => {
    const roles = { ...f.roles };
    let lead = f.leaderId;
    if (role === 'LEADER') {
      if (lead === id) return;
      // 대표는 1명: 기존 대표는 팀원으로 내려간다 (개인 발표는 제외)
      if (lead && f.type !== 'PERSONAL') roles[lead] = 'MEMBER';
      delete roles[id];
      lead = id;
    } else {
      if (lead === id) lead = '';
      if (role) roles[id] = 'MEMBER'; else delete roles[id];
    }
    setF({ ...f, leaderId: lead, roles });
  };
  // 우리 회사 팀 불러오기: 내 팀 참여자 전원. 지금 등록하는 사람(나)은 항상 들어가고 기본 대표, 나머지는 팀원으로 채운다.
  // 내가 이미 다른 발표에 들어 있으면(룸 관리자가 대신 등록하는 경우) 조직도에서 가장 위 사람을 대표로 둔다
  const fillMyTeam = (type: PresType = f.type) => {
    // 다른 발표에 이미 등록된 사람은 빼고 불러온다
    const crew = ms.filter(x => x.teamIdAtJoin === myTeam && !takenBy(x.userId)).map(x => x.userId)
      .sort((a, b) => rankOf(a) - rankOf(b) || byName(a, b));
    const leader = myOther ? crew[0] ?? '' : me.id;
    const roles: Record<ID, 'MEMBER'> = {};
    crew.filter(id => id !== leader).forEach(id => { roles[id] = 'MEMBER'; });
    setF({ ...f, type, leaderId: leader, roles });
  };
  const changeType = (type: PresType) => {
    if (type === f.type) return;
    if (type === 'PERSONAL') {
      // 개인 발표: 본인이 대표 (구성원 선택 없음)
      setF({ ...f, type, roles: {}, leaderId: existing?.type === 'PERSONAL' ? existing.leaderId : myOther ? '' : me.id });
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

  /**
   * 본문 저장 → 지울 자료 삭제 → 새 자료 업로드 순서로 보낸다.
   * 본문은 저장됐는데 일부 자료만 실패하면, 실패한 파일만 알려 주고 편집 화면에서 다시 올리게 한다.
   */
  const save = async () => {
    setSaving(true);
    let savedId: ID;
    try {
      savedId = await savePresentation(project.id,
        { title: f.title, intro: f.intro, type: f.type, leaderId, presenterIds, memberIds, deployUrl: deployUrl || null }, existing?.id);
    } catch (e) {
      toast(errorMessage(e), 'err');
      await refresh().catch(() => undefined);
      setSaving(false);
      return;
    }
    const failed: string[] = [];
    for (const id of removeIds) {
      try { await removeAttachment(project.id, savedId, id); } catch (e) {
        failed.push(`${existing?.attachments.find(a => a.id === id)?.name ?? '파일'} 삭제 (${errorMessage(e)})`);
      }
    }
    const notUploaded: File[] = [];
    for (const file of newFiles) {
      try { await uploadAttachment(project.id, savedId, file); } catch (e) {
        notUploaded.push(file);
        failed.push(`${file.name} (${errorMessage(e)})`);
      }
    }
    await refresh().catch(() => undefined);
    setSaving(false);
    if (failed.length) {
      setNewFiles(notUploaded);
      setRemoveIds([]);
      toast(`발표는 저장했지만 자료 일부를 처리하지 못했습니다: ${failed.join(', ')}`, 'err');
      if (!existing) nav(`/p/${project.id}/pres/${savedId}`, { replace: true });
      return;
    }
    toast(existing ? '발표를 수정했습니다.' : '발표를 등록했습니다.');
    nav(back);
  };

  const options: (Role | null)[] = f.type === 'PERSONAL' ? [null, 'LEADER'] : [null, 'LEADER', 'MEMBER'];
  // 비활성 조건: 점수를 받은 발표는 구성원 추가·제외 불가(역할 변경은 가능), 관리자가 아니면 본인은 제외 불가
  const disabledFor = (id: ID) => (v: Role | null) => {
    if (v !== null && takenBy(id)) return true;
    if (locked && (lockedCrew.includes(id) ? v === null : v !== null)) return true;
    if (v === null && id === me.id && !m.isAdmin) return true;
    return false;
  };
  const titleKey = f.title.trim().toLowerCase();
  const titleTaken = !!titleKey && db.presentations.some(p =>
    p.projectId === project.id && p.id !== existing?.id && p.title.trim().toLowerCase() === titleKey);
  const takenCrew = [leaderId, ...presenterIds, ...memberIds].filter(id => id && takenBy(id));
  const problems = [
    !f.title.trim() && '발표 제목을 입력해 주세요.',
    takenCrew.length > 0 && `다른 발표에 이미 등록된 사람이 있어요: ${Array.from(new Set(takenCrew)).map(id => userName(db, id)).join(', ')}. 한 사람은 발표 하나에만 참여할 수 있어요.`,
    titleTaken && '이 평가룸에 같은 제목의 발표가 이미 있습니다.',
    !leaderId && '대표를 1명 선택해 주세요.',
    !m.isAdmin && !meIncluded && '본인의 역할(대표·팀원)을 선택해 주세요.',
    urlInvalid && '배포 URL은 http:// 또는 https://로 시작하는 주소로 입력해 주세요.',
  ].filter(Boolean) as string[];

  return (
    <ProjectShell project={project} current="write">
      <BoardHead title={existing ? '발표 편집' : '새 발표 등록'}
        right={<Link to={back} className="btn sm"><IconText icon="back">목록으로</IconText></Link>} />
      {/* 왼쪽 목록을 접어도 어느 평가룸에서 작업 중인지 보이도록 */}
      <div className="room-context">
        <Icon name="folder" size={16} />
        <span><b>{project.name}</b> 평가룸{existing ? '의 발표를 수정하고 있어요.' : '에 새 발표를 등록하고 있어요.'}</span>
      </div>
      <div className="card stack portal-form presentation-fields">
        <Field label="발표 제목"><input value={f.title} maxLength={300} placeholder="예: 쿠버네티스 비용 최적화 사례" onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="간단한 소개"><textarea rows={3} value={f.intro} maxLength={5000} placeholder="어떤 내용을 발표하나요?" onChange={e => setF({ ...f, intro: e.target.value })} /></Field>
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
          <input type="url" inputMode="url" value={f.deployUrl} maxLength={500} placeholder="https://" className={urlInvalid ? 'invalid' : ''}
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
          <li><span className="crew-label lead">대표</span>꼭 1명 필요해요. 나머지 구성원은 팀원으로 고르세요.</li>
          <li>등록하면 고른 구성원 모두 이 발표로 등록돼요. 한 사람은 발표 하나에만 참여할 수 있어서, 다른 발표에 등록된 사람은 고를 수 없어요.</li>
        </ul>
        {locked && <div className="notice"><Icon name="lock" size={15} />점수를 받은 발표라 역할만 바꿀 수 있어요.</div>}

        {!fromMyTeam && people.length > 6 && (
          <label className="board-search crew-search">
            <input placeholder="이름·팀 검색" value={crewQuery} onChange={e => setCrewQuery(e.target.value)} aria-label="구성원 검색" />
            <Icon name="search" size={16} />
          </label>
        )}
        <div className="crew-table">
          <div className="crew-head"><span>이름</span><span>팀</span><span>역할</span></div>
          {crewKey && shownPeople.length === 0 && <div className="bempty">'{crewQuery.trim()}'에 맞는 참여자가 없어요.</div>}
          {shownPeople.map(p => {
            const roles = rolesOf(p.userId);
            const role = roles[0] ?? null;
            return (
              <div key={p.userId} className={`crew-line ${role === 'LEADER' ? 'leader' : role ? 'picked' : ''}`}>
                <span className="cl-name">
                  {p.userId === me.id ? <b>{userName(db, p.userId)}</b> : userName(db, p.userId)}
                  {userOf(db, p.userId)?.position && <small className="muted">{userOf(db, p.userId)!.position}</small>}
                  {p.userId === me.id && <small className="muted">(나)</small>}
                  {roles.map(r => <span key={r} className={`crew-label ${ROLE_CLASS[r]}`}>{ROLE_TEXT[r]}</span>)}
                  {takenBy(p.userId) && <small className="muted">· '{takenBy(p.userId)!.title}' 발표에 등록됨</small>}
                </span>
                <span className="cl-team">{p.teamNameAtJoin ?? teamName(db, p.teamIdAtJoin)}</span>
                <span className="cl-role"><RoleSeg value={roles} options={options} onChange={v => setRole(p.userId, v)} isDisabled={disabledFor(p.userId)} /></span>
              </div>
            );
          })}
          {fromMyTeam && people.length <= 1 && <div className="bempty">같은 팀의 다른 참여자가 없어요. 직접 고르기로 다른 참여자를 고를 수 있어요.</div>}
        </div>
        <span className="hint">
          {fromMyTeam ? `${teamName(db, myTeam)} 참여자를 불러왔어요. 등록하는 나는 대표, 나머지는 팀원으로 먼저 선택돼요. 대표는 다른 사람으로 바꿀 수 있어요.` : '평가룸 참여자 누구나 고를 수 있어요.'}
        </span>
      </div>}

      <div className="card stack">
        <h2>구성원 확인</h2>
        <span className="hint">아래 사람들이 이 발표로 각각 평가를 받아요. 저장하기 전에 빠진 사람이 없는지 확인하세요.</span>
        {leaderId ? <Presenters db={db} project={project} pres={crewDraft} /> : <p className="muted">대표를 선택하면 구성원이 여기에 보여요.</p>}
        {problems.map(t => <div key={t} className="error"><Icon name="ban" size={15} />{t}</div>)}
        <button className="btn primary solid" disabled={problems.length > 0 || saving} onClick={save}>
          <IconText icon="check">{saving ? '저장 중…' : existing ? '변경 사항 저장' : '발표 등록'}</IconText>
        </button>
      </div>

      {existing && (
        <div className="card danger-zone stack">
          <h3>발표 삭제</h3>
          {m.isAdmin || !existing.hasRatings ? (
            <ConfirmButton label="이 발표 삭제" confirmLabel="삭제"
              detail={m.isAdmin
                ? (ratingCount ? `제출된 평가 ${ratingCount}건이 함께 삭제되고 결과가 다시 계산됩니다.` : '제출된 평가가 없습니다.')
                : '발표와 올린 자료가 모두 삭제되고 되돌릴 수 없습니다.'}
              onConfirm={() => run(() => mutate(deletePresentation(project.id, existing.id)), '발표를 삭제했습니다.').then(ok => ok && nav(back))} />
          ) : (
            <p className="muted">점수를 받은 발표는 룸 관리자만 삭제할 수 있습니다.</p>
          )}
        </div>
      )}
    </ProjectShell>
  );
}
