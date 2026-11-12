// 시스템 관리자: 접속 현황. 지금 로그인해 있는 사람을 보여 준다 (보기만).
// 화면이 열려 있으면 15초마다 서버에 확인 요청을 보내므로, 마지막 활동이 1분 이내면 '보는 중', 그보다 오래면 '자리 비움'이다.
// 30분 동안 아무 요청이 없으면 로그인이 만료되어 목록에서 빠진다.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import { timeText } from '../../../shared/lib/format';
import { Chip, run } from '../../../shared/ui';
import { fetchOnlineUsers, type OnlineUsers } from '../api/online.api';

const REFRESH_MS = 15_000;

/** 12초 전, 5분 전, 1시간 3분 전 */
function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
}

/** 브라우저 정보를 짧게: "Chrome · Windows" */
function shortAgent(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Whale\//.test(ua) ? 'Whale' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '기타 브라우저';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

export default function SysOnlinePage() {
  const [data, setData] = useState<OnlineUsers | null>(null);
  const [q, setQ] = useState('');
  const [withIdle, setWithIdle] = useState(true);
  const load = useCallback(() => run(async () => setData(await fetchOnlineUsers())), []);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const users = data?.users ?? [];
  const activeCount = users.filter(u => u.active).length;
  const kw = q.trim().toLowerCase();
  const list = users
    .filter(u => withIdle || u.active)
    .filter(u => !kw || [u.name, u.loginId, u.teamName ?? '', u.position ?? ''].some(v => v.toLowerCase().includes(kw)));

  return (
    <div className="stack lg sys-admin-page">
      <div className="page-head">
        <h1>접속 현황</h1>
        <p className="muted">
          지금 로그인해 있는 사람이에요. 화면을 보고 있으면 '보는 중', 1분 넘게 움직임이 없으면 '자리 비움'으로 보여요.
          30분 동안 활동이 없으면 로그인이 끝나 목록에서 빠져요. 15초마다 자동으로 새로 고침해요.
        </p>
      </div>

      <div className="online-summary">
        <span><i className="online-dot on" />지금 보는 중 <b>{data ? activeCount : '–'}</b>명</span>
        <span><i className="online-dot" />자리 비움 <b>{data ? users.length - activeCount : '–'}</b>명</span>
        <span className="muted">로그인 중 전체 {data ? users.length : '–'}명</span>
        <button type="button" className="btn sm" onClick={() => void load()}><Icon name="refresh" size={14} />새로 고침</button>
      </div>

      <div className="row gap wrap">
        <div className="org-search viewer-search" style={{ flex: '1 1 260px', margin: 0 }}>
          <Icon name="search" size={16} />
          <input aria-label="접속자 검색" placeholder="이름, 팀, 이메일로 검색" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <label className="log-auto"><input type="checkbox" checked={withIdle} onChange={e => setWithIdle(e.target.checked)} />자리 비움 포함</label>
      </div>

      <section className="stack">
        <h2 className="viewer-title">접속자 <span className="muted">{data ? `${list.length}명` : '불러오는 중…'}</span></h2>
        <div className="org-table-wrap">
          <table className="org-table online-table">
            <thead>
              <tr>
                <th>상태</th><th>이름</th><th className="viewer-wide">팀</th><th className="viewer-wide">이메일</th>
                <th className="viewer-wide">로그인</th><th>마지막 활동</th><th className="viewer-wide">기기</th><th className="viewer-wide">접속 위치</th>
              </tr>
            </thead>
            <tbody>
              {list.map(u => {
                const agent = shortAgent(u.userAgent);
                return (
                  <tr key={u.userId}>
                    <td><span className={`online-state ${u.active ? 'on' : ''}`}><i className={`online-dot ${u.active ? 'on' : ''}`} />{u.active ? '보는 중' : '자리 비움'}</span></td>
                    <td>
                      <strong>{u.name}</strong>{u.position && <span className="muted"> {u.position}</span>}
                      {u.sysAdmin && <> <Chip tone="violet">시스템 관리자</Chip></>}
                      <small className="viewer-sub">{[u.teamName, u.loginId, u.sessionCount > 1 ? `기기 ${u.sessionCount}대` : null].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td className="viewer-wide">{u.teamName ?? <span className="muted">-</span>}</td>
                    <td className="viewer-wide">{u.loginId}</td>
                    <td className="viewer-wide mono">{timeText(u.loginAt)}</td>
                    <td className="mono">{ago(data!.serverTime - u.lastAccessAt)}</td>
                    <td className="viewer-wide">{u.sessionCount}대</td>
                    <td className="viewer-wide" title={u.userAgent ?? undefined}>
                      {u.ip || agent ? <><span className="mono">{u.ip ?? '-'}</span>{agent && <span className="muted"> · {agent}</span>}</> : <span className="muted">-</span>}
                    </td>
                  </tr>
                );
              })}
              {data && list.length === 0 && (
                <tr><td colSpan={8} className="org-empty">{kw ? '검색 결과가 없어요.' : withIdle ? '로그인해 있는 사람이 없어요.' : '지금 화면을 보고 있는 사람이 없어요.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted small">접속 위치는 그 사람이 마지막으로 로그인할 때의 IP와 브라우저예요. 기기는 로그인해 있는 브라우저 수예요.</p>
      </section>
    </div>
  );
}
