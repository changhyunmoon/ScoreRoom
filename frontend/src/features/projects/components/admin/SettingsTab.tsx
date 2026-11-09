// 설정: 점수 입력 범위, 평가 규칙, 표시, 평가 마감. 집계 기준 범위·집계에 넣을 점수는 결과 현황에서 순위를 보면서 정한다
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../../shared/icons/Icon';
import { ConfirmButton, IconText, SectionTitle, run, toast } from '../../../../shared/ui';
import { ratingsBlockedBy } from '../../../ratings';
import { mutate, refresh, useSession } from '../../../session';
import { closeProject, deleteProject, updateSettings } from '../../api/projects.api';
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

export function SettingsTab({ project }: { project: Project }) {
  const { db } = useSession();
  const s = project.settings;
  const [f, setF] = useState({
    min: String(s.min), max: String(s.max), allowSelf: s.allowSelf, allowSameTeam: s.allowSameTeam, allowSameCrew: s.allowSameCrew, allowEdit: s.allowEdit,
    showRatingStatus: s.showRatingStatus, allowAdminRating: s.allowAdminRating, showRosterSummary: s.showRosterSummary,
    showRatingStatusNames: s.showRatingStatusNames,
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
  };
  const blank = [f.min, f.max].some(v => v.trim() === '');
  const err = blank ? '빈 값이 있습니다.' : validateSettings(next);
  const dirty = JSON.stringify(next) !== JSON.stringify(s);
  const ratingCount = db.ratings.filter(r => r.projectId === project.id).length;
  // 평가 규칙을 '불가'로 바꾸면 새 규칙에 맞지 않게 되는 기존 평가가 지워진다 (점수 범위 변경은 전부 지워지므로 따로 셈)
  const ruleRemoved = reset || err ? 0 : ratingsBlockedBy(db, project, next).length;
  const destructive = reset || ruleRemoved > 0;
  const removeCount = reset ? ratingCount : ruleRemoved;
  const save = async () => {
    let removed = 0;
    // 확인한 영향(지울 평가 수)은 지금 보고 있는 version 기준이다. 그 사이 바뀌었으면 서버가 409로 거절한다
    const ok = await run(async () => { removed = await mutate(updateSettings(project.id, next, project.version)); });
    if (!ok) return;
    if (reset) {
      toast(removed ? `설정을 저장했습니다. 평가 ${removed}건을 지우고 집계 기준을 초기화했어요.` : '설정을 저장했습니다. 집계 기준을 초기화했어요.');
    } else toast(removed ? `설정을 저장했습니다. 새 평가 규칙에 맞지 않는 평가 ${removed}건을 지웠어요.` : '설정을 저장했습니다.');
  };
  const num = (k: 'min' | 'max', label: string) => (
    <label className="num-field"><span>{label}</span>
      <input type="number" inputMode="numeric" step={1} disabled={!open} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack lg">
      <section className="card stack">
        <SectionTitle icon="star" title="점수 입력 범위" />
        <div className="range-row">{num('min', '최소')}<span className="tilde">~</span>{num('max', '최대')}<span className="unit">점</span></div>
      </section>

      <section className="card stack">
        <SectionTitle icon="users" title="평가 규칙" />
        <Toggle disabled={!open} checked={f.allowSelf} onChange={v => setF({ ...f, allowSelf: v })} title="본인 평가 허용" />
        <Toggle disabled={!open} checked={f.allowSameTeam} onChange={v => setF({ ...f, allowSameTeam: v })}
          title="같은 회사 팀 평가 허용" desc="끄면 나와 같은 회사 팀인 사람을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowSameCrew} onChange={v => setF({ ...f, allowSameCrew: v })}
          title="같은 발표 팀원 평가 허용" desc="끄면 내가 참여한 발표의 다른 구성원을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowEdit} onChange={v => setF({ ...f, allowEdit: v })} title="제출한 점수 수정 허용" />
        <Toggle disabled={!open} checked={f.allowAdminRating} onChange={v => setF({ ...f, allowAdminRating: v })}
          title="룸 관리자도 평가하기" desc="끄면 룸 관리자는 평가하지 않고, 남은 평가·평가 인원·점수표에서도 빠져요. 룸 관리자는 켜도 발표하지 않아요." />
      </section>

      <section className="card stack">
        <SectionTitle icon="eye" title="발표 화면 표시" />
        <Toggle disabled={!open} checked={f.showRosterSummary} onChange={v => setF({ ...f, showRosterSummary: v })}
          title="참여자에게 발표 등록 인원 보이기" desc="발표 화면 위쪽의 참여자·발표 등록·발표 미등록 인원과 그 목록을 보여 줘요. 끄면 룸 관리자만 볼 수 있어요. 발표 등록 요청은 켜도 룸 관리자만 보낼 수 있어요." />
        <Toggle disabled={!open} checked={f.showRatingStatus} onChange={v => setF({ ...f, showRatingStatus: v })}
          title="참여자에게 평가 현황 보이기" desc="발표 목록의 각 사람 왼쪽에 전체·평가함·평가 불가·미평가 인원을 보여 줘요. 끄면 룸 관리자만 볼 수 있어요. 평균 점수는 켜도 참여자에게 보이지 않아요." />
        {/* 평가 현황을 보여 줄 때만 고를 수 있다 */}
        <div className="toggle-sub">
          <Toggle disabled={!open || !f.showRatingStatus} checked={f.showRatingStatusNames} onChange={v => setF({ ...f, showRatingStatusNames: v })}
            title="평가 현황 사람 목록도 보이기" desc={f.showRatingStatus
              ? '참여자도 평가 현황 숫자를 누르면 평가함·평가 불가·미평가인 사람이 누구인지 볼 수 있어요. 점수는 보이지 않아요. 룸 관리자는 항상 볼 수 있어요.'
              : '참여자에게 평가 현황 보이기를 켜야 고를 수 있어요.'} />
        </div>
      </section>

      {open && (
        <div className="save-bar">
          {err ? <div className="error"><Icon name="ban" size={15} />{err}</div>
            : reset ? <div className="notice small"><Icon name="info" size={15} />저장하면 평가 {ratingCount}건이 모두 지워지고 집계 기준이 초기화돼요.</div>
            : ruleRemoved > 0 && <div className="notice small"><Icon name="info" size={15} />바뀐 평가 규칙에 맞지 않는 기존 평가 {ruleRemoved}건이 저장할 때 지워져요.</div>}
          {destructive && !err
            ? <ConfirmButton label={reset ? '변경 사항 저장 (평가 초기화)' : `변경 사항 저장 (평가 ${removeCount}건 삭제)`} className="btn danger solid block" confirmLabel={`평가 ${removeCount}건 지우고 저장`}
                detail="지운 평가는 되돌릴 수 없습니다." onConfirm={save} />
            : <button className="btn primary solid block" disabled={!!err || !dirty} onClick={save}>
                <IconText icon="check">{dirty ? '변경 사항 저장' : '저장됨'}</IconText>
              </button>}
        </div>
      )}

      {open && (
        <section className="card danger-zone stack">
          <SectionTitle icon="flag" tone="red" title="평가 마감" desc="마감하면 다시 열 수 없어요." />
          <ConfirmButton label="평가 마감하기" confirmLabel="마감합니다" detail="마감 후에는 되돌릴 수 없습니다." onConfirm={() => run(() => mutate(closeProject(project.id)), '평가를 마감했습니다.')} />
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
    const ok = await run(() => deleteProject(project.id), `'${project.name}' 평가룸을 삭제했습니다.`);
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
        detail="삭제한 평가룸은 되돌릴 수 없습니다." onConfirm={remove} />
    </section>
  );
}
