// 시스템 관리자: 전체 평가룸 목록과 삭제.
// 시스템 관리자는 평가룸 안을 보지 않으므로, 이름·관리자·인원 같은 요약만 보고 지울 평가룸을 고른다.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import { dateText } from '../../../shared/lib/format';
import type { ID } from '../../../shared/lib/types';
import { Chip, ConfirmButton, run } from '../../../shared/ui';
import { fetchAllRooms, type RoomOverview } from '../api/organization.api';
import { deleteProject } from '../../projects/api/projects.api';

export default function SysRoomsPage() {
  const [rooms, setRooms] = useState<RoomOverview[] | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => run(async () => setRooms(await fetchAllRooms())), []);
  useEffect(() => { void load(); }, [load]);

  const remove = async (id: ID, name: string) => {
    const ok = await run(() => deleteProject(id), `'${name}' 평가룸을 삭제했어요.`);
    if (ok) await load();
  };
  const kw = q.trim().toLowerCase();
  const list = (rooms ?? []).filter(r => !kw || [r.name, r.adminNames ?? '', r.creatorName ?? ''].some(v => v.toLowerCase().includes(kw)));

  return (
    <div className="stack lg sys-admin-page">
      <div className="page-head">
        <h1>평가룸 관리</h1>
        <p className="muted">삭제하면 발표·평가·자료가 모두 지워지고 되돌릴 수 없어요.</p>
      </div>
      <div className="org-search viewer-search">
        <Icon name="search" size={16} />
        <input aria-label="평가룸 검색" placeholder="평가룸 이름, 관리자, 만든 사람으로 검색" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <section className="stack">
        <h2 className="viewer-title">평가룸 <span className="muted">{rooms ? `${list.length}개` : '불러오는 중…'}</span></h2>
        <div className="org-table-wrap">
          <table className="org-table rooms-table">
            <thead><tr><th>평가룸</th><th className="viewer-wide">룸 관리자</th><th className="viewer-wide">참여자 · 발표 · 평가</th><th className="viewer-wide">만든 날</th><th /></tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong> {r.status === 'OPEN' ? <Chip tone="green">진행 중</Chip> : <Chip>마감됨</Chip>}
                    {r.description && <small className="room-desc muted">{r.description}</small>}
                    <small className="viewer-sub">관리자 {r.adminNames ?? '-'} · 참여자 {r.memberCount}명 · 발표 {r.presentationCount}개 · 평가 {r.ratingCount}건</small>
                  </td>
                  <td className="viewer-wide">{r.adminNames ?? <span className="muted">-</span>}</td>
                  <td className="viewer-wide">{r.memberCount}명 · {r.presentationCount}개 · {r.ratingCount}건</td>
                  <td className="viewer-wide">{dateText(r.createdAt)}</td>
                  <td className="right">
                    <ConfirmButton className="btn sm danger" label="삭제" confirmLabel="삭제합니다"
                      detail={`'${r.name}' 평가룸의 참여자 ${r.memberCount}명, 발표 ${r.presentationCount}개, 평가 ${r.ratingCount}건이 모두 지워져요. 되돌릴 수 없어요.`}
                      onConfirm={() => void remove(r.id, r.name)} />
                  </td>
                </tr>
              ))}
              {rooms && list.length === 0 && <tr><td colSpan={5} className="org-empty">{kw ? '검색 결과가 없어요.' : '평가룸이 없어요.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
