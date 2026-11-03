# SQL로 ERD 가져오기

[schema.sql](schema.sql)은 PostgreSQL용 테이블 12개(업무 11개와 파일 삭제 작업 1개)의 ERD/DDL 초안이다. CREATE TABLE, PK/FK, 고유 제약, CHECK, 인덱스와 테이블 설명을 포함한다. 운영 DB migration으로 확정된 파일은 아니다.

1. 사용할 ERD 도구에서 SQL/DDL 가져오기를 열고 DB 종류를 PostgreSQL로 선택한다.
2. schema.sql 전체를 붙여 넣거나 파일로 가져온다.
3. 가져온 테이블 12개와 외래키 관계를 확인하고 자동 배치한다.

도구가 ALTER TABLE을 지원해야 presentations의 대표와 presentation_members 간 관계가 표시된다. PostgreSQL 전용 문법인 TIMESTAMPTZ, 지연 FK, 조건부 인덱스, COMMENT를 지원하지 않는 도구는 가져오기가 실패할 수 있다. 도구가 지정되지 않았으므로 실제 도구에서의 가져오기는 아직 확인하지 않았다. 문법을 단순화한 별도 파일이 필요하면 해당 도구의 형식에 맞춰 변환한다.

## 관계를 읽는 방법

- teams는 상위/하위 팀 자기 참조이며 users의 현재 소속과 memberships의 가입 당시 소속에서 참조한다.
- users와 projects는 memberships로 다대다 관계를 갖는다.
- projects에 presentations가 속하고, presentation_members가 발표 구성원과 룸 참여자를 연결한다.
- ratings는 발표 구성원(target)과 룸 참여자(rater)를 연결한다. 발표 하나에 여러 대상과 여러 평가자가 있으므로 발표별 평가는 여러 건이다.
- projects와 invite_codes는 1 : 0..1이다. 초대 이력은 invitations에 여러 건 존재한다.
- attachments는 발표별 여러 개이며 파일 본문은 별도 디스크에 둔다.
- audit_events는 사용자/룸의 관리 작업을 기록한다.

복합 FK는 다른 룸의 발표/사용자를 잘못 연결하지 않도록 한다. ERD 도구에서 복합 FK가 여러 선으로 보이더라도 논리적으로 하나의 관계다. 테이블 생성 시에는 순환 FK를 ALTER TABLE로 마지막에 연결한다. 발표와 대표 구성원은 같은 트랜잭션에서 생성하고 커밋해야 한다.

## SQL에서 구체화한 사항

- 업무 문자열 길이 제한은 초기 제안이다. 화면과 API DTO 제한도 함께 맞춰야 한다.
- teams.archived와 created_at/updated_at을 추가해 보관 및 파일 재처리를 지원한다.
- UUID는 Java에서 생성해 전달하며 DB 확장 설치가 필요하지 않다.
- 감사 기록의 project_id는 조직 관리처럼 룸이 없는 작업을 위해 NULL을 허용한다.
- Spring Session 테이블은 라이브러리 버전 확정 후 해당 공식 스키마를 추가한다.
- file_deletion_jobs에는 삭제할 storage_key를 보존한다. 발표 삭제 시 이 작업을 만들고 평가/첨부/발표를 같은 DB 트랜잭션에서 지운 뒤 커밋 후 파일을 정리한다. 이 테이블은 원본 삭제 이후에도 남아야 하므로 원본 첨부 FK를 두지 않는다. 워커는 파일이 이미 없으면 성공으로 처리하고 작업을 제거한다. 실패하면 attempt_count와 next_attempt_at을 갱신한다. 저장 키는 재사용하지 않는다.
- 여러 행/테이블에 걸치는 업무 규칙은 CHECK로 모두 표현하지 않는다. Service의 트랜잭션/잠금과 함께 검증한다.

참고: [PostgreSQL 제약조건](https://www.postgresql.org/docs/current/ddl-constraints.html).
