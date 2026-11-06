// 발표 정보 표시: 구성원, 발표 자료, 소개. 발표 화면과 결과 현황 팝업이 함께 쓴다
import { Icon } from '../../../shared/icons/Icon';
import { fileSize } from '../../../shared/lib/format';
import type { ID } from '../../../shared/lib/types';
import { run } from '../../../shared/ui';
import { downloadAttachment } from '../../attachments';
import { teamName, userName } from '../../organization';
import { membership, type Project } from '../../projects';
import { useSession, type DB } from '../../session';
import { involvedIds } from '../model/crew';
import type { Presentation } from '../model/types';

/** 발표 구성원을 대표 · 발표자 · 팀원으로 나눠 보여준다 */
export function Presenters({ db, project, pres }: { db: DB; project: Project; pres: Presentation }) {
  const person = (id: ID) => (
    <span key={id} className="person">
      {userName(db, id)}
      <small> · {teamName(db, membership(db, project.id, id)?.teamIdAtJoin ?? null)}</small>
    </span>
  );
  return (
    <div className="crew">
      <div className="crew-row"><span className="crew-label lead">대표</span>{person(pres.leaderId)}</div>
      {pres.presenterIds.length > 0 && <div className="crew-row"><span className="crew-label presenter">발표자</span>{pres.presenterIds.map(person)}</div>}
      {pres.memberIds.length > 0 && <div className="crew-row"><span className="crew-label member">팀원</span>{pres.memberIds.map(person)}</div>}
    </div>
  );
}

/** 발표 자료 내려받기와 배포 URL. 평가룸 참여자 누구나 볼 수 있다 */
export function PresMaterials({ project, pres }: { project: Project; pres: Presentation }) {
  if (!pres.attachments.length && !pres.deployUrl) return null;
  return (
    <div className="pres-materials">
      {pres.attachments.map(file => (
        <button key={file.id} type="button" className="material" onClick={() => run(() => downloadAttachment(project.id, pres.id, file))} title="내려받기">
          <Icon name="paperclip" size={16} />
          <span className="material-name">{file.name}</span>
          <small className="muted">{fileSize(file.size)}</small>
          <Icon name="download" size={16} />
        </button>
      ))}
      {pres.deployUrl && (
        <a className="material" href={pres.deployUrl} target="_blank" rel="noopener noreferrer" title={pres.deployUrl}>
          <Icon name="link" size={16} />
          <span className="material-name">{pres.deployUrl}</span>
        </a>
      )}
    </div>
  );
}

/** 발표 정보 표: 소개 / 구성원 / 발표 자료를 줄마다 나눠 보여준다 */
export function PresInfo({ project, pres, showMyRole }: { project: Project; pres: Presentation; showMyRole?: boolean }) {
  const { db, me } = useSession();
  const hasMaterials = pres.attachments.length > 0 || !!pres.deployUrl;
  const mine = showMyRole && me && involvedIds(pres).includes(me.id);
  return (
    <dl className="info-table">
      <div className="info-row">
        <dt>소개</dt>
        <dd>{pres.intro ? <p className="intro">{pres.intro}</p> : <span className="muted">등록된 소개가 없어요.</span>}</dd>
      </div>
      <div className="info-row">
        <dt>구성원</dt>
        <dd>
          <Presenters db={db} project={project} pres={pres} />
          {mine && (
            <div className="my-role small">
              <Icon name="user" size={14} />내 역할:
              {pres.leaderId === me!.id ? <span className="crew-label lead">대표</span>
                : pres.presenterIds.includes(me!.id) ? <span className="crew-label presenter">발표자</span>
                : <span className="crew-label member">팀원</span>}
            </div>
          )}
        </dd>
      </div>
      {hasMaterials && (
        <div className="info-row">
          <dt>발표 자료</dt>
          <dd><PresMaterials project={project} pres={pres} /></dd>
        </div>
      )}
    </dl>
  );
}
