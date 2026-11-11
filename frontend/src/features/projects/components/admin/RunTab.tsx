// 발표 관리: 발표 순서(드래그·▲▼), 유형·대표, 등록 시간, 평가함/미평가 수, 편집·삭제. 글꼴·색은 발표 화면과 같다.
// 보기: 발표 순서(룸 관리자가 정한 순서, 순서 변경 가능) / 등록순(확인용, 순서를 바꾸지 않는다)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../../shared/icons/Icon';
import { dateText, timeText } from '../../../../shared/lib/format';
import { ConfirmButton, IconText, run } from '../../../../shared/ui';
import { userName } from '../../../organization';
import { deletePresentation, involvedIds, movePresentation, presTypeText, presentationsOf, reorderPresentations } from '../../../presentations';
import { computeResults } from '../../../results';
import { mutate, useSession } from '../../../session';
import type { Project } from '../../model/types';
import { useDragReorder } from './useDragReorder';

type View = 'order' | 'created';

export function RunTab({ project }: { project: Project }) {
  const { db } = useSession();
  const [view, setView] = useState<View>('order');
  const ordered = presentationsOf(db, project.id);
  // 등록순은 보기만 바꾼다. 같은 시각이면 발표 순서대로
  const list = view === 'created' ? [...ordered].sort((a, b) => a.createdAt - b.createdAt || a.order - b.order) : ordered;
  const open = project.status === 'OPEN';
  // 순서 변경(끌기·▲▼)은 발표 순서 보기에서만
  const canReorder = open && view === 'order';
  const results = computeResults(db, project);
  const { drag, cardRef, onPointerDown, cardStyle } = useDragReorder(ordered.map(p => p.id),
    ids => run(() => mutate(reorderPresentations(project.id, ids)), '발표 순서를 변경했어요.'));

  return (
    <div className="stack lg">
      <section className="stack">
        <div className="board-tools">
          <span className="bt-title">발표 <b>{list.length}</b></span>
          <div className="segmented">
            <button className={view === 'order' ? 'on' : ''} onClick={() => setView('order')}>발표 순서</button>
            <button className={view === 'created' ? 'on' : ''} onClick={() => setView('created')}>등록순</button>
          </div>
          <span className="muted small grow">{view === 'created'
            ? '먼저 등록한 발표부터 보여 줘요. 확인용이라 발표 순서는 바뀌지 않아요.'
            : open ? '행을 끌거나 ▲▼ 버튼으로 순서를 바꿔요. 모바일은 길게 누른 뒤 끌어요.' : '마감된 평가룸의 발표 순서예요.'}</span>
          {open && <Link to={`/p/${project.id}/pres/new`} className="btn primary"><IconText icon="plus">발표 추가</IconText></Link>}
        </div>
        <div className="btable admin">
          <div className="bhead">
            <span className="c-no">{view === 'created' ? '등록순' : '순서'}</span><span className="c-title">발표 제목</span><span className="c-type">유형</span><span className="c-who">대표</span>
            <span className="c-reg">등록 시간</span>
            <span className="c-done">평가함</span><span className="c-todo">미평가</span><span className="c-act">관리</span>
          </div>
          {list.length === 0 && <div className="bempty">등록된 발표가 없어요. 참여자가 등록하거나 직접 추가할 수 있어요.</div>}
          {list.map((p, i) => {
            // 발표 하나의 집계: 제출된 점수 수 / 아직 안 준 인원
            const row = results.find(x => x.pres.id === p.id);
            const count = row?.count ?? 0;
            const notRated = row?.cells.filter(c => c.kind === 'NOT_RATED').length ?? 0;
            const others = involvedIds(p).length - 1;
            const registered = `${dateText(p.createdAt)} ${timeText(p.createdAt).split(' ')[1]}`;
            return (
              <div key={p.id} ref={canReorder ? cardRef(p.id) : undefined} style={canReorder ? cardStyle(i) : undefined}
                onPointerDown={canReorder ? e => onPointerDown(e, i) : undefined}
                className={`arow ${canReorder ? 'draggable' : ''} ${canReorder && drag?.from === i ? 'drag-active' : ''}`}>
                <span className="c-no">
                  {canReorder && <span className="grip" title="끌어서 순서 변경"><Icon name="grip" size={16} /></span>}
                  {view === 'created'
                    ? <><b>{i + 1}</b><small className="muted" title="룸 관리자가 정한 발표 순서">순서 {p.order}</small></>
                    : <b>{p.order}</b>}
                  {canReorder && (
                    <span className="mini-arrows">
                      <button disabled={i === 0} onClick={() => run(() => mutate(movePresentation(project.id, p.id, -1)))} aria-label="한 칸 위로" title="한 칸 위로"><Icon name="up" size={12} /></button>
                      <button disabled={i === list.length - 1} onClick={() => run(() => mutate(movePresentation(project.id, p.id, 1)))} aria-label="한 칸 아래로" title="한 칸 아래로"><Icon name="down" size={12} /></button>
                    </span>
                  )}
                </span>
                <span className="c-title">
                  <span className="t">{p.title}</span>
                  <span className="t-sub">{presTypeText[p.type]} · {userName(db, p.leaderId)}{others > 0 ? ` 외 ${others}명` : ''} · {registered} 등록</span>
                </span>
                <span className="c-type">{presTypeText[p.type]}</span>
                <span className="c-who ellipsis"><b>{userName(db, p.leaderId)}</b>{others > 0 && <small className="muted"> 외 {others}명</small>}</span>
                <span className="c-reg muted" title={registered}>{registered}</span>
                <span className="c-done"><b className={count ? 'ok' : 'zero'}>{count}</b></span>
                <span className="c-todo"><b className={notRated ? 'red' : 'zero'}>{notRated}</b></span>
                <span className="c-act">
                  {open && <>
                    <Link to={`/p/${project.id}/pres/${p.id}`} className="btn sm" title="편집"><Icon name="pencil" size={15} /></Link>
                    <ConfirmButton className="btn sm danger" label="삭제" confirmLabel="삭제"
                      detail={count ? `평가 ${count}건이 함께 삭제돼요.` : '제출된 평가가 없어요.'}
                      onConfirm={() => run(() => mutate(deletePresentation(project.id, p.id)), '발표를 삭제했어요.')} />
                  </>}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
