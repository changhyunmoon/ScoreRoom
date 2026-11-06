// 시스템 관리자: 평가룸 생성 권한 관리.
// 권한을 받은 사람만 메인 화면에 [평가룸 만들기]가 보이고 평가룸을 만들 수 있다 (서버도 같은 규칙으로 막는다).
import { setCreateRoom } from '../api/organization.api';
import { PermissionManager } from '../components/PermissionManager';

export default function SysCreatorsPage() {
  return (
    <PermissionManager name="평가룸 생성 권한" has={u => u.canCreateRoom} set={setCreateRoom}
      desc="권한을 받은 사람만 평가룸을 만들 수 있어요. 만든 사람은 그 평가룸의 룸 운영자가 돼요. 회수해도 이미 만든 평가룸은 그대로예요." />
  );
}
