# 프로젝트와 패키지 구조

아래 트리는 생성할 코드의 설계이며 아직 구현된 파일 목록이 아니다. `com.scoreroom`은 제안 패키지명이며 조직 표준이 있다면 초기 생성 전에 바꾼다.

```text
ScoreRoom/
├── frontend/                         # 기존 React/Vite
├── backend/
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradlew / gradlew.bat
│   ├── gradle/wrapper/
│   ├── src/main/java/com/scoreroom/
│   │   ├── ScoreRoomApplication.java
│   │   ├── common/
│   │   │   ├── config/                # Clock, JPA 등 공통 설정
│   │   │   ├── security/              # SecurityConfig, CurrentUser, CSRF
│   │   │   ├── error/                 # ApiError, ErrorCode, Advice
│   │   │   └── persistence/           # 생성/수정 시각 공통 매핑
│   │   ├── auth/                     # 로그인, 로그아웃, 계정 복구
│   │   ├── user/                     # 회원, 프로필, 관리자 계정 관리
│   │   ├── organization/             # 팀 계층, 소속, 조직도 순서
│   │   ├── project/                  # 평가룸, 참여자, 설정, 마감
│   │   ├── invitation/               # 입장 코드, 사용자 초대
│   │   ├── presentation/             # 발표와 구성원, 순서
│   │   ├── rating/
│   │   │   ├── controller/RatingController.java
│   │   │   ├── dto/SubmitRatingRequest.java
│   │   │   ├── service/RatingService.java
│   │   │   ├── domain/Rating.java
│   │   │   ├── domain/RatingEligibilityPolicy.java
│   │   │   └── repository/RatingRepository.java
│   │   ├── result/                   # 결과 집계와 조회 projection
│   │   ├── attachment/               # 첨부 메타데이터와 다운로드 권한
│   │   ├── bootstrap/                # 전환용 /state 조회 조립
│   │   └── infrastructure/
│   │       └── storage/              # FileStorage, LocalFileStorage
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-local.yml
│   │   ├── application-prod.yml
│   │   └── db/migration/             # Flyway SQL, 세션 테이블도 관리
│   ├── src/test/java/com/scoreroom/   # 본 코드와 같은 패키지 배치
│   └── src/test/resources/            # 가상 사용자/팀 픽스처
└── docs/backend/                     # 본 설계 문서
```

## 계층별 작성 기준

| 계층 | 넣을 내용 | 피할 내용 |
|---|---|---|
| Controller | `@RestController`, DTO, 상태 코드, 로그인 주체 | 평가 규칙, 직접 DB 저장 |
| DTO | 요청/응답 record, 입력 형식 제한 | JPA 엔티티 상속, 비밀번호 해시 응답 |
| Service | `@Transactional`, 권한 검사, 처리 순서 | HTTP 요청 객체 의존, 파일 전체 메모리 적재 |
| Domain | 엔티티, 상태 전이, 순수 정책 함수 | Controller 호출, 로그인 컨텍스트 직접 조회 |
| Repository | JPA, 잠금 조회, 집계 SQL | 화면용 권한을 건너뛰는 전체 데이터 반환 |

각 기능 패키지는 위의 Controller/DTO/Service/Domain/Repository 구조를 필요에 맞게 사용한다. 코드가 없는 하위 폴더를 미리 모두 만들 필요는 없다. 필드마다 공통 Base 클래스를 늘리거나 단순 CRUD를 위한 범용 Repository를 추가하지 않는다.

## 기능 간 의존성

- auth는 user의 자격 정보 조회 기능을 사용한다.
- project는 참여와 마감, 룸 권한의 기준을 소유한다.
- rating/presentation/invitation은 project의 접근·잠금 기능을 사용한다.
- 복합 변경은 상위 Service가 트랜잭션 안에서 관련 Repository를 호출한다. 다른 모듈 테이블 직접 수정이 필요한 경우 유스케이스와 담당 Service를 명시한다.
- 결과 조회와 `/state`는 읽기 전용 조립 계층이다. 엔티티를 수정하지 않는다.
- 공통 패키지에는 업무 로직을 쌓지 않는다. 예를 들어 평가 권한은 rating/project에 둔다.

`@Transactional`은 외부에서 호출되는 Service의 public 메서드에 둔다. 같은 클래스의 내부 호출에만 선언해 트랜잭션이 적용된다고 가정하지 않는다. 읽기 조회는 `readOnly=true`, 운영 JPA 설정은 `open-in-view=false`, `ddl-auto=validate`를 기본으로 한다. 엔티티 연관은 필요한 방향만 LAZY로 두고 DTO projection/fetch join으로 N+1을 제어한다.
