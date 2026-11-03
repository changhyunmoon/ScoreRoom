# 데이터 모델과 업무 규칙

UUID를 기본 ID로 사용한다. 시간은 PostgreSQL `timestamptz`/Java `Instant`로 저장하고 한국 시간은 표시·운영 정책에서 적용한다. 테이블/컬럼은 snake_case, Java/API는 camelCase다. 아래는 논리 모델이며 최종 DDL은 구현 단계의 Flyway migration으로 작성한다.

ERD 가져오기용 구체 DDL 초안은 [schema.sql](schema.sql), 가져오기 안내는 [06-erd-import.md](06-erd-import.md)를 참고한다.

## 테이블

| 테이블 | 주요 컬럼 | 제약과 의미 |
|---|---|---|
| users | id, login_id, password_hash, name, phone, team_id, position, sort_order, is_sys_admin, can_view_all, enabled | 정규화된 login_id UNIQUE; 비밀번호 평문 저장 금지 |
| teams | id, parent_id, name, sort_order | parent_id 자기 참조 FK; 순환 구조는 Service에서 차단 |
| projects | id, name, description, created_by, status, closed_at, version, score_min/max, agg_min/max, allow_self/same_team/same_crew/edit | OPEN/CLOSED; 최소<최대; 집계 범위는 모두 NULL 또는 유효 범위 |
| memberships | project_id, user_id, team_id_at_join, team_name_at_join, is_admin, joined_at | PK(project_id,user_id); 가입 당시 팀 스냅샷 |
| presentations | id, project_id, title, intro, type, leader_id, created_by, sort_order, deploy_url | PERSONAL/TEAM; 대표는 구성원 중 정확히 1명 |
| presentation_members | project_id, presentation_id, user_id, is_presenter, sort_order | PK(presentation_id,user_id); 대표+발표자 겸임 가능 |
| ratings | id, project_id, presentation_id, target_id, rater_id, score, feedback, submitted_at | UNIQUE(presentation_id,target_id,rater_id); 정수 점수, 피드백 최대 1000자 |
| invite_codes | project_id, code, issued_by, issued_at, expires_at, revoked_at | project_id PK로 현재 코드 1개; code UNIQUE |
| invitations | id, project_id, inviter_id, invitee_id, status, created_at, responded_at | PENDING/ACCEPTED/DECLINED/CANCELED |
| attachments | id, project_id, presentation_id, storage_key, original_name, size_bytes, content_type, uploaded_by, status, created_at | 임의 storage_key UNIQUE; STAGING/READY/DELETING |
| audit_events | id, actor_id, project_id, action, affected_count, created_at | 마감, 설정 변경, 권한 변경, 참여자 제거 기록 |
| file_deletion_jobs | id, storage_key, attempt_count, next_attempt_at, last_error_code, created_at | 원본 첨부/발표 삭제 후 파일 정리 재시도 |
| Spring Session 테이블 | 세션과 속성 | 선택한 Spring Session 버전의 PostgreSQL 스키마 기반 |

대표 여부는 presentations.leader_id로, 발표자 여부는 presentation_members.is_presenter로 표현한다. 대표도 구성원 테이블에 반드시 포함한다. API의 presenterIds/memberIds는 응답 변환 시 재구성한다. PERSONAL 발표는 대표 한 명만 가진다.

평가의 project_id를 중복 저장하는 경우 발표와 다른 룸을 가리키지 않도록 `(project_id,presentation_id)` 복합 FK를 둔다. 평가자/발표 구성원은 `(project_id,user_id)`로 memberships에 연결하고 평가 대상은 `(presentation_id,target_id)`로 구성원에 연결한다. 이를 위한 부모 UNIQUE 제약을 명시한다. 대표가 구성원이라는 조건은 지연 FK 또는 트랜잭션 내 검증으로 구현하며 최종 migration에서 검증한다.

## 인덱스와 삭제

- `memberships(user_id, project_id)`: 내 평가룸 목록.
- `presentations(project_id, sort_order, id)`: 발표 목록.
- `ratings(project_id, presentation_id, target_id)`: 집계; `ratings(project_id,rater_id)`: 내 평가 조회.
- `invitations(invitee_id,status,created_at)`: 받은 초대.
- `invitations(project_id,invitee_id) WHERE status='PENDING'` UNIQUE: 대기 초대 중복 방지.
- 첨부의 `(presentation_id,status)`, 세션 만료 시각 인덱스.

사용자는 기본적으로 비활성화하고 평가 이력의 FK를 보존한다. 하위 팀/소속 사용자가 있는 팀은 삭제를 거절한다. 과거 참여 스냅샷이 참조하는 팀은 보관 처리해 팀 식별자를 유지한다. 기존 목업의 팀 삭제와 달라지는 부분이다. 발표/참여자 제거는 영향 범위를 명시한 Service에서 처리하며 무조건적인 전체 cascade를 사용하지 않는다.

