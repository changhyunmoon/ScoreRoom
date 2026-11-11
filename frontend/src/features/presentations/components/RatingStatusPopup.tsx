// 발표 목록의 평가 현황 숫자(전체·평가·불가·미평가)를 누르면 뜨는 사람 목록.
// 룸 관리자는 항상, 참여자는 룸 관리자가 설정에서 사람 목록 보기를 켰을 때만 서버가 목록을 보내 준다.
// 미평가 목록에서 룸 관리자는 사람을 골라 '이 발표를 평가해 달라'는 알림을 보낼 수 있다 (발표 등록 요청과 같은 방식).
import { useState } from 'react';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { Chip, IconText, Popup, run, toast } from '../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../organization';
import { groupByTeam, members, membership, sortByTeamStructure, type Project } from '../../projects';
import { blockReason, blockShort, requestRatings } from '../../ratings';
import type { Summary } from '../../results';
import { mutate, useSession } from '../../session';
import { crewSummary } from '../model/crew';
import type { Presentation } from '../model/types';

export type StatKind = 'all' | 'scored' | 'blocked' | 'notRated';
const KINDS: { key: StatKind; label: string; icon: IconName; tone: string }[] = [
  { key: 'all', label: '전체', icon: 'users', tone: '' },
  { key: 'scored', label: '평가함', icon: 'checkCircle', tone: 'ok' },
  { key: 'blocked', label: '평가 불가', icon: 'lock', tone: '' },
  { key: 'notRated', label: '미평가', icon: 'clock', tone: 'warn' },
];

/** 서버가 사람 목록을 보내 줬는지 (볼 수 있는 사람에게만 온다) */
export const hasNames = (s: Summary | undefined): s is Summary & { scoredIds: ID[]; blockedIds: ID[]; notRatedIds: ID[] } =>
  !!s && !!s.scoredIds && !!s.blockedIds && !!s.notRatedIds;

export function RatingStatusPopup({ project, pres, summary, initial, onClose }: {
  project: Project; pres: Presentation; summary: Summary; initial: StatKind; onClose: () => void;
}) {
  const { db, me } = useSession();
  const [kind, setKind] = useState<StatKind>(initial);
  const [picked, setPicked] = useState<Set<ID>>(new Set());
  const [sending, setSending] = useState(false);
  if (!hasNames(summary)) return null;
  const stateOf = (id: ID): Exclude<StatKind, 'all'> =>
    summary.scoredIds.includes(id) ? 'scored' : summary.blockedIds.includes(id) ? 'blocked' : 'notRated';
  const ids: Record<StatKind, ID[]> = {
    all: [...summary.scoredIds, ...summary.blockedIds, ...summary.notRatedIds],
    scored: summary.scoredIds, blocked: summary.blockedIds, notRated: summary.notRatedIds,
  };
  // 팀 구조도 순으로 묶어서 보여 준다
  const roster = members(db, project.id);
  const list = sortByTeamStructure(db, roster.filter(m => ids[kind].includes(m.userId)));
  const badge = (id: ID) => {
    const st = stateOf(id);
    if (st === 'scored') return <Chip tone="green" icon="checkCircle">평가함</Chip>;
    if (st === 'notRated') return <Chip tone="amber" icon="clock">미평가</Chip>;
    const why = blockReason(db, project, pres, id);
    return <Chip icon="lock">불가{why ? ` · ${blockShort[why]}` : ''}</Chip>;
  };

  // 평가 요청은 룸 관리자만, 마감 전, 미평가 목록에서 보낸다. 나(룸 관리자)는 고를 수 없다
  const selectable = kind === 'notRated' && project.status === 'OPEN' && !!membership(db, project.id, me!.id)?.isAdmin;
  const candidates = list.filter(m => m.userId !== me!.id);
  const pickedNow = candidates.filter(m => picked.has(m.userId)).map(m => m.userId);
  const allPicked = candidates.length > 0 && pickedNow.length === candidates.length;
  const toggle = (id: ID) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const send = async () => {
    setSending(true);
    let sent = 0;
    const ok = await run(async () => { sent = await mutate(requestRatings(project.id, pres.id, pickedNow)); });
    setSending(false);
    if (ok) {
      toast(sent > 0 ? `${sent}명에게 '${pres.title}' 평가 요청 알림을 보냈어요.` : '보낼 사람이 없어요. 그 사이 평가했을 수 있어요.');
      setPicked(new Set());
    }
  };

  return (
    <Popup label="평가 현황 목록" onClose={onClose} className="roster-popup"
      head={<>
        <h2 className="roster-popup-title"><Icon name="users" size={18} />발표 평가 현황</h2>
        <p className="roster-room muted small" title={pres.title}>{pres.title} · {crewSummary(db, pres)}</p>
      </>}
      foot={selectable && candidates.length > 0 ? (
        <div className="roster-foot">
          <label className="roster-pick-all">
            <input type="checkbox" checked={allPicked}
              onChange={e => setPicked(e.target.checked ? new Set(candidates.map(m => m.userId)) : new Set())} />
            전체 선택
          </label>
          <span className="muted small">{pickedNow.length}명 선택</span>
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>닫기</button>
          <button type="button" className="btn primary solid" disabled={!pickedNow.length || sending} onClick={send}>
            <IconText icon="bell">{sending ? '보내는 중…' : `평가 요청 보내기${pickedNow.length ? ` (${pickedNow.length}명)` : ''}`}</IconText>
          </button>
        </div>
      ) : undefined}>
      <div className="segmented stat-tabs">
        {KINDS.map(k => (
          <button key={k.key} type="button" className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
            {k.label} {ids[k.key].length}
          </button>
        ))}
      </div>
      {selectable && candidates.length > 0 && (
        <p className="muted small roster-hint">고른 사람에게 이 발표의 평가 요청 알림이 가요.</p>
      )}
      {list.length === 0
        ? <p className="muted roster-empty">{kind === 'notRated' ? '모두 평가했어요.' : '해당하는 사람이 없어요.'}</p>
        : (
          <div className="roster-list">
            {groupByTeam(list).map(g => {
              const first = g.rows[0].item;
              return (
                <div key={`${g.teamId ?? 'none'}-${g.rows[0].index}`} className="team-box">
                  <div className="team-head">
                    <Icon name="building" size={14} />
                    <b>{first.teamNameAtJoin ?? teamName(db, first.teamIdAtJoin)}</b>
                    <span className="team-path">{teamPath(db.teams, first.teamIdAtJoin)}</span>
                    <span className="team-count">{g.rows.length}명</span>
                  </div>
                  {g.rows.map(({ item: m }) => {
                    const isMe = m.userId === me!.id;
                    const Row = selectable ? 'label' : 'div';
                    return (
                      <Row key={m.userId} className={`roster-row ${selectable && !isMe ? 'pickable' : ''}`}>
                        {selectable && <input type="checkbox" disabled={isMe} checked={picked.has(m.userId)} onChange={() => toggle(m.userId)} aria-label={`${userName(db, m.userId)} 선택`} />}
                        <span className="roster-name">
                          <b>{userName(db, m.userId)}</b>
                          {userOf(db, m.userId)?.position && <small className="muted"> {userOf(db, m.userId)!.position}</small>}
                          {isMe && <small className="muted"> (나)</small>}
                          {m.isAdmin && <small className="muted"> · 룸 관리자</small>}
                        </span>
                        {badge(m.userId)}
                      </Row>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
    </Popup>
  );
}
