// 설정: 기본 정보(이름·설명), 점수 입력 범위, 평가 규칙, 표시, 평가 마감. 집계 기준 범위·집계에 넣을 점수는 결과 현황에서 순위를 보면서 정한다
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../../shared/icons/Icon';
import { ConfirmButton, Field, IconText, SectionTitle, run, toast } from '../../../../shared/ui';
import { ratingsBlockedBy } from '../../../ratings';
import { presentationOfUser } from '../../../presentations';
import { mutate, refresh, useSession } from '../../../session';
import { closeProject, deleteProject, updateProjectInfo, updateSettings } from '../../api/projects.api';
import { members } from '../../model/access';
import { rangeChanged, validateSettings } from '../../model/settings';
import type { Project, Settings } from '../../model/types';

function Toggle({ checked, disabled, onChange, title, desc }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; title: string; desc?: string }) {
  return (
    <label className="toggle-row">
      <div className="grow"><div className="toggle-title">{title}</div>{desc && <div className="hint">{desc}</div>}</div>
      <span className="switch"><input type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
    </label>
  );
}

/** 평가룸 기본 정보(이름·설명). 평가 설정과 따로 저장한다 (평가에 영향 없음). 마감 후에는 바꿀 수 없다 */
function InfoSection({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [saving, setSaving] = useState(false);
  // 저장되거나 다른 곳에서 바뀌면 입력칸을 맞춘다
  useEffect(() => { setName(project.name); setDesc(project.description); }, [project.name, project.description]);
  const open = project.status === 'OPEN';
  const dirty = name.trim() !== project.name || desc.trim() !== project.description;
  const err = !name.trim() ? '평가룸 이름을 입력해 주세요.' : null;
  const save = async () => {
    setSaving(true);
    await run(() => mutate(updateProjectInfo(project.id, name, desc)), '기본 정보를 저장했어요.');
    setSaving(false);
  };
  return (
    <section className="card stack">
      <SectionTitle icon="pencil" title="기본 정보" />
      <Field label="평가룸 이름"><input value={name} maxLength={200} disabled={!open} onChange={e => setName(e.target.value)} placeholder="예: AI 공모전" /></Field>
      <Field label="설명 (선택)"><input value={desc} maxLength={2000} disabled={!open} onChange={e => setDesc(e.target.value)} placeholder="어떤 발표를 평가하나요?" /></Field>
      {open && (dirty || err) && (
        <div className="row gap">
          {err && <span className="err-text small">{err}</span>}
          <span className="grow" />
          <button className="btn ghost" onClick={() => { setName(project.name); setDesc(project.description); }}>되돌리기</button>
          <button className="btn primary solid" disabled={!!err || !dirty || saving} onClick={save}>
            <IconText icon="check">{saving ? '저장 중…' : '기본 정보 저장'}</IconText>
          </button>
        </div>
      )}
      {!open && <small className="muted">마감된 평가룸은 기본 정보를 바꿀 수 없어요.</small>}
    </section>
  );
}

export function SettingsTab({ project }: { project: Project }) {
  const { db } = useSession();
  const s = project.settings;
  const [f, setF] = useState({
    min: String(s.min), max: String(s.max), allowSelf: s.allowSelf, allowSameTeam: s.allowSameTeam, allowSameCrew: s.allowSameCrew, allowEdit: s.allowEdit,
    showRatingStatus: s.showRatingStatus, allowAdminRating: s.allowAdminRating, showRosterSummary: s.showRosterSummary,
    showRatingStatusNames: s.showRatingStatusNames, allowAdminPresent: s.allowAdminPresent,
  });
  const open = project.status === 'OPEN';
  // 점수 입력 범위를 바꾸면 기존 평가가 모두 지워지고 집계 기준도 '사용 안 함'으로 초기화된다
  const reset = f.min.trim() !== '' && f.max.trim() !== '' && rangeChanged(s, { min: Number(f.min), max: Number(f.max) });
  // 집계 기준은 결과 현황에서 정한 값을 그대로 보낸다 (점수 범위가 바뀌면 초기화)
  const next: Settings = {
    min: Number(f.min), max: Number(f.max), aggMin: reset ? null : s.aggMin, aggMax: reset ? null : s.aggMax,
    allowSelf: f.allowSelf, allowSameTeam: f.allowSameTeam, allowSameCrew: f.allowSameCrew, allowEdit: f.allowEdit,
    showRatingStatus: f.showRatingStatus,
    // 집계에 넣을 점수는 결과 현황에서 정한 값을 그대로 보낸다
    countSelf: s.countSelf, countSameCrew: s.countSameCrew, countSameTeam: s.countSameTeam,
    allowAdminRating: f.allowAdminRating, countAdmin: s.countAdmin,
    showRosterSummary: f.showRosterSummary,
    showRatingStatusNames: f.showRatingStatusNames,
    allowAdminPresent: f.allowAdminPresent,
  };
  const blank = [f.min, f.max].some(v => v.trim() === '');
  const err = blank ? '빈 값이 있어요.' : validateSettings(next);
  const dirty = JSON.stringify(next) !== JSON.stringify(s);
  const ratingCount = db.ratings.filter(r => r.projectId === project.id).length;
  // 평가 규칙을 '불가'로 바꾸면 새 규칙에 맞지 않게 되는 기존 평가가 지워진다 (점수 범위 변경은 전부 지워지므로 따로 셈)
  const ruleRemoved = reset || err ? 0 : ratingsBlockedBy(db, project, next).length;
  // 룸 관리자 발표를 끄면 발표에 들어 있는 룸 관리자가 발표에서 빠진다 (개인 발표면 발표가 삭제된다)
  const adminPresenters = s.allowAdminPresent && !f.allowAdminPresent
    ? members(db, project.id).filter(x => x.isAdmin && presentationOfUser(db, project.id, x.userId)) : [];
  const destructive = reset || ruleRemoved > 0 || adminPresenters.length > 0;
  const removeCount = reset ? ratingCount : ruleRemoved;
  const save = async () => {
    let removed = 0;
    // 확인한 영향(지울 평가 수)은 지금 보고 있는 version 기준이다. 그 사이 바뀌었으면 서버가 409로 거절한다
    const ok = await run(async () => { removed = await mutate(updateSettings(project.id, next, project.version)); });
    if (!ok) return;
    if (reset) {
      toast(removed ? `설정을 저장했어요. 평가 ${removed}건을 지우고 집계 기준을 초기화했어요.` : '설정을 저장했어요. 집계 기준을 초기화했어요.');
    } else toast(removed ? `설정을 저장했어요. 평가 ${removed}건을 지웠어요.` : '설정을 저장했어요.');
  };
  const num = (k: 'min' | 'max', label: string) => (
    <label className="num-field"><span>{label}</span>
      <input type="number" inputMode="numeric" step={1} disabled={!open} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack lg">
      <InfoSection project={project} />

      <section className="card stack">
        <SectionTitle icon="star" title="점수 입력 범위" />
        <div className="range-row">{num('min', '최소')}<span className="tilde">~</span>{num('max', '최대')}<span className="unit">점</span></div>
      </section>

      <section className="card stack">
        <SectionTitle icon="users" title="평가 규칙" />
        <Toggle disabled={!open} checked={f.allowSelf} onChange={v => setF({ ...f, allowSelf: v })}
          title="본인 발표 평가 허용" desc="내가 구성원인 발표(개인·팀)를 평가할 수 있어요." />
        <Toggle disabled={!open} checked={f.allowSameTeam} onChange={v => setF({ ...f, allowSameTeam: v })}
          title="같은 회사 팀 평가 허용" desc="구성원 중 나와 같은 회사 팀이 있는 발표를 평가할 수 있어요." />
        <Toggle disabled={!open} checked={f.allowEdit} onChange={v => setF({ ...f, allowEdit: v })} title="제출한 점수 수정 허용" />
      </section>

      <section className="card stack">
        <SectionTitle icon="shield" title="룸 관리자" />
        <Toggle disabled={!open} checked={f.allowAdminPresent} onChange={v => setF({ ...f, allowAdminPresent: v })}
          title="룸 관리자도 발표하기" desc="끄면 룸 관리자는 발표할 수 없고 발표 등록 인원에서 빠져요." />
        <Toggle disabled={!open} checked={f.allowAdminRating} onChange={v => setF({ ...f, allowAdminRating: v })}
          title="룸 관리자도 평가하기" desc="끄면 룸 관리자는 평가 인원·점수표에서 빠져요." />
      </section>

      <section className="card stack">
        <SectionTitle icon="eye" title="참여자에게 보이기" desc="룸 관리자는 항상 볼 수 있어요." />
        <Toggle disabled={!open} checked={f.showRosterSummary} onChange={v => setF({ ...f, showRosterSummary: v })}
          title="발표 등록 인원" desc="발표 화면 위쪽의 참여자·발표 등록·미등록 인원" />
        <Toggle disabled={!open} checked={f.showRatingStatus} onChange={v => setF({ ...f, showRatingStatus: v })}
          title="평가 현황" desc="발표별 전체·평가함·평가 불가·미평가 인원 (점수는 보이지 않아요)" />
        {/* 평가 현황을 보여 줄 때만 고를 수 있다 */}
        <div className="toggle-sub">
          <Toggle disabled={!open || !f.showRatingStatus} checked={f.showRatingStatusNames} onChange={v => setF({ ...f, showRatingStatusNames: v })}
            title="평가 현황 사람 목록" desc={f.showRatingStatus ? '평가 현황 숫자를 누르면 누구인지 보여요.' : '평가 현황을 켜야 고를 수 있어요.'} />
        </div>
      </section>

      {open && (
        <div className="save-bar">
          {err ? <div className="error"><Icon name="ban" size={15} />{err}</div>
            : destructive && <div className="notice small"><Icon name="info" size={15} />{[
                reset && `점수 범위가 바뀌어 평가 ${ratingCount}건이 모두 지워지고 집계 기준이 초기화돼요.`,
                !reset && ruleRemoved > 0 && `바뀐 평가 규칙에 맞지 않는 평가 ${ruleRemoved}건이 지워져요.`,
                adminPresenters.length > 0 && `발표에 등록된 룸 관리자 ${adminPresenters.length}명이 발표에서 빠져요 (개인 발표는 삭제).`,
              ].filter(Boolean).join(' ')}</div>}
          {destructive && !err
            ? <ConfirmButton label="변경 사항 저장" className="btn danger solid block" confirmLabel="저장"
                detail={removeCount > 0 ? `평가 ${removeCount}건이 지워지고 되돌릴 수 없어요.` : '되돌릴 수 없어요.'} onConfirm={save} />
            : <button className="btn primary solid block" disabled={!!err || !dirty} onClick={save}>
                <IconText icon="check">{dirty ? '변경 사항 저장' : '저장됨'}</IconText>
              </button>}
        </div>
      )}

      {open && (
        <section className="card danger-zone stack">
          <SectionTitle icon="flag" tone="red" title="평가 마감" desc="마감하면 다시 열 수 없어요." />
          <ConfirmButton label="평가 마감하기" confirmLabel="마감합니다" detail="마감 후에는 되돌릴 수 없어요." onConfirm={() => run(() => mutate(closeProject(project.id)), '평가를 마감했어요.')} />
        </section>
      )}

      <DeleteRoom project={project} />
    </div>
  );
}

/** 평가룸 삭제: 실수로 지우지 않도록 평가룸 이름을 그대로 입력해야 버튼이 켜진다 */
function DeleteRoom({ project }: { project: Project }) {
  const { db } = useSession();
  const nav = useNavigate();
  const [typed, setTyped] = useState('');
  const pres = db.presentations.filter(p => p.projectId === project.id).length;
  const ratings = db.ratings.filter(r => r.projectId === project.id).length;
  const people = db.memberships.filter(m => m.projectId === project.id).length;
  const remove = async () => {
    const ok = await run(() => deleteProject(project.id), `'${project.name}' 평가룸을 삭제했어요.`);
    if (!ok) return;
    nav('/', { replace: true });
    await refresh().catch(() => undefined);
  };
  return (
    <section className="card danger-zone stack">
      <SectionTitle icon="trash" tone="red" title="평가룸 삭제"
        desc={`참여자 ${people}명, 발표 ${pres}개, 평가 ${ratings}건과 올린 자료가 모두 지워지고 되돌릴 수 없어요.`} />
      <label className="field">
        <span className="field-label">확인을 위해 평가룸 이름 <b>{project.name}</b>을(를) 입력해 주세요.</span>
        <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={project.name} aria-label="삭제할 평가룸 이름" />
      </label>
      <ConfirmButton label="평가룸 삭제하기" confirmLabel="삭제합니다" disabled={typed.trim() !== project.name.trim()}
        detail="삭제한 평가룸은 되돌릴 수 없어요." onConfirm={remove} />
    </section>
  );
}
