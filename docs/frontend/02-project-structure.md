# 폴더 구조와 책임

아래는 점진적으로 적용할 제안 구조다. 기능별 폴더 구조이며 특정 아키텍처 프레임워크의 모든 규칙을 도입하는 것은 아니다.

```text
frontend/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx          # QueryClient, 인증 초기화, 오류 경계
│   │   ├── guards/               # RequireAuth, RequireSysAdmin
│   │   └── layouts/              # AppLayout, ProjectLayout
│   ├── features/
│   │   ├── auth/                 # 로그인·가입·복구 정책
│   │   ├── profile/              # 내 정보 팝업
│   │   ├── organization/         # 조직도, 사용자 선택과 관리
│   │   ├── projects/             # 평가룸 목록·설정·멤버·마감
│   │   ├── invitations/          # 초대 알림·코드 입장
│   │   ├── presentations/        # 발표 목록·상세·편집
│   │   ├── ratings/
│   │   │   ├── components/PersonRating.tsx
│   │   │   ├── hooks/useSubmitRating.ts
│   │   │   ├── api/ratings.api.ts
│   │   │   ├── model/types.ts
│   │   │   └── model/validation.ts
│   │   ├── results/              # 집계·점수표·PNG 내보내기
│   │   └── attachments/          # 파일 선택·전송·다운로드
│   ├── shared/
│   │   ├── api/                  # client.ts, ApiError, csrf.ts
│   │   ├── ui/                   # Button, Field, Dialog, Toast, Empty
│   │   ├── icons/                # 기존 SVG 아이콘
│   │   ├── lib/                  # 날짜/용량 포맷, 다운로드
│   │   └── styles/               # tokens.css, base.css, utilities.css
│   ├── mocks/                    # 개발/테스트 전용 어댑터와 가상 데이터
│   └── test/                     # 테스트 공통 설정
├── e2e/                          # 역할별 핵심 사용자 흐름
├── vite.config.ts
├── package.json
└── package-lock.json
```

각 feature에 필요할 때 `pages/`, `components/`, `hooks/`, `api/`, `model/`, `styles/`를 추가한다. 파일이 하나뿐인 기능에 빈 폴더를 전부 만들지 않는다. 공통 페이지 레이아웃은 app, 특정 기능의 화면은 해당 feature가 소유한다.

## 의존성 규칙

- app은 features/shared를 조립한다.
- feature는 shared를 사용한다. features 간 공유는 공개된 타입/훅/컴포넌트 진입점을 통해 한다.
- shared는 app/features를 import하지 않는다.
- API 함수는 fetch/DTO 변환만 담당하고 화면 이동이나 토스트를 실행하지 않는다.
- mutation 훅은 캐시 갱신을, 사용자 행동을 조립하는 페이지/컴포넌트는 성공 안내와 이동을 담당한다. 한 오류에 토스트를 여러 번 띄우지 않는다.

## 기존 파일의 이동 방향

| 현재 | 제안 |
|---|---|
| App.tsx의 Layout/Notifications/Routes | app/layouts, invitations/components, app/router |
| store.ts의 타입 | 기능별 model/types 및 API 응답 타입 |
| store.ts의 api/mutate/refresh | shared/api, feature api/hooks, 전환용 bootstrap 어댑터 |
| ui.tsx의 useMe | auth/hooks/useSession |
| ui.tsx의 Popup/Field/Chip/Toast | shared/ui |
| logic.ts | 표시 함수는 shared/lib 또는 feature/model; 집계는 서버 DTO |
| pages/Admin.tsx | projects의 운영/초대/참여자/설정 화면; results는 별도 기능 |
| pages/ResultShare.tsx | results/components, results/lib/renderResultImage |
| pages/OrgTree.tsx | organization/components 및 model |
| styles.css | 공통 토큰/기본 스타일과 기능별 CSS |

ResultsPage가 Admin.tsx의 ResultTab을 가져오는 현재 결합은 results 기능으로 옮긴다. 조직도 읽기/선택 컴포넌트와 시스템 관리자 편집 기능은 같은 organization 안에서 나누고 읽기 컴포넌트가 관리자 API를 직접 호출하지 않도록 한다.