## 유지할 평가 규칙

1. 점수는 발표 전체가 아니라 **발표 구성원 한 명마다** 저장한다.
2. 평가자는 룸 참여자이고 룸은 OPEN이어야 한다. 시스템 관리자는 룸 참여 대상에서 제외한다.
3. 본인 평가라면 allowSelf를 먼저 판단한다. 그 외에는 같은 발표 구성원 제한, 같은 회사 팀 제한 순서로 판단한다. 같은 팀 판정은 현재 소속이 아닌 teamIdAtJoin을 사용한다. 팀이 없는 두 사람을 같은 팀으로 보지 않는다.
4. 점수는 입력 범위 내 정수이며 allowEdit=false이면 기존 평가 수정은 거절한다. 응답 손실 후 같은 제출의 재시도를 허용할지는 구현 시 명시한다. 권장안은 동일한 값이면 성공, 다른 값이면 409다(목업과의 변경점).
5. 이미 평가가 있는 발표는 구성원의 추가/제외를 금지하고 역할 변경만 허용한다.
6. 점수 입력 범위를 바꾸면 기존 룸 평가와 피드백을 모두 삭제하고 집계 범위를 NULL로 초기화한다. 다른 평가 제한을 바꾸면 새 규칙에 위반되는 평가만 삭제한다. 집계 범위만 바꾸면 원점수는 유지한다.
7. 마지막 룸 운영자는 해제/제거할 수 없다. 룸 마감 이후 평가와 일반적인 룸 데이터 변경은 거절한다.
8. 참여자 제거 시 그 사람이 준/받은 점수 삭제, 단독 발표 삭제, 공유 발표의 구성원 제거와 대표 재지정을 한 트랜잭션으로 처리한다. 새 대표는 기존 발표자 순서 → 팀원 순서로 정한다.

설정 변경/참여자 제거는 영향 건수를 먼저 조회하고 확인 후 반영하도록 API를 보완한다. version을 함께 전달해 미리보기 이후 데이터가 바뀌면 재확인을 요구한다. audit_events에는 점수/피드백 원문 대신 작업과 영향 건수를 남긴다.

## 집계 정의

각 발표 구성원별로 제출 수, 전체 평균, 설정 범위 안의 제출 수/평균을 계산한다. 미제출과 평가 불가는 0점으로 넣지 않는다. 제출이 없으면 평균은 NULL이며, 집계 범위를 사용하지 않으면 inAvg=NULL/inCount=0이다. 전체 평균은 저장된 유효 평가 전체를 사용한다. 반올림은 화면 표시에서 수행한다. 결과 계산 권위는 서버에 둔다.

## 동시성

모든 룸 쓰기 작업은 동일한 project 행을 PESSIMISTIC_WRITE로 먼저 잠근다. 잠금 순서는 project → presentation → rating/invitation 등 자식 행이다. 잠금 획득 후 상태와 권한을 다시 조회한다. 마감과 제출, 설정 변경과 제출, 구성원 변경과 제출이 서로 앞질러 처리되지 않도록 한다. 모든 수정은 project.version도 증가시켜 영향 미리보기의 유효성을 검사한다.

고유 제약은 잠금과 별도로 둔다. 서로 다른 요청의 중복 초대/가입/평가를 DB에서 최종 차단한다. 충돌/잠금 시간 초과는 정의된 409 또는 재시도 가능한 오류로 변환하고, 트랜잭션 전체를 재실행할 때만 제한적으로 재시도한다.

## 파일과 DB의 일관성

파일은 건당 50 MiB, 발표당 10개라는 현재 제한을 유지한다. 사용자 파일명을 경로로 사용하지 않고 임의 키를 쓴다. 업로드는 STAGING 메타데이터로 자리를 예약한 후 임시 파일에 스트리밍하고, 완료 시 READY로 전환한다. 발표 삭제/마감과 경합하면 READY 전환을 취소하고 임시 파일을 정리한다. 다운로드는 READY만 허용한다.

삭제는 DELETING 상태를 커밋한 뒤 실제 파일 삭제 후 메타데이터를 제거한다. 실패한 삭제와 오래된 STAGING은 재시작 시 및 주기적으로 재처리한다. DB 롤백이 파일 삭제까지 되돌린다고 가정하지 않는다. 백업은 DB와 업로드 파일을 함께 복원할 수 있어야 한다.

발표/참여자 제거처럼 부모 행도 지워야 하는 작업은 file_deletion_jobs에 저장 키를 복사하고 메타데이터/평가/발표를 같은 트랜잭션에서 삭제한다. 커밋 후 작업 테이블을 기준으로 실제 파일을 삭제한다. 이 방식으로 부모 FK를 유지하면서 파일 정리 재시도를 보장한다.
