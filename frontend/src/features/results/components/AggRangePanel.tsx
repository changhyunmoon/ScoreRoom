// 결과 현황의 집계 설정 (룸 관리자): 집계 기준 범위 + 집계에 넣을 점수(같은 회사 팀원 / 같은 발표 팀원 / 본인 / 룸 관리자).
// 바꾸면 표의 평균·순위가 바로 바뀌고(미리보기), [저장]을 눌러야 평가룸 설정에 저장되어 다른 사람에게도 반영된다.
// 점수를 빼도 지워지지는 않는다. 다시 넣으면 원래대로 돌아온다.
import { Icon } from '../../../shared/icons/Icon';
import { Chip, IconText, run, toast } from '../../../shared/ui';
import { updateSettings, validateSettings, type Project } from '../../projects';
import { mutate } from '../../session';

/** 입력 중인 값. 숫자 칸은 지우고 다시 쓸 수 있도록 문자열로 둔다 */
export interface AggDraft {
  on: boolean; min: string; max: string;
  countSelf: boolean; countSameCrew: boolean; countSameTeam: boolean; countAdmin: boolean;
}

export const draftOf = (p: Project): AggDraft => ({
  on: p.settings.aggMin !== null,
  min: String(p.settings.aggMin ?? p.settings.min),
  max: String(p.settings.aggMax ?? p.settings.max),
  countSelf: p.settings.countSelf, countSameCrew: p.settings.countSameCrew, countSameTeam: p.settings.countSameTeam,
  countAdmin: p.settings.countAdmin,
});

/** 입력값을 설정으로. 범위에 문제가 있으면 error에 안내 문구가 들어가고 범위는 저장된 값 그대로 */
export function previewSettings(p: Project, d: AggDraft): { settings: Project['settings']; error: string | null } {
  const saved = { ...p.settings, countSelf: d.countSelf, countSameCrew: d.countSameCrew, countSameTeam: d.countSameTeam, countAdmin: d.countAdmin };
  if (!d.on) return { settings: { ...saved, aggMin: null, aggMax: null }, error: null };
  if (d.min.trim() === '' || d.max.trim() === '') return { settings: saved, error: '최저치와 최대치를 모두 입력해 주세요.' };
  const next = { ...saved, aggMin: Number(d.min), aggMax: Number(d.max) };
  const error = validateSettings(next);
  return error ? { settings: { ...saved, aggMin: p.settings.aggMin, aggMax: p.settings.aggMax }, error } : { settings: next, error: null };
}

/** 저장된 집계 설정과 다른지 */
export const aggChanged = (a: Project['settings'], b: Project['settings']) =>
  a.aggMin !== b.aggMin || a.aggMax !== b.aggMax || a.countSelf !== b.countSelf || a.countSameCrew !== b.countSameCrew || a.countSameTeam !== b.countSameTeam
  || a.countAdmin !== b.countAdmin;

// '누가 준 점수인지'로 이름을 붙인다 (발표자와 가까운 사람 → 먼 사람 순)
const INCLUDE: { key: 'countSelf' | 'countSameCrew' | 'countSameTeam' | 'countAdmin'; label: string; hint: string }[] = [
  { key: 'countSelf', label: '발표자 본인이 준 점수', hint: '발표자가 자기 자신에게 준 점수' },
  { key: 'countSameCrew', label: '같은 발표 팀원이 준 점수', hint: '팀 발표에서 함께 발표한 사람끼리 준 점수' },
  { key: 'countSameTeam', label: '같은 회사 팀원이 준 점수', hint: '발표자와 같은 회사 팀인 사람이 준 점수' },
  { key: 'countAdmin', label: '룸 관리자가 준 점수', hint: '이 평가룸의 룸 관리자가 발표자에게 준 점수' },
];

