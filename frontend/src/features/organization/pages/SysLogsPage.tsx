// 시스템 관리자: 로그 모니터링.
// 활동(평가·발표·평가룸·참여자·시스템 관리), 로그인, 요청 거절, 서버·화면 오류를 콘솔 로그처럼 한 줄씩 본다.
// 고른 필터는 주소(?cat=...&action=...)에 남겨 새로 고침·공유해도 유지한다. 로그는 30일 보관한다.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../shared/icons/Icon';
import { copyText } from '../../../shared/lib/clipboard';
import type { ID } from '../../../shared/lib/types';
import { Popup, run, toast } from '../../../shared/ui';
import { fetchAllRooms, type RoomOverview } from '../api/organization.api';
import {
  fetchLog, fetchLogActions, fetchLogs, fetchLogSummary,
  type LogActions, type LogEntry, type LogFilter, type LogSummary,
} from '../api/logs.api';

const ACTIVITY = ['RATING', 'PRESENTATION', 'PROJECT', 'MEMBER', 'SYSTEM'];
const DAY = 24 * 60 * 60 * 1000;
type Period = 'today' | '7d' | '30d' | 'custom';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: '오늘' }, { key: '7d', label: '7일' }, { key: '30d', label: '30일' }, { key: 'custom', label: '직접 선택' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayTitle = (ts: number) => `${dayKey(ts)} (${WEEK[new Date(ts).getDay()]})`;
const clock = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const fullTime = (ts: number) => `${dayKey(ts)} ${clock(ts)}.${String(new Date(ts).getMilliseconds()).padStart(3, '0')}`;
const startOfDay = (date: string) => new Date(`${date}T00:00:00`).getTime();
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

/** 주소의 값 → 조회 조건 */
function toFilter(sp: URLSearchParams): LogFilter {
  const period = (sp.get('period') as Period) ?? '7d';
  const now = Date.now();
  let from: number | null = null;
  let to: number | null = null;
  if (period === 'today') from = startOfDay(dayKey(now));
  else if (period === '7d') from = now - 7 * DAY;
  else if (period === '30d') from = now - 30 * DAY;
  else {
    if (sp.get('from')) from = startOfDay(sp.get('from')!);
    if (sp.get('to')) to = startOfDay(sp.get('to')!) + DAY;
  }
  return { categories: list(sp.get('cat')), actions: list(sp.get('action')), projectId: sp.get('project'), from, to, q: sp.get('q') ?? '' };
}

/** "7점 → 8점", "1~10 → 1~5" 같은 바뀐 값을 고정폭으로 강조한다 */
function Highlighted({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\S+) → (\S+)/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) parts.push(text.slice(at, m.index));
    parts.push(<span key={m.index} className="log-change"><span className="before">{m[1]}</span> → <b>{m[2]}</b></span>);
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** 줄 왼쪽 띠와 배지 색: 오류·경고는 등급, 그 밖은 분류 */
const tone = (e: LogEntry) => (e.level === 'ERROR' ? 'error' : e.level === 'WARN' ? 'warn' : `cat-${e.category.toLowerCase()}`);

export default function SysLogsPage() {
  const [sp, setSp] = useSearchParams();
  const [meta, setMeta] = useState<LogActions | null>(null);
  const [rooms, setRooms] = useState<RoomOverview[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [items, setItems] = useState<LogEntry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [auto, setAuto] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [tick, setTick] = useState(0);

  const key = sp.toString();
  // tick이 바뀌면(새로 고침) '오늘·7일' 기준 시각도 다시 계산한다
  const filter = useMemo(() => toFilter(sp), [key, tick]);
  const period = (sp.get('period') as Period) ?? '7d';

  const update = useCallback((changes: Record<string, string | null>) => {
    setSp(prev => {
      const p = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
      return p;
    }, { replace: true });
  }, [setSp]);

  useEffect(() => {
    void run(async () => {
      const [m, r] = await Promise.all([fetchLogActions(), fetchAllRooms()]);
      setMeta(m); setRooms(r);
    });
  }, []);

  // 검색어는 입력을 멈추면 주소에 반영한다
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get('q') ?? '') !== q.trim()) update({ q: q.trim() || null }); }, 350);
    return () => clearTimeout(t);
  }, [q, sp, update]);

  const latest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latest.current;
    const ok = await run(async () => {
      const [page, s] = await Promise.all([fetchLogs(filter, null), fetchLogSummary(filter)]);
      if (id !== latest.current) return;
      setItems(page.items); setNext(page.nextCursor); setSummary(s);
    });
    if (!ok && id === latest.current) setItems(prev => prev ?? []);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, [auto]);

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    await run(async () => {
      const page = await fetchLogs(filter, next);
      setItems(prev => [...(prev ?? []), ...page.items]); setNext(page.nextCursor);
    });
    setLoadingMore(false);
  };

  const label = useMemo(() => {
    const m = new Map<string, string>();
    meta?.categories.forEach(c => m.set(c.code, c.label));
    return m;
  }, [meta]);
  const actionLabel = useMemo(() => new Map(meta?.actions.map(a => [a.code, a.label]) ?? []), [meta]);

  const cats = filter.categories;
  const chipActions = meta?.actions.filter(a => cats.includes(a.category)) ?? [];
  const setCategories = (codes: string[], actions: string[] = []) => update({ cat: codes.join(',') || null, action: actions.join(',') || null });
  const toggleAction = (code: string) => {
    const now = filter.actions.includes(code) ? filter.actions.filter(a => a !== code) : [...filter.actions, code];
    update({ action: now.join(',') || null });
  };
  const pickRoom = (id: ID | null, name?: string | null) => update({ project: id, pname: id ? name ?? null : null });

  const s24 = summary?.last24hByCategory ?? {};
  const a24 = summary?.last24hByAction ?? {};
  const cards = [
    { key: 'server', label: '서버 오류', n: s24.SERVER_ERROR ?? 0, tone: 'error', go: () => setCategories(['SERVER_ERROR']) },
    { key: 'client', label: '화면 오류', n: s24.CLIENT_ERROR ?? 0, tone: 'error', go: () => setCategories(['CLIENT_ERROR']) },
    { key: 'rejected', label: '요청 거절', n: s24.REJECTED ?? 0, tone: 'warn', go: () => setCategories(['REJECTED']) },
    { key: 'login', label: '로그인 실패', n: (a24.LOGIN_FAILED ?? 0) + (a24.LOGIN_RATE_LIMITED ?? 0), tone: 'warn', go: () => setCategories(['AUTH'], ['LOGIN_FAILED', 'LOGIN_RATE_LIMITED']) },
    { key: 'activity', label: '활동', n: ACTIVITY.reduce((t, c) => t + (s24[c] ?? 0), 0), tone: 'info', go: () => setCategories(ACTIVITY) },
  ];
  const total = Object.values(summary?.byCategory ?? {}).reduce((t, n) => t + n, 0);
  const roomName = filter.projectId ? rooms.find(r => r.id === filter.projectId)?.name ?? sp.get('pname') ?? '(삭제된 평가룸)' : null;

  return (
    <div className="stack lg sys-admin-page sys-logs">
      <div className="page-head">
        <h1>로그</h1>
        <p className="muted">
          서버·화면 오류, 거절된 요청, 로그인, 사용자 활동을 시간순으로 봐요. 30일이 지난 기록은 자동으로 지워져요.
          {summary?.lastServerErrorAt && <> 마지막 서버 오류: <span className="mono">{fullTime(summary.lastServerErrorAt).slice(0, 19)}</span></>}
        </p>
      </div>

      <LogGuide />

      <div className="log-cards" aria-label="최근 24시간">
        {cards.map(c => (
          <button key={c.key} type="button" className={`log-card ${c.tone} ${c.n > 0 ? 'has' : ''}`} onClick={c.go}>
            <span>{c.label}</span><b>{summary ? c.n.toLocaleString() : '–'}</b><small>최근 24시간</small>
          </button>
        ))}
      </div>

      <section className="log-filters">
        <div className="log-cats" role="group" aria-label="분류">
          <button type="button" className={cats.length === 0 ? 'on' : ''} onClick={() => setCategories([])}>
            전체 <span className="n">{total.toLocaleString()}</span>
          </button>
          {meta?.categories.map(c => (
            <button key={c.code} type="button" className={`${cats.includes(c.code) ? 'on' : ''} cat-${c.code.toLowerCase()}`}
              onClick={() => setCategories(cats.length === 1 && cats[0] === c.code ? [] : [c.code])}>
              {c.label} <span className="n">{(summary?.byCategory[c.code] ?? 0).toLocaleString()}</span>
            </button>
          ))}
        </div>
        {chipActions.length > 0 && (
          <div className="log-actions" role="group" aria-label="항목">
            {chipActions.map(a => (
              <label key={a.code} className={`log-action ${filter.actions.includes(a.code) ? 'on' : ''}`}>
                <input type="checkbox" checked={filter.actions.includes(a.code)} onChange={() => toggleAction(a.code)} />
                {a.label} <span className="n">{summary?.byAction[a.code] ?? 0}</span>
              </label>
            ))}
            {filter.actions.length > 0 && <button type="button" className="btn ghost sm" onClick={() => update({ action: null })}>항목 선택 해제</button>}
          </div>
        )}
        <div className="log-tools">
          <div className="segmented" role="group" aria-label="기간">
            {PERIODS.map(p => (
              <button key={p.key} type="button" className={period === p.key ? 'on' : ''}
                onClick={() => update(p.key === 'custom'
                  ? { period: 'custom', from: sp.get('from') ?? dayKey(Date.now() - 6 * DAY), to: sp.get('to') ?? dayKey(Date.now()) }
                  : { period: p.key === '7d' ? null : p.key, from: null, to: null })}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <span className="log-dates">
              <input type="date" aria-label="시작일" value={sp.get('from') ?? ''} onChange={e => update({ from: e.target.value || null })} />
              ~
              <input type="date" aria-label="종료일" value={sp.get('to') ?? ''} onChange={e => update({ to: e.target.value || null })} />
            </span>
          )}
          <select className="log-room" aria-label="평가룸" value={filter.projectId ?? ''} onChange={e => pickRoom(e.target.value || null, rooms.find(r => r.id === e.target.value)?.name)}>
            <option value="">모든 평가룸</option>
            {filter.projectId && !rooms.some(r => r.id === filter.projectId) && <option value={filter.projectId}>{roomName}</option>}
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="org-search log-search">
            <Icon name="search" size={16} />
            <input aria-label="로그 검색" placeholder="사람, 평가룸, 내용, 오류 번호" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <span className="log-refresh">
            <label className="log-auto"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />30초마다</label>
            <button type="button" className="btn sm" onClick={() => setTick(n => n + 1)}><Icon name="refresh" size={14} />새로 고침</button>
          </span>
        </div>
      </section>

      <section className="log-list" aria-label="로그 목록">
        <div className="log-row log-head" aria-hidden="true">
          <span>시간</span><span>등급</span><span>분류</span><span>사람</span><span>평가룸</span><span>내용</span><span>오류 번호</span>
        </div>
        {items === null && <div className="log-empty">불러오는 중…</div>}
        {items?.length === 0 && <div className="log-empty">조건에 맞는 기록이 없어요.</div>}
        {items?.map((e, i) => {
          const prev = items[i - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(e.createdAt);
          const sameReq = !newDay && !!e.requestId && prev?.requestId === e.requestId;
          return (
            <div key={e.id} className="log-group">
              {newDay && <div className="log-day">{dayTitle(e.createdAt)}</div>}
              <div role="button" tabIndex={0} className={`log-row ${tone(e)} ${sameReq ? 'same-req' : ''}`}
                onClick={() => setSelected(e)} onKeyDown={k => { if (k.key === 'Enter') setSelected(e); }}>
                <span className="log-time mono">{clock(e.createdAt)}</span>
                <span><span className={`log-level ${e.level.toLowerCase()}`}>{e.level}</span></span>
                <span><span className={`log-cat ${tone(e)}`} title={actionLabel.get(e.action) ?? e.action}>{label.get(e.category) ?? e.category}</span></span>
                <span className="log-actor ellipsis">{e.actorName ?? <span className="muted">-</span>}</span>
                <span className="log-room-name ellipsis">
                  {e.projectId
                    ? <button type="button" className="link-btn" title="이 평가룸 로그만 보기" onClick={ev => { ev.stopPropagation(); pickRoom(e.projectId, e.projectName); }}>{e.projectName ?? '(삭제된 평가룸)'}</button>
                    : <span className="muted">-</span>}
                </span>
                <span className="log-msg"><span className="log-action-name">{actionLabel.get(e.action) ?? e.action}</span><Highlighted text={e.message} /></span>
                <span className="log-req mono">{e.requestId ?? ''}</span>
              </div>
            </div>
          );
        })}
        {next && (
          <div className="log-more">
            <button type="button" className="btn" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? '불러오는 중…' : '더 보기'}</button>
          </div>
        )}
      </section>

      {selected && <LogDetail entry={selected} label={label.get(selected.category) ?? selected.category}
        actionLabel={actionLabel.get(selected.action) ?? selected.action} onClose={() => setSelected(null)} />}
    </div>
  );
}

