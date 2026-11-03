# ScoreRoom

사내 발표 평가 서비스입니다. React 화면(`frontend/`)과 Spring Boot API(`backend/`), PostgreSQL로 구성되며 AWS EC2 한 대에서 운영합니다.

| 폴더 | 내용 |
|---|---|
| `frontend/` | React + TypeScript + Vite 화면. [안내](frontend/README.md) |
| `backend/` | Java 21 + Spring Boot 4 + PostgreSQL API. [안내](backend/README.md) |
| `deploy/` | EC2 배포 스크립트·서버 설정과 GitHub Actions 자동 배포. [안내](deploy/README.md) |
| `docs/` | 설계 문서 ([백엔드](docs/backend/README.md), [프런트엔드](docs/frontend/README.md)) |

## 배포

main 브랜치에 merge(push)되면 GitHub Actions가 테스트·빌드한 뒤 EC2에 배포합니다. 설정과 비밀값은 GitHub production 환경의 Secrets·Variables로 관리합니다. 자세한 내용은 [deploy/README.md](deploy/README.md)를 보세요.

- 서비스 주소: `http://<EC2 퍼블릭 IP>/`
- 첫 시스템 관리자: GitHub Secret `SCOREROOM_ADMIN_LOGIN_ID` / `SCOREROOM_ADMIN_PASSWORD`

## 빌드와 테스트

PR을 올리면 CI가 같은 검사를 자동으로 합니다.

```bash
cd backend && ./gradlew test bootJar   # 실제 PostgreSQL(테스트용 내장)로 API·업무 규칙 통합 테스트 + 실행 jar
cd frontend && npm ci && npm run build # 타입 검사 + 정적 빌드
```
