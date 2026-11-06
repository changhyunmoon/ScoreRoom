// 발표 관리: 발표 순서(드래그·▲▼), 유형·발표자, 자료 수, 평가함/미평가 수, 편집·삭제. 글꼴·색은 발표 화면과 같다
import { Link } from 'react-router-dom';
import { Icon } from '../../../../shared/icons/Icon';
import { Chip, ConfirmButton, IconText, run } from '../../../../shared/ui';
import { userName } from '../../../organization';
import { deletePresentation, involvedIds, movePresentation, presTypeText, presentationsOf, reorderPresentations } from '../../../presentations';
import { computeResults } from '../../../results';
import { mutate, useSession } from '../../../session';
import type { Project } from '../../model/types';
import { useDragReorder } from './useDragReorder';

export function RunTab({ project }: { project: Project }) {
  const { db } = useSession();
  const list = presentationsOf(db, project.id);
  const open = project.status === 'OPEN';
  const results = computeResults(db, project);
  const { drag, cardRef, onPointerDown, cardStyle } = useDragReorder(list.map(p => p.id),
    ids => run(() => mutate(reorderPresentations(project.id, ids)), '발표 순서를 변경했습니다.'));

  return (
    <div className="stack lg">
      <section className="stack">
        <div className="board-tools">
          <span className="bt-title">발표 순서 <b>{list.length}</b></span>
          <span className="muted small grow">{open ? '행을 끌거나 ▲▼ 버튼으로 순서를 바꿔요. 모바일은 길게 누른 뒤 끌어요.' : '마감된 평가룸의 발표 순서예요.'}</span>
          {open && <Link to={`/p/${project.id}/pres/new`} className="btn primary"><IconText icon="plus">발표 추가</IconText></Link>}
        </div>
        <div className="btable admin">
          <div className="bhead">
            <span className="c-no">순서</span><span className="c-title">발표 제목</span><span className="c-type">유형</span><span className="c-who">발표자</span>
            <span className="c-state">발표 자료</span><span className="c-done">평가함</span><span className="c-todo">미평가</span><span className="c-act">관리</span>
          </div>
          {list.length === 0 && <div className="bempty">등록된 발표가 없습니다. 참여자가 등록하거나 직접 추가할 수 있어요.</div>}
          {list.map((p, i) => {
            // 발표 구성원 전원의 합: 제출된 점수 수 / 아직 안 준 점수 수
            const crewRows = results.filter(x => x.pres.id === p.id);
            const count = crewRows.reduce((a, x) => a + x.count, 0);
            const notRated = crewRows.reduce((a, x) => a + x.cells.filter(c => c.kind === 'NOT_RATED').length, 0);
            const others = involvedIds(p).length - 1;
            return (
              <div key={p.id} ref={cardRef(p.id)} style={cardStyle(i)}
                onPointerDown={open ? e => onPointerDown(e, i) : undefined}
                className={`arow ${open ? 'draggable' : ''} ${drag?.from === i ? 'drag-active' : ''}`}>
                <span className="c-no">
                  {open && <span className="grip" title="끌어서 순서 변경"><Icon name="grip" size={16} /></span>}
                  <b>{p.order}</b>
                  {open && (
                    <span className="mini-arrows">
                      <button disabled={i === 0} onClick={() => run(() => mutate(movePresentation(project.id, p.id, -1)))} aria-label="한 칸 위로" title="한 칸 위로"><Icon name="up" size={12} /></button>
                      <button disabled={i === list.length - 1} onClick={() => run(() => mutate(movePresentation(project.id, p.id, 1)))} aria-label="한 칸 아래로" title="한 칸 아래로"><Icon name="down" size={12} /></button>
                    </span>
                  )}
                </span>
                <span className="c-title">
                  <span className="t">{p.title}</span>
                  <span className="t-sub">{presTypeText[p.type]} · {userName(db, p.leaderId)}{others > 0 ? ` 외 ${others}명` : ''}</span>
                </span>
                <span className="c-type">{presTypeText[p.type]}</span>
                <span className="c-who ellipsis"><b>{userName(db, p.leaderId)}</b>{others > 0 && <small className="muted"> 외 {others}명</small>}</span>
                <span className="c-state">{p.attachments.length ? <Chip tone="blue" icon="paperclip">{p.attachments.length}개</Chip> : <span className="muted">-</span>}</span>
                <span className="c-done"><b className={count ? 'ok' : 'zero'}>{count}</b></span>
                <span className="c-todo"><b className={notRated ? 'red' : 'zero'}>{notRated}</b></span>
                <span className="c-act">
                  {open && <>
                    <Link to={`/p/${project.id}/pres/${p.id}`} className="btn sm" title="편집"><Icon name="pencil" size={15} /></Link>
                    <ConfirmButton className="btn sm danger" label="삭제" confirmLabel="삭제"
                      detail={count ? `평가 ${count}건이 함께 삭제됩니다.` : '제출된 평가가 없습니다.'}
                      onConfirm={() => run(() => mutate(deletePresentation(project.id, p.id)), '발표를 삭제했습니다.')} />
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
