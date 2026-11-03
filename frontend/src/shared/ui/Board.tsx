// 게시판형 업무 화면의 공통 머리와 페이지 이동
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';

/** 게시판 본문 머리: 제목 + 개수 + (선택) 검색 */
export function BoardHead({ title, desc, count, countLabel = '전체', search, onSearch, right }: {
  title: ReactNode; desc?: ReactNode; count?: number; countLabel?: string; search?: string; onSearch?: (v: string) => void; right?: ReactNode;
}) {
  return (
    <div className="board-head">
      <div className="bh-row">
        <h1>{title}</h1>
        {onSearch && (
          <label className="board-search">
            <input placeholder="발표 제목·이름 검색" value={search} onChange={e => onSearch(e.target.value)} aria-label="검색" />
            <Icon name="search" size={16} />
          </label>
        )}
        {right}
      </div>
      {(desc || count !== undefined) && (
        <div className="bh-sub">
          <span className="muted">{desc}</span>
          {count !== undefined && <span className="bh-count">{countLabel} <b>{count}</b></span>}
        </div>
      )}
    </div>
  );
}

/** ‹ [1] / 2 › 페이지 이동 */
export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="이전 페이지"><Icon name="back" size={16} /></button>
      <span className="pg-cur">{page}</span><span className="pg-total">/ {total}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= total} aria-label="다음 페이지"><Icon name="right" size={16} /></button>
    </div>
  );
}