/** onReset: 입력을 버리고 저장된 설정을 따른다 (되돌리기·저장 후) */
export function AggRangePanel({ project, draft, onChange, onReset }: { project: Project; draft: AggDraft; onChange: (d: AggDraft) => void; onReset: () => void }) {
  const saved = project.settings;
  const { settings: next, error } = previewSettings(project, draft);
  const dirty = aggChanged(next, saved);
  const open = project.status === 'OPEN';
  const save = async () => {
    // 집계 설정만 바꾸는 저장이라 평가는 지워지지 않는다
    const ok = await run(() => mutate(updateSettings(project.id, next, project.version)));
    if (ok) { onReset(); toast('집계 설정을 저장했어요.'); }
  };

  return (
    <section className={`agg-card ${dirty ? 'dirty' : ''}`}>
      {/* 제목 줄: 왼쪽 제목, 오른쪽 상태(저장됨 / 미리보기 중)와 저장 버튼 */}
      <div className="agg-card-head">
        <span className="agg-card-title"><Icon name="sliders" size={15} />집계 설정</span>
        <span className="agg-card-desc">평균·순위를 어떤 점수로 낼지 정해요</span>
        <span className="grow" />
        {dirty || error
          ? <Chip tone="amber" icon="eye">미리보기 중 · 저장 전</Chip>
          : <Chip tone="green" icon="check">저장됨</Chip>}
        {(dirty || error) && <button className="btn sm ghost" onClick={onReset}>되돌리기</button>}
        {open && (dirty || error) && <button className="btn sm primary solid" disabled={!dirty || !!error} onClick={save}><IconText icon="check">저장</IconText></button>}
      </div>

      <div className="agg-card-body">
        <div className="agg-item">
          <span className="agg-label">집계 기준 범위</span>
          <div className="agg-value">
            <div className="segmented sm" role="group" aria-label="집계 기준 사용">
              <button type="button" className={draft.on ? 'on' : ''} disabled={!open} onClick={() => onChange({ ...draft, on: true })}>사용</button>
              <button type="button" className={!draft.on ? 'on' : ''} disabled={!open} onClick={() => onChange({ ...draft, on: false })}>사용 안 함</button>
            </div>
            {draft.on && (
              <span className="agg-inputs">
                <input type="number" inputMode="numeric" step={1} min={saved.min} max={saved.max} disabled={!open} value={draft.min}
                  aria-label="집계 기준 최저치 (이상)" onChange={e => onChange({ ...draft, min: e.target.value })} />
                <span>~</span>
                <input type="number" inputMode="numeric" step={1} min={saved.min} max={saved.max} disabled={!open} value={draft.max}
                  aria-label="집계 기준 최대치 (이하)" onChange={e => onChange({ ...draft, max: e.target.value })} />
                <span>점</span>
              </span>
            )}
            {error && <span className="err-text small"><Icon name="ban" size={13} /> {error}</span>}
          </div>
        </div>

        {/* 평균·순위(전체·집계 기준 모두)에 넣을 점수. 평가 규칙과 상관없이 항상 고를 수 있다 */}
        <div className="agg-item top">
          <span className="agg-label">집계에 넣을 점수<small>미포함해도 점수는 지워지지 않아요</small></span>
          <div className="agg-includes">
            {/* 룸 관리자 점수는 관리자도 평가하는 평가룸에서만 고를 수 있다 */}
            {INCLUDE.filter(x => x.key !== 'countAdmin' || saved.allowAdminRating).map(x => (
              <div key={x.key} className={`agg-include ${draft[x.key] ? '' : 'off'}`}>
                <span className="agg-include-text">
                  <span className="agg-include-name">{x.label}</span>
                  <small className="agg-include-desc">{x.hint}</small>
                </span>
                <div className="segmented sm" role="group" aria-label={x.label}>
                  <button type="button" className={draft[x.key] ? 'on' : ''} disabled={!open} onClick={() => onChange({ ...draft, [x.key]: true })}>포함</button>
                  <button type="button" className={!draft[x.key] ? 'on' : ''} disabled={!open} onClick={() => onChange({ ...draft, [x.key]: false })}>미포함</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
