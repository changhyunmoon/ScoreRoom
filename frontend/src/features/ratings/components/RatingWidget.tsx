// 발표 하나에 점수(필수)와 피드백(선택)을 한 번 준다. 팀 발표도 구성원별로 주지 않는다. 피드백은 나와 룸 관리자만 본다
import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import { Chip, IconText, run } from '../../../shared/ui';
import { userName } from '../../organization';
import { crewOf, roleClass, roleText, type Presentation } from '../../presentations';
import type { Project } from '../../projects';
import { mutate, useSession } from '../../session';
import { submitRating } from '../api/ratings.api';
import { blockReason, blockText, myRating, statusMeta, type MyStatus } from '../model/eligibility';
import { MAX_FEEDBACK_LENGTH } from '../model/types';

export function StatusBadge({ s }: { s: MyStatus }) {
  const m = statusMeta[s];
  return <Chip tone={m.tone} icon={m.icon}>{m.label}</Chip>;
}

/** 이 발표의 구성원 (팀 발표면 대표·팀원 모두). 점수는 발표에 한 번 준다 */
function CrewLine({ pres }: { pres: Presentation }) {
  const { db, me } = useSession();
  return (
    <div className="pr-who">
      <b>{pres.title}</b>
      {crewOf(pres).map(c => (
        <span key={c.id} className="row gap-sm">
          <span className={`crew-label ${roleClass[c.role]}`}>{roleText[c.role]}</span>
          <small>{userName(db, c.id)}{c.id === me!.id && <span className="muted"> (나)</span>}</small>
        </span>
      ))}
    </div>
  );
}

/** 발표 하나를 평가하는 상자 */
export function RatingWidget({ project, pres }: { project: Project; pres: Presentation }) {
  const { db, me } = useSession();
  const { min, max, allowEdit } = project.settings;
  const mine = myRating(db, pres, me!.id);
  const [val, setVal] = useState<string>(mine ? String(mine.score) : '');
  const [feedback, setFeedback] = useState(mine?.feedback ?? '');
  const [editing, setEditing] = useState(!mine);
  const [saving, setSaving] = useState(false);
  // 저장된 내 평가가 바뀔 때만 입력칸을 맞춘다 (주기적으로 새로 받아도 입력 중인 값은 그대로)
  useEffect(() => {
    setEditing(!mine); setVal(mine ? String(mine.score) : ''); setFeedback(mine?.feedback ?? '');
  }, [mine?.id, mine?.score, mine?.feedback]);

  const block = blockReason(db, project, pres, me!.id);
  const closed = project.status === 'CLOSED';
  const team = pres.type === 'TEAM';
  const who = <CrewLine pres={pres} />;

  let body: React.ReactNode;
  if (mine && (!editing || closed || block)) {
    body = (
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
  } else if (block) {
    body = <div className="person-rating blocked">{who}<div className="pr-body muted small"><Icon name="lock" size={14} /> {blockText[block]}</div></div>;
  } else if (closed) {
    body = <div className="person-rating blocked">{who}<div className="pr-body muted small"><Icon name="ban" size={14} /> 평가 안 함 · 평가가 마감됐어요.</div></div>;
  } else {
    const n = Number(val);
    const valid = val !== '' && Number.isInteger(n) && n >= min && n <= max;
    const tooLong = feedback.length > MAX_FEEDBACK_LENGTH;
    const submit = async () => {
      if (saving) return;
      setSaving(true);
      const ok = await run(() => mutate(submitRating(project.id, pres.id, n, feedback)),
        `'${pres.title}' 발표 점수를 ${mine ? '수정' : '제출'}했어요.`);
      setSaving(false);
      if (ok) setEditing(false);
    };
    body = (
      <div className="person-rating form">
        {who}
        <div className="pr-body stack sm">
          <div className="row gap">
            {/* 숫자를 직접 입력만 한다 (휠·화살표로 값이 바뀌지 않게 type="text"를 쓴다) */}
            <input type="text" inputMode="numeric" autoComplete="off" placeholder={`${min}~${max}`}
              className={`score-input ${val !== '' && !valid ? 'invalid' : ''}`} value={val} aria-label={`${pres.title} 점수`}
              onChange={e => setVal(e.target.value.replace(min < 0 ? /[^\d-]/g : /\D/g, ''))} onKeyDown={e => e.key === 'Enter' && valid && !tooLong && submit()} />
            <button className="btn primary solid" disabled={!valid || tooLong || saving} onClick={submit}>
              <IconText icon="check">{saving ? '저장 중…' : mine ? '수정 저장' : '제출'}</IconText>
            </button>
            {mine && <button className="btn ghost" onClick={() => setEditing(false)}>취소</button>}
          </div>
          <textarea className={`pr-feedback-input ${tooLong ? 'invalid' : ''}`} rows={2} value={feedback} placeholder="피드백 (선택) · 룸 관리자만 볼 수 있어요"
            aria-label={`${pres.title} 피드백`} onChange={e => setFeedback(e.target.value)} />
          <div className="row between small">
            {val !== '' && !valid ? <span className="err-text">{min}~{max} 사이의 정수를 입력해 주세요.</span> : <span />}
            <span className={tooLong ? 'err-text' : 'muted'}>{feedback.length}/{MAX_FEEDBACK_LENGTH}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rate-box people">
      <div className="rate-label">
        <Icon name="star" size={15} /> 발표 점수{' '}
        <small className="muted">({min}~{max}점, 정수{team ? ' · 팀 발표는 구성원별이 아니라 발표에 한 번 줘요' : ''})</small>
      </div>
      {body}
      {!allowEdit && project.status === 'OPEN' && <small className="muted">제출하면 수정할 수 없어요.</small>}
    </div>
  );
}
