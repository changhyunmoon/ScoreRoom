// 설정: 점수 입력 범위, 집계 기준 범위, 평가 규칙, 평가 마감
import { useState } from 'react';
import { Icon } from '../../../../shared/icons/Icon';
import { ConfirmButton, IconText, SectionTitle, run, toast } from '../../../../shared/ui';
import { ratingsBlockedBy } from '../../../ratings';
import { mutate, useSession } from '../../../session';
import { closeProject, updateSettings } from '../../api/projects.api';
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
    min: String(s.min), max: String(s.max), aggOn: s.aggMin !== null,
    aggMin: String(s.aggMin ?? s.min), aggMax: String(s.aggMax ?? s.max), allowSelf: s.allowSelf, allowSameTeam: s.allowSameTeam, allowSameCrew: s.allowSameCrew, allowEdit: s.allowEdit,
  });
  const open = project.status === 'OPEN';
  // 점수 입력 범위를 바꾸면 기존 평가가 모두 지워지고 집계 기준도 '사용 안 함'으로 초기화된다
  const reset = f.min.trim() !== '' && f.max.trim() !== '' && rangeChanged(s, { min: Number(f.min), max: Number(f.max) });
  const aggOn = f.aggOn && !reset;
  const next: Settings = {
    min: Number(f.min), max: Number(f.max), aggMin: aggOn ? Number(f.aggMin) : null, aggMax: aggOn ? Number(f.aggMax) : null,
    allowSelf: f.allowSelf, allowSameTeam: f.allowSameTeam, allowSameCrew: f.allowSameCrew, allowEdit: f.allowEdit,
  };
  const blank = [f.min, f.max, ...(aggOn ? [f.aggMin, f.aggMax] : [])].some(v => v.trim() === '');
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
      setF({ ...f, aggOn: false, aggMin: f.min, aggMax: f.max });
      toast(removed ? `설정을 저장했습니다. 평가 ${removed}건을 지우고 집계 기준을 초기화했어요.` : '설정을 저장했습니다. 집계 기준을 초기화했어요.');
    } else toast(removed ? `설정을 저장했습니다. 새 평가 규칙에 맞지 않는 평가 ${removed}건을 지웠어요.` : '설정을 저장했습니다.');
  };
  const num = (k: 'min' | 'max' | 'aggMin' | 'aggMax', label: string) => (
    <label className="num-field"><span>{label}</span>
      <input type="number" inputMode="numeric" step={1} disabled={!open || ((k === 'aggMin' || k === 'aggMax') && !aggOn)} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack lg">
      <section className="card stack">
        <SectionTitle icon="star" title="점수 입력 범위" />
        <div className="range-row">{num('min', '최소')}<span className="tilde">~</span>{num('max', '최대')}<span className="unit">점</span></div>
      </section>

      <section className="card stack">
        <SectionTitle icon="sliders" title="집계 기준 범위"
          right={<span className="switch"><input type="checkbox" disabled={!open || reset} checked={aggOn} onChange={e => setF({ ...f, aggOn: e.target.checked })} aria-label="집계 기준 사용" /><span /></span>} />
        {reset ? (
          <p className="muted small">저장하면 '사용 안 함'으로 초기화돼요.</p>
        ) : f.aggOn ? (
          <div className="range-row">{num('aggMin', '최저치 (이상)')}<span className="tilde">~</span>{num('aggMax', '최대치 (이하)')}<span className="unit">점</span></div>
        ) : <p className="muted small">사용 안 함</p>}
      </section>

      <section className="card stack">
        <SectionTitle icon="users" title="평가 규칙" />
        <Toggle disabled={!open} checked={f.allowSelf} onChange={v => setF({ ...f, allowSelf: v })} title="본인 평가 허용" />
        <Toggle disabled={!open} checked={f.allowSameTeam} onChange={v => setF({ ...f, allowSameTeam: v })}
          title="같은 회사 팀 평가 허용" desc="끄면 나와 같은 회사 팀인 사람을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowSameCrew} onChange={v => setF({ ...f, allowSameCrew: v })}
          title="같은 발표 팀원 평가 허용" desc="끄면 내가 참여한 발표의 다른 구성원을 평가할 수 없어요." />
        <Toggle disabled={!open} checked={f.allowEdit} onChange={v => setF({ ...f, allowEdit: v })} title="제출한 점수 수정 허용" />
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
    </div>
  );
}
