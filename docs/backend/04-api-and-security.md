# API와 인증 설계

## HTTP 계약

API 기본 경로는 `/api/v1`이다. 아래 표에서는 이 접두어를 생략한다. 일반 응답은 기존 화면과 연결하기 쉽게 별도 data 래퍼 없이 반환한다. 생성은 201과 `{id}`, 일반 조회/로그인은 200, 본문 없는 변경은 204를 사용한다. 오류는 `{code,message,fieldErrors,requestId}`로 통일한다. 입력 오류 400, 인증 없음 401, 권한 없음 403, 리소스 없음 404, 상태/버전 충돌 409, 파일 초과 413, 요청 제한 429를 구분한다.

UUID는 문자열로 전달한다. 프런트엔드의 Date 계산과 호환되도록 1차 API의 시각은 epoch milliseconds를 사용한다. DB에서는 Instant로 저장한다. null과 빈 배열의 의미를 구분하고 목록 기본 페이지 크기는 20, 최대 100을 제안한다. `/state`는 아래의 전환 예외다.

## 인증 권장안

Spring Security의 서버 세션 인증을 사용하고 Spring Session JDBC로 PostgreSQL에 저장한다. 세션 ID는 Secure/HttpOnly/SameSite=Lax 쿠키로 전달한다. 로컬 HTTP 개발 프로필에서만 Secure 설정을 조정한다. 세션 비활동 만료는 30분을 초기 제안으로 하며 밤사이 만료된 세션은 아침에 다시 로그인한다.

`GET /auth/csrf`에서 CSRF 토큰을 받아 JSON 응답에 지정된 헤더 이름으로 쓰기 요청에 전달한다. 로그인·로그아웃도 보호하고 인증 전환 후 새 토큰을 다시 조회한다. 로그인 성공 시 세션 ID를 교체하며 SecurityContext가 세션 저장소에 정상 저장되도록 Spring Security 인증 흐름을 사용한다. 직접 로그인 Controller를 만들더라도 세션 고정 공격 방어와 Context 저장을 생략하지 않는다.

비밀번호는 Spring Security PasswordEncoder의 BCrypt로 저장한다. 세션 ID·비밀번호·토큰은 로그에 기록하지 않는다. 세션에는 user ID 등 최소 정보만 두고 관리자/전체 열람 권한은 서버에서 현재 값을 확인해 회수 즉시 반영한다. 비활성 계정은 접속을 거절하고 비밀번호 재설정 시 기존 세션을 폐기한다.

현재 목업의 `token` 응답 및 sessionStorage 저장은 교체 대상이다. fetch에 쿠키를 포함하고, 새로고침 시 `/me`로 인증 상태를 조회한다. 401이면 로그인 화면으로 전환하고 403은 로그인 만료로 오인하지 않는다. 브라우저에서 user ID나 관리자 여부를 보내더라도 권한 판단에 사용하지 않는다.

## 접근 권한

| 주체 | 허용 범위 |
|---|---|
| 미로그인 | 로그인, 제한된 가입용 팀 목록, CSRF, 계정 복구 요청 |
| 일반 회원 | 내 정보, 내 초대, 참여 가능한 룸 생성/입장 |
| 룸 참여자 | 해당 룸/발표/첨부 읽기, 허용된 평가, 본인이 포함된 발표 등록 |
| 발표 대표/작성자 | 해당 발표와 첨부 수정; OPEN 및 현재 참여자 조건 필요 |
| 룸 운영자 | 룸 설정, 참여자/초대, 발표 순서/삭제, 전체 평가와 피드백, 집계 |
| 전체 열람자 | 모든 룸/발표/첨부와 집계 읽기; 타인의 개별 점수/피드백은 미공개 |
| 시스템 관리자 | 계정·팀·직위·조직도 순서·전체 열람 권한 관리; 룸 참여 불가 |

권한은 단일 역할 enum으로 합치지 않는다. isSysAdmin/canViewAll은 사용자 속성, isAdmin은 룸 참여 속성이다. 전체 열람자가 특정 룸에 참여했다면 참여자로서의 평가 권한도 별도로 갖는다. 사용자 이메일/전화번호는 본인과 시스템 관리자에게만 응답한다.

## 현재 화면을 연결할 API

