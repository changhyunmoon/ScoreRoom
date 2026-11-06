// 발표 구성원(대표·발표자·팀원) 한 명씩 점수(필수)와 피드백(선택)을 준다. 피드백은 나와 룸 운영자만 본다
import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import type { ID } from '../../../shared/lib/types';
import { Chip, IconText, run } from '../../../shared/ui';
import { teamName, userName } from '../../organization';
import { crewOf, roleClass, roleText, type CrewRole, type Presentation } from '../../presentations';
import { membership, type Project } from '../../projects';
import { mutate, useSession } from '../../session';
import { submitRating } from '../api/ratings.api';
import { blockReason, blockText, myProgress, statusMeta, type MyStatus } from '../model/eligibility';
import { MAX_FEEDBACK_LENGTH } from '../model/types';

export function StatusBadge({ s }: { s: MyStatus }) {
  const m = statusMeta[s];
  return <Chip tone={m.tone} icon={m.icon}>{m.label}</Chip>;
}

function PersonRating({ project, pres, targetId, role }: { project: Project; pres: Presentation; targetId: ID; role: CrewRole }) {
  const { db, me } = useSession();
  const { min, max, allowEdit } = project.settings;
  const mine = db.ratings.find(r => r.presentationId === pres.id && r.targetId === targetId && r.raterId === me!.id);
  const [val, setVal] = useState<string>(mine ? String(mine.score) : '');
  const [feedback, setFeedback] = useState(mine?.feedback ?? '');
  const [editing, setEditing] = useState(!mine);
  const [saving, setSaving] = useState(false);
  // 저장된 내 평가가 바뀔 때만 입력칸을 맞춘다 (주기적으로 새로 받아도 입력 중인 값은 그대로)
  useEffect(() => {
    setEditing(!mine); setVal(mine ? String(mine.score) : ''); setFeedback(mine?.feedback ?? '');
  }, [mine?.id, mine?.score, mine?.feedback]);

  const block = blockReason(db, project, pres, me!.id, targetId);
  const closed = project.status === 'CLOSED';
  const who = (
    <div className="pr-who">
      <b>{userName(db, targetId)}</b>{targetId === me!.id && <small className="muted"> (나)</small>}
      <span className={`crew-label ${roleClass[role]}`}>{roleText[role]}</span>
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
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await run(() => mutate(submitRating(project.id, pres.id, targetId, n, feedback)),
      `${userName(db, targetId)}님 점수를 ${mine ? '수정' : '제출'}했습니다.`);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="person-rating form">
      {who}
      <div className="pr-body stack sm">
        <div className="row gap">
          {/* 숫자를 직접 입력만 한다 (휠·화살표로 값이 바뀌지 않게 type="text"를 쓴다) */}
          <input type="text" inputMode="numeric" autoComplete="off" placeholder={`${min}~${max}`}
            className={`score-input ${val !== '' && !valid ? 'invalid' : ''}`} value={val} aria-label={`${userName(db, targetId)} 점수`}
            onChange={e => setVal(e.target.value.replace(min < 0 ? /[^\d-]/g : /\D/g, ''))} onKeyDown={e => e.key === 'Enter' && valid && !tooLong && submit()} />
          <button className="btn primary solid" disabled={!valid || tooLong || saving} onClick={submit}>
            <IconText icon="check">{saving ? '저장 중…' : mine ? '수정 저장' : '제출'}</IconText>
          </button>
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

/** 발표 구성원 한 명씩 평가하는 상자. only를 주면 그 사람만 평가한다 */
export function RatingWidget({ project, pres, only }: { project: Project; pres: Presentation; only?: ID }) {
  const { db, me } = useSession();
  const { min, max, allowEdit } = project.settings;
  const { ratable, rated } = myProgress(db, project, pres, me!.id);
  const crew = crewOf(pres).filter(c => !only || c.id === only);
  return (
    <div className="rate-box people">
      <div className="rate-label">
        <Icon name="star" size={15} /> {only ? '점수' : '구성원별 점수'}{' '}
        <small className="muted">({min}~{max}점, 정수{only ? '' : ` · ${rated}/${ratable}명 평가`})</small>
      </div>
      {crew.map(c => <PersonRating key={c.id} project={project} pres={pres} targetId={c.id} role={c.role} />)}
      {!allowEdit && project.status === 'OPEN' && <small className="muted">제출하면 수정할 수 없어요.</small>}
    </div>
  );
}