const GUIDE_KEY = 'scoreroom.logGuideOpen';

/** 로그 화면 사용 안내. 펼침 상태는 이 브라우저에만 기억한다 */
function LogGuide() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(GUIDE_KEY) === '1'; } catch { return false; }
  });
  const toggle = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(GUIDE_KEY, next ? '1' : '0'); } catch { /* 저장 못 해도 동작에는 문제없다 */ }
  };
  return (
    <details className="log-guide" open={open} onToggle={e => toggle(e.currentTarget.open)}>
      <summary><Icon name="info" size={15} />로그 보는 법<span className="muted">{open ? '접기' : '펼치기'}</span></summary>
      <div className="log-guide-body">
        <section>
          <h3>무엇이 남나요</h3>
          <ul>
            <li><b>활동</b>: 평가(점수·피드백, 수정 전/후), 발표, 평가룸 설정, 참여자, 시스템 관리 작업</li>
            <li><b>로그인</b>: 성공·실패·횟수 초과·로그아웃·회원가입·비밀번호 찾기</li>
            <li><b>요청 거절</b>: 권한 없음, 입력 오류, 마감된 평가룸 변경처럼 사용자에게 안내 문구로 막은 요청</li>
            <li><b>서버 오류</b>: 처리하지 못한 오류(스택 포함), DB 충돌 · <b>화면 오류</b>: 브라우저에서 난 오류</li>
          </ul>
        </section>
        <section>
          <h3>색과 등급</h3>
          <ul>
            <li><span className="log-level error">ERROR</span> 바로 확인이 필요한 오류 (줄 배경도 빨강)</li>
            <li><span className="log-level warn">WARN</span> 거절·로그인 실패·평가 삭제처럼 살펴볼 만한 일</li>
            <li><span className="log-level info">INFO</span> 정상 활동. 왼쪽 띠 색으로 분류를 구분해요</li>
          </ul>
        </section>
        <section>
          <h3>사용자가 오류를 알려 왔을 때</h3>
          <ol>
            <li>오류 알림에 보이는 <b>오류 번호</b>(예: <span className="mono">65d3a987</span>)를 받아 검색창에 넣어요.</li>
            <li>같은 요청의 기록은 붙어서 보여요. 줄을 누르면 요청 주소·상태 코드·브라우저·스택을 볼 수 있어요.</li>
            <li>스택에서 <b>진하게</b> 보이는 줄이 ScoreRoom 코드 위치예요. 오류 번호를 복사해 개발 담당자에게 전달하세요.</li>
          </ol>
        </section>
        <section>
          <h3>찾는 방법</h3>
          <ul>
            <li>위 요약 카드를 누르면 해당 분류만 보여요. 분류를 고른 뒤 세부 항목을 여러 개 체크할 수 있어요.</li>
            <li>목록의 평가룸 이름을 누르면 그 평가룸 기록만 보여요. 고른 조건은 주소에 남아 그대로 공유할 수 있어요.</li>
          </ul>
        </section>
        <p className="muted log-guide-note">
          비밀번호·요청 본문은 남기지 않아요. 로그인 전 세션 확인(401)과 없는 주소(404)는 기록하지 않아요. 기록은 30일 보관 후 자동으로 지워져요.
        </p>
      </div>
    </details>
  );
}

