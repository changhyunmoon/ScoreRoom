// 시스템 관리자: 전체 열람 권한 관리.
// 권한을 받은 사람은 모든 평가룸(진행 중·마감)의 발표 목록·내용·자료와 결과 집계를 볼 수 있다. 평가·등록·편집은 못 한다.
import { setViewAll } from '../api/organization.api';
import { PermissionManager } from '../components/PermissionManager';

export default function SysViewersPage() {
  return (
    <PermissionManager name="전체 열람 권한" has={u => u.canViewAll} set={setViewAll}
      desc="모든 평가룸의 발표와 결과를 볼 수 있어요 (평가·편집은 불가)." />
  );
}
