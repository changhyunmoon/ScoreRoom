// 접속 현황: 이 평가룸 참여자 전원을 보여 주고, 지금 접속 중인지 표시한다 (보기만). 15초마다 새로 고친다.
// 접속 중 = 로그인해 있음(30분 동안 활동이 없으면 로그인이 끝나 '접속 안 함'이 된다)
import { useCallback, useEffect, useState } from 'react';
import { Chip, run } from '../../../../shared/ui';
import { fetchRoomOnline, type RoomOnlineMember } from '../../api/projects.api';
import type { Project } from '../../model/types';

const REFRESH_MS = 15_000;

type View = 'all' | 'online';
const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'online', label: '접속 중' },
];

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
}

export function OnlineTab({ project }: { project: Project }) {
  const [data, setData] = useState<{ serverTime: number; members: RoomOnlineMember[] } | null>(null);
  const [view, setView] = useState<View>('all');
  const load = useCallback(() => run(async () => setData(await fetchRoomOnline(project.id))), [project.id]);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const all = data?.members ?? [];
  const onlineCount = all.filter(u => u.online).length;
  const list = view === 'online' ? all.filter(u => u.online) : all;
  return (
    <section className="stack">
      <div className="online-summary">
        <span><i className="online-dot on" />접속 중 <b>{data ? onlineCount : '–'}</b>명</span>
        <span><i className="online-dot off" />접속 안 함 <b>{data ? all.length - onlineCount : '–'}</b>명</span>
        <span className="muted">전체 참여자 {data ? all.length : '–'}명</span>
      </div>

      <div className="board-tools">
        <span className="tool-group"><span className="muted small">보기</span>
          <div className="segmented" role="group" aria-label="접속 상태로 보기">
            {VIEWS.map(v => (
              <button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
                {v.label}{data && <span className="muted"> {v.key === 'online' ? onlineCount : all.length}</span>}
              </button>
            ))}
          </div>
        </span>
      </div>

      <div className="org-table-wrap">
        <table className="org-table online-table">
          <thead><tr><th>접속</th><th>이름</th><th className="viewer-wide">팀</th><th>마지막 활동</th></tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.userId}>
                <td>
                  <span className={`online-state ${u.online ? 'on' : ''}`}>
                    <i className={`online-dot ${u.online ? 'on' : 'off'}`} />
                    {u.online ? '접속 중' : '접속 안 함'}
                  </span>
                </td>
                <td>
                  <strong>{u.name}</strong>{u.position && <span className="muted"> {u.position}</span>}
                  {u.roomAdmin && <> <Chip tone="violet">룸 관리자</Chip></>}
                </td>
                <td className="viewer-wide">{u.teamName ?? <span className="muted">-</span>}</td>
                <td className="mono">{u.lastAccessAt != null ? ago(data!.serverTime - u.lastAccessAt) : <span className="muted">-</span>}</td>
              </tr>
            ))}
            {data && list.length === 0 && <tr><td colSpan={4} className="org-empty">
              {view === 'online' ? '지금 접속 중인 참여자가 없어요.' : '참여자가 없어요.'}
            </td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">15초마다 자동으로 새로 고쳐요. 30분 동안 활동이 없으면 로그인이 끝나 '접속 안 함'으로 바뀌어요.</p>
    </section>
  );
}
