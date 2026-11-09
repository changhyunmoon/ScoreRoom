// 발표 목록의 평가 현황 숫자(전체·평가·불가·미평가)를 누르면 뜨는 사람 목록.
// 룸 관리자는 항상, 참여자는 룸 관리자가 설정에서 사람 목록 보기를 켰을 때만 서버가 목록을 보내 준다.
import { useState } from 'react';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { Chip, Popup } from '../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../organization';
import { groupByTeam, members, sortByTeamStructure, type Project } from '../../projects';
import { blockReason, blockShort } from '../../ratings';
import type { Summary } from '../../results';
import { useSession } from '../../session';
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

export function RatingStatusPopup({ project, pres, targetId, summary, initial, onClose }: {
  project: Project; pres: Presentation; targetId: ID; summary: Summary; initial: StatKind; onClose: () => void;
}) {
  const { db, me } = useSession();
  const [kind, setKind] = useState<StatKind>(initial);
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
    const why = blockReason(db, project, pres, id, targetId);
    return <Chip icon="lock">불가{why ? ` · ${blockShort[why]}` : ''}</Chip>;
  };

  return (
    <Popup label="평가 현황 목록" onClose={onClose} className="roster-popup"
      head={<>
        <h2 className="roster-popup-title"><Icon name="users" size={18} />{userName(db, targetId)}님 평가 현황</h2>
        <p className="roster-room muted small" title={pres.title}>{pres.title}</p>
      </>}>
      <div className="segmented stat-tabs">
        {KINDS.map(k => (
          <button key={k.key} type="button" className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
            {k.label} {ids[k.key].length}
          </button>
        ))}
      </div>
      {list.length === 0
        ? <p className="muted roster-empty">해당하는 사람이 없어요.</p>
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
                  {g.rows.map(({ item: m }) => (
                    <div key={m.userId} className="roster-row">
                      <span className="roster-name">
                        <b>{userName(db, m.userId)}</b>
                        {userOf(db, m.userId)?.position && <small className="muted"> {userOf(db, m.userId)!.position}</small>}
                        {m.userId === me!.id && <small className="muted"> (나)</small>}
                        {m.isAdmin && <small className="muted"> · 룸 관리자</small>}
                      </span>
                      {badge(m.userId)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
    </Popup>
  );
}
