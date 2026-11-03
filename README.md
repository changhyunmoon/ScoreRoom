# ScoreRoom

사내 발표 평가 서비스입니다. React 화면(`frontend/`)과 Spring Boot API(`backend/`), PostgreSQL로 구성됩니다.

| 폴더 | 내용 |
|---|---|
| `frontend/` | React + TypeScript + Vite 화면. [안내](frontend/README.md) |
| `backend/` | Java 21 + Spring Boot 4 + PostgreSQL API. [안내](backend/README.md) |
| `deploy/` | EC2 배포 스크립트·서버 설정과 GitHub Actions 자동 배포. [안내](deploy/README.md) |
| `docs/` | 설계 문서 ([백엔드](docs/backend/README.md), [프런트엔드](docs/frontend/README.md)) |

## 로컬에서 실행

설치할 것: JDK(17 이상, Gradle이 Java 21을 자동으로 받습니다), Node.js 20 이상. PostgreSQL이나 Docker는 없어도 됩니다.

```bash
# 터미널 1: API 서버 (http://localhost:8080). PostgreSQL을 내장으로 함께 띄우고 가상 데이터를 넣는다
cd backend
./gradlew bootRun          # Windows: gradlew.bat bootRun

# 터미널 2: 화면 (http://localhost:5173). /api 요청은 8080으로 넘어간다
cd frontend
npm ci
npm run dev
```

로그인 화면에 로컬 가상 계정이 안내됩니다.

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 룸 운영자 | seojun.lee@example.com | password1! |
| 참여자 | jiwoo.park@example.com | password1! |
| 전체 열람 권한자 | sua.bae@example.com | password1! |
| 시스템 관리자 | admin@example.com | admin1234! |

이 계정과 데이터는 `local` 프로필에서만 만들어지는 가상 데이터입니다. 로컬 DB는 `backend/.local/`에 남으므로 처음 상태로 돌리려면 서버를 끄고 그 폴더를 지웁니다.

## 테스트

```bash
cd backend && ./gradlew test        # 실제 PostgreSQL(내장)로 API·업무 규칙 통합 테스트
cd frontend && npm run build        # 타입 검사 + 빌드
```