| 기능 | 메서드와 경로 | 요청/응답 핵심 |
|---|---|---|
| 인증 | POST `/auth/login`, POST `/auth/logout` | loginId/password → 쿠키 설정; 로그아웃 세션 폐기 |
| 가입 | POST `/auth/signup` | 사용자 기본 정보; 운영 가입 정책 확정 후 활성화 |
| 내 정보 | GET/PUT `/me` | 프로필; 비밀번호 변경은 현재 비밀번호 확인 필요 |
| 팀 | GET `/teams`, POST `/admin/teams`, PUT/DELETE `/admin/teams/{id}` | 팀명/부모; 순환·참조 검사 |
| 사용자 추가 | POST `/admin/teams/{id}/users` | 계정/이름/직위; 초기 암호 전달 방식 별도 확정 |
| 사용자 관리 | PUT `/admin/users/{id}/team`, `/position`, `/view-all` | teamId, position, enabled |
| 조직도 순서 | POST `/admin/users/{id}/move` | dir=-1 또는 1 |
| 전환용 데이터 | GET `/state` | 기존 DB 타입에 맞춘 권한 필터링 응답 |
| 룸 생성 | POST `/projects` | name/description → id; 생성자는 룸 운영자 |
| 코드 입장 | POST `/projects/join` | code → id; 기존 참여자는 중복 생성하지 않음 |
| 코드 관리 | POST/DELETE `/projects/{pid}/invite` | minutes=null 또는 1~1440 |
| 사용자 초대 | POST `/projects/{pid}/invitations` | userIds → invited |
| 초대 처리 | POST `/invitations/{id}/accept`, `/decline`, DELETE `/invitations/{id}` | 본인 수락/거절, 룸 운영자 취소 |
| 참여자 권한 | PUT `/projects/{pid}/members/{uid}/admin` | isAdmin; 마지막 운영자 보호 |
| 참여자 제거 | DELETE `/projects/{pid}/members/{uid}` | 영향 확인 및 version 전달 필요 |
| 룸 설정 | PUT `/projects/{pid}/settings` | 현재 Settings 필드 + expectedVersion → removed |
| 마감 | POST `/projects/{pid}/close` | 평가 종료와 코드 무효화 |
| 발표 | POST `/projects/{pid}/presentations`, PUT/DELETE `/projects/{pid}/presentations/{id}` | 제목/유형/대표/발표자/팀원/배포 URL |
| 발표 정렬 | PUT `/projects/{pid}/presentations/order`, POST `/projects/{pid}/presentations/{id}/move` | ids 전체 목록 또는 dir |
| 평가 | PUT `/projects/{pid}/presentations/{id}/ratings/{targetId}` | score, feedback; 평가자는 세션에서 결정 |
| 자료 업로드 | POST `/projects/{pid}/presentations/{id}/attachments` | multipart의 file 필드; 메타데이터 응답 |
| 자료 읽기/삭제 | GET/DELETE `/projects/{pid}/presentations/{id}/attachments/{aid}` | 서버에서 룸과 파일 소속 확인 |

공유 링크 결과 화면이 존재하더라도 공개 결과 API로 해석하지 않는다. 초기 결과 접근은 인증과 권한이 필요하다. 비회원 공유가 필요하면 별도의 만료/회수 가능한 공유 권한 모델을 설계한다.

## 전환 후 추가할 조회 API

- `GET /projects`: 내 룸 또는 권한에 맞는 전체 룸 목록.
- `GET /projects/{pid}`: 룸 정보와 내 접근 권한.
- `GET /projects/{pid}/presentations`: 페이지 단위 발표 목록.
- `GET /projects/{pid}/ratings/me`: 내가 제출한 평가.
- `GET /projects/{pid}/results`: 서버 집계. 개별 점수/피드백 상세는 운영자용 별도 응답.
- `GET /invitations`: 내 초대 목록.
- `POST /projects/{pid}/settings/preview`: 제안 설정에 따른 삭제 건수와 version.
- `GET /projects/{pid}/members/{uid}/removal-impact`: 참여자 제거 영향과 version.

`/state`는 초기 화면 이행용이다. 일반 사용자에게 모든 평가를 내리고 화면에서 숨기지 않는다. 개인정보, 초대 코드, 타인의 피드백을 서버에서 제거한다. 한 응답의 룸/평가/집계가 일치하도록 읽기 트랜잭션의 일관된 스냅샷을 사용한다. 각 조회 API로 전환한 뒤 `/state`와 모든 변경 후 전체 refresh를 제거한다. 초기 자동 갱신은 현재 열린 화면만 10~15초 주기로 조회하고 비활성 탭에서는 중단하는 안을 제안한다.

## 운영에서 바꿀 목업 기능

- `/auth/demo-accounts`, `/auth/demo-login`, `/demo/reset`은 운영에서 라우트 자체를 제공하지 않는다.
- 이름/전화번호만 맞추면 비밀번호를 바꾸는 `/auth/reset-password`는 구현하지 않는다. 메일의 일회성 만료 토큰 또는 검증된 관리자 복구 절차로 바꾼다. 이메일 발송 수단 확정 전에는 복구 기능을 운영에서 숨긴다.
- `/auth/find-ids`는 이름/전화번호로 계정을 노출하지 않도록 본인 확인 후 제공하는 별도 절차로 바꾼다.
- 세션 생성, 코드 추측, 복구 요청에는 사용자/IP 기준 요청 횟수 제한을 둔다.
- 첨부는 인증 후 attachment disposition으로 다운로드한다. 사용자 제공 MIME을 신뢰해 HTML 등을 같은 출처에서 실행하지 않는다. URL은 http/https만 허용하고 서버가 해당 URL을 자동으로 가져오지 않는다.

OpenAPI 계약은 구현 시 DTO와 컨트롤러 기준으로 생성해 검증하며, 운영 문서 페이지는 접근을 제한한다. 이 문서의 경로 표는 설계 초안이며 실행 가능한 OpenAPI 파일은 아니다.
