// 발표 화면 위쪽 (룸 관리자): 참여자 / 발표 등록 / 발표 미등록 인원. 누르면 해당하는 사람 목록이 팝업으로 뜨고,
// 미등록 목록에서는 사람을 골라 '발표 등록 요청' 알림을 보낼 수 있다.
import { useState } from 'react';
import { Icon, type IconName } from '../../../shared/icons/Icon';
import type { ID } from '../../../shared/lib/types';
import { Chip, IconText, Popup, run, toast } from '../../../shared/ui';
import { teamName, teamPath, userName, userOf } from '../../organization';
import { groupByTeam, members, sortByTeamStructure, type Membership, type Project } from '../../projects';
import { mutate, useSession } from '../../session';
import { requestPresentations } from '../api/presentations.api';
import { presentationOfUser, presenterRoster, presTypeText } from '../model/crew';

type Kind = 'all' | 'done' | 'todo';
const KINDS: { key: Kind; label: string; icon: IconName; tone: string }[] = [
  { key: 'all', label: '참여자', icon: 'users', tone: '' },
  { key: 'done', label: '발표 등록', icon: 'checkCircle', tone: 'ok' },
  { key: 'todo', label: '발표 미등록', icon: 'clock', tone: 'warn' },
];

export function RosterSummary({ project }: { project: Project }) {
  const { db } = useSession();
  const [popup, setPopup] = useState<Kind | null>(null);
  // 룸 관리자는 발표하지 않으므로 인원·요청 대상에서 뺀다
  const everyone = sortByTeamStructure(db, presenterRoster(db, project.id, members(db, project.id)));
  const isDone = (m: Membership) => !!presentationOfUser(db, project.id, m.userId);
  const lists: Record<Kind, Membership[]> = {
    all: everyone,
    done: everyone.filter(isDone),
    todo: everyone.filter(m => !isDone(m)),
  };
  return (
    <>
      <div className="roster-summary">
        {KINDS.map(k => (
          <button key={k.key} type="button" className={`roster-card ${k.tone}`} onClick={() => setPopup(k.key)}>
            <span className="roster-label"><Icon name={k.icon} size={15} />{k.label}</span>
            <b className="roster-value">{lists[k.key].length}<small>명</small></b>
            <span className="roster-more">목록 보기 <Icon name="right" size={13} /></span>
          </button>
        ))}
      </div>
      {popup && <RosterPopup project={project} kind={popup} list={lists[popup]} onClose={() => setPopup(null)} />}
    </>
  );
}

function RosterPopup({ project, kind, list, onClose }: { project: Project; kind: Kind; list: Membership[]; onClose: () => void }) {
  const { db, me } = useSession();
  const meta = KINDS.find(k => k.key === kind)!;
  const selectable = kind === 'todo' && project.status === 'OPEN';
  // 미등록 목록: 나(룸 관리자)는 고를 수 없다
  const candidates = list.filter(m => m.userId !== me!.id);
  const [picked, setPicked] = useState<Set<ID>>(new Set());
  const [sending, setSending] = useState(false);
  const toggle = (id: ID) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = candidates.length > 0 && candidates.every(m => picked.has(m.userId));
  const send = async () => {
    setSending(true);
    let sent = 0;
    const ok = await run(async () => { sent = await mutate(requestPresentations(project.id, [...picked])); });
    setSending(false);
    if (ok) {
      toast(sent > 0 ? `${sent}명에게 발표 등록 요청 알림을 보냈어요.` : '보낼 사람이 없어요. 그 사이 발표를 등록했을 수 있어요.');
      setPicked(new Set());
    }
  };

  return (
    <Popup label={`${meta.label} 목록`} onClose={onClose} className="roster-popup"
      head={<><Chip tone={kind === 'done' ? 'green' : kind === 'todo' ? 'amber' : 'blue'} icon={meta.icon}>{meta.label}</Chip><h2>{project.name} · {list.length}명</h2></>}
      foot={selectable ? (
        <div className="roster-foot">
          <label className="roster-pick-all">
            <input type="checkbox" checked={allPicked} disabled={!candidates.length}
              onChange={e => setPicked(e.target.checked ? new Set(candidates.map(m => m.userId)) : new Set())} />
            전체 선택
          </label>
          <span className="muted small">{picked.size}명 선택</span>
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>닫기</button>
          <button type="button" className="btn primary solid" disabled={!picked.size || sending} onClick={send}>
            <IconText icon="bell">{sending ? '보내는 중…' : `발표 등록 요청 보내기${picked.size ? ` (${picked.size}명)` : ''}`}</IconText>
          </button>
        </div>
      ) : undefined}>
      {selectable && <p className="muted small roster-hint">고른 사람에게 "발표를 등록해 달라"는 알림이 가요. 알림을 누르면 바로 발표 등록 화면으로 이동해요.</p>}
      {list.length === 0
        ? <p className="muted roster-empty">{kind === 'todo' ? '모두 발표를 등록했어요.' : '해당하는 사람이 없어요.'}</p>
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
                    const pres = presentationOfUser(db, project.id, m.userId);
                    const isMe = m.userId === me!.id;
                    const Row = selectable ? 'label' : 'div';
                    return (
                      <Row key={m.userId} className={`roster-row ${selectable && !isMe ? 'pickable' : ''}`}>
                        {selectable && <input type="checkbox" disabled={isMe} checked={picked.has(m.userId)} onChange={() => toggle(m.userId)} aria-label={`${userName(db, m.userId)} 선택`} />}
                        <span className="roster-name">
                          <b>{userName(db, m.userId)}</b>
                          {userOf(db, m.userId)?.position && <small className="muted"> {userOf(db, m.userId)!.position}</small>}
                          {isMe && <small className="muted"> (나)</small>}
                        </span>
                        {pres
                          ? <span className="roster-pres muted small">{presTypeText[pres.type]} · {pres.title}</span>
                          : <Chip icon="clock">발표 등록 전</Chip>}
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
