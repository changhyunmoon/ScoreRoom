# ScoreRoom 백엔드

Java 21 + Spring Boot 4.1 (MVC, Security, Data JPA, Session JDBC) + PostgreSQL + Flyway. 설계는 [docs/backend](../docs/backend/README.md)를 따릅니다.

## 실행

```bash
./gradlew bootRun     # local + embedded-db 프로필: 내장 PostgreSQL(포트 54329)과 가상 데이터
./gradlew test        # 통합 테스트 (내장 PostgreSQL, H2 미사용)
./gradlew bootJar     # build/libs/scoreroom-backend-0.1.0.jar (내장 PostgreSQL은 포함하지 않음)
```

이미 띄운 PostgreSQL을 쓰려면 `docker compose up -d`(이 폴더의 `compose.yaml`)로 DB를 띄운 뒤 프로필을 `local`만 켭니다.

```bash
SPRING_PROFILES_ACTIVE=local DB_URL=jdbc:postgresql://localhost:5432/scoreroom DB_USERNAME=scoreroom DB_PASSWORD=scoreroom ./gradlew bootRun
```

### 프로필과 환경변수

| 프로필 | 용도 |
|---|---|
| (기본) | 안전한 기준값: 가입 꺼짐, Secure 쿠키 |
| `local` | 로컬 개발: http 쿠키 허용, 가입 켜짐, 가상 데이터·로컬 관리자 계정 |
| `embedded-db` | 내장 PostgreSQL 실행 (개발 전용, 운영 jar에는 없음) |
| `prod` | Nginx 뒤 http 운영: 전달 헤더 사용, Secure 쿠키 끔 (`SCOREROOM_SESSION_SECURECOOKIE`로 변경) |

| 환경변수 | 설명 |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL 연결 |
| `UPLOAD_DIR` | 발표 자료 저장 폴더 (빌드 폴더 밖, 백업 대상) |
| `SCOREROOM_ADMIN_LOGIN_ID`, `SCOREROOM_ADMIN_PASSWORD` | 시스템 관리자가 없을 때 한 번 만드는 최초 관리자 |
| `SCOREROOM_SIGNUP_ENABLED` | 회원가입 허용 여부 (`prod` 기본 true, 기본 프로필 false) |
| `SCOREROOM_SESSION_SECURECOOKIE` | 세션 쿠키를 HTTPS 전용으로 (`prod` 기본 false) |

운영(EC2)에서는 이 값들을 GitHub Secrets·Variables로 관리하고 배포 때 서버에 적용합니다. [deploy/README.md](../deploy/README.md) 참고.

## 구조

기능별 패키지 안을 `controller / dto / service / domain / repository`로 나눕니다. 코드가 없는 하위 폴더는 만들지 않습니다.

```text
com.scoreroom
├── common/            # 설정, 보안(세션·CSRF·쿠키), 오류 응답, 요청 ID, 횟수 제한 (업무 규칙 없음)
├── auth/              # 로그인·로그아웃·가입·CSRF 토큰
├── user/              # 내 정보, 시스템 관리자의 사용자 관리, 최초 관리자
├── organization/      # 회사 팀 구조도
├── project/           # 평가룸, 참여자, 설정, 마감, RoomGuard(룸 쓰기의 잠금·권한 단일 진입점)
├── invitation/        # 입장 코드, 사용자 초대
├── presentation/      # 발표와 구성원, 순서, 발표 삭제(PresentationRemover)
├── rating/            # 평가 제출, 평가 가능 규칙(RatingEligibilityPolicy)
├── result/            # 결과 집계(SummaryCalculator)
├── attachment/        # 발표 자료 업로드·다운로드, 파일 삭제 작업
├── audit/             # 관리 작업 기록
├── bootstrap/         # 화면 전환용 GET /state 조립 (읽기 전용)
├── infrastructure/    # FileStorage(로컬 디스크)
└── devseed/           # local 프로필 가상 데이터
```

규칙
- 컨트롤러는 HTTP 입력·상태 코드만, 권한·업무 규칙·트랜잭션은 서비스가 맡습니다. 엔티티를 응답으로 내보내지 않고 DTO record를 씁니다.
- 평가룸 데이터를 바꾸는 작업은 모두 `RoomGuard.lockAsMember/lockAsAdmin`으로 평가룸 행을 잠그고 시작합니다. 마감·설정 변경·평가 제출이 서로 앞지르지 않고, `version`이 올라갑니다.
- 평가를 지우는 변경(점수 범위 변경, 평가 규칙 변경, 참여자 제거)은 화면이 확인한 `expectedVersion`이 지금과 같아야 합니다. 다르면 409 `VERSION_CONFLICT`.
- 오류 응답은 항상 `{ code, message, fieldErrors, requestId }`입니다 (`ErrorCode` 참고).
- 시스템 관리자·전체 열람 권한은 세션에 복사하지 않고 요청마다 DB에서 확인해 회수가 바로 반영됩니다.
- DB 변경은 `src/main/resources/db/migration`의 Flyway SQL로만 합니다 (`ddl-auto=validate`).

## API

기본 경로는 `/api/v1`. 쓰기 요청은 `GET /auth/csrf`로 받은 헤더(`X-CSRF-TOKEN`)를 붙입니다. 시각은 epoch milliseconds, ID는 UUID 문자열입니다.

| 기능 | 경로 |
|---|---|
| 인증 | `GET /auth/csrf`, `GET /auth/options`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/signup` |
| 내 정보 | `GET /me`, `PUT /me` (비밀번호 변경은 `currentPassword` 필요) |
| 화면 데이터 | `GET /state` (권한에 맞게 걸러서 보냄) |
| 팀·사용자 관리 | `GET /teams`, `POST/PUT/DELETE /admin/teams/{id}`, `POST /admin/teams/{id}/users`, `PUT /admin/users/{id}/team·position·view-all·password`, `POST /admin/users/{id}/move` |
| 평가룸 | `POST /projects`, `PUT /projects/{pid}/settings`, `POST /projects/{pid}/close`, `PUT/DELETE /projects/{pid}/members/{uid}[/admin]` |
| 입장·초대 | `POST /projects/join`, `POST/DELETE /projects/{pid}/invite`, `POST /projects/{pid}/invitations`, `POST /invitations/{id}/accept·decline`, `DELETE /invitations/{id}` |
| 발표 | `POST /projects/{pid}/presentations`, `PUT/DELETE .../presentations/{id}`, `PUT .../presentations/order`, `POST .../presentations/{id}/move` |
| 평가 | `PUT /projects/{pid}/presentations/{id}/ratings/{targetId}` |
| 발표 자료 | `POST/GET/DELETE /projects/{pid}/presentations/{id}/attachments[/{aid}]` |
| 상태 확인 | `GET /actuator/health` (DB 장애 시 DOWN) |

목업에 있던 `/auth/demo-*`, `/demo/reset`, 이름·전화번호만으로 하는 `/auth/find-ids`·`/auth/reset-password`는 만들지 않았습니다. 비밀번호를 잊은 사용자는 시스템 관리자가 재설정합니다.