/** 한 줄 상세: 요청 정보와 피드백·스택 전문 */
function LogDetail({ entry, label, actionLabel, onClose }: { entry: LogEntry; label: string; actionLabel: string; onClose: () => void }) {
  const [full, setFull] = useState<LogEntry>(entry);
  useEffect(() => {
    if (entry.detailTruncated) void run(async () => setFull(await fetchLog(entry.id)));
  }, [entry]);
  const copyId = async () => {
    if (!entry.requestId) return;
    toast(await copyText(entry.requestId) ? '오류 번호를 복사했어요.' : '복사하지 못했어요. 직접 선택해 복사해 주세요.', 'ok');
  };
  const rows: [string, ReactNode][] = [
    ['시각', <span className="mono">{fullTime(full.createdAt)}</span>],
    ['분류', `${label} · ${actionLabel}`],
    ['사람', full.actorName ?? '-'],
    ['평가룸', full.projectName ?? (full.projectId ? '(삭제된 평가룸)' : '-')],
    ['요청', full.path ? <span className="mono">{full.httpMethod} {full.path}{full.status ? ` → ${full.status}` : ''}</span> : '-'],
    ['오류 종류', full.errorType ? <span className="mono">{full.errorType}</span> : '-'],
    ['IP', full.ip ? <span className="mono">{full.ip}</span> : '-'],
    ['브라우저', full.userAgent ?? '-'],
  ];
  return (
    <Popup label="로그 상세" className="log-detail" onClose={onClose}
      head={<><span className={`log-level ${full.level.toLowerCase()}`}>{full.level}</span> <b>{actionLabel}</b></>}
      foot={<>
        {entry.requestId && <button type="button" className="btn" onClick={() => void copyId()}><Icon name="copy" size={14} />오류 번호 {entry.requestId} 복사</button>}
        <button type="button" className="btn" onClick={onClose}>닫기</button>
      </>}>
      <div className="stack">
        <p className="log-detail-msg"><Highlighted text={full.message} /></p>
        <dl className="log-fields">
          {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {full.detail && (
          <pre className="log-pre">
            {full.detail.split('\n').map((line, i) => (
              <span key={i} className={/^\s*at com\.scoreroom\./.test(line) ? 'ours' : undefined}>{line}{'\n'}</span>
            ))}
            {full.detailTruncated && '…'}
          </pre>
        )}
      </div>
    </Popup>
  );
}
