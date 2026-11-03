# ScoreRoom 프런트엔드

React 18 + TypeScript + Vite + React Router(HashRouter). 설계는 [docs/frontend](../docs/frontend/README.md)를 따릅니다.

```bash
npm ci
npm run dev      # http://localhost:5173 (/api는 http://localhost:8080 백엔드로 넘어간다)
npm run build    # 타입 검사 + 정적 빌드 (dist/)
```

백엔드를 먼저 띄워야 합니다 ([backend/README.md](../backend/README.md)).

## 구조

```text
src/
├── main.tsx              # 세션 시작 + 렌더
├── app/                  # 조립: App, router, 접근 가드, 공통 레이아웃
├── features/             # 기능별: api/ components/ model/ pages/ + index.ts(공개 진입점)
│   ├── session/          # 로그인 상태와 화면 데이터(/state), refresh·mutate
│   ├── auth/             # 로그인·가입·로그아웃
│   ├── profile/          # 내 정보 팝업
│   ├── organization/     # 조직도, 팀 선택, 시스템 관리자 화면
│   ├── projects/         # 평가룸 목록·공통 틀·운영 탭
│   ├── invitations/      # 초대 알림
│   ├── presentations/    # 발표 목록·등록·편집
│   ├── ratings/          # 평가 가능 규칙, 점수 입력
│   ├── results/          # 결과 표, 결과 공유 이미지
│   └── attachments/      # 발표 자료 업로드·다운로드
└── shared/               # 기능을 모르는 공통 코드: api/client, ui, icons, lib, hooks, styles
```

규칙
- 다른 기능의 코드는 그 기능의 `index.ts`로만 가져옵니다. `app/`은 페이지(`features/*/pages`)를 직접 가져와 라우트에 연결합니다. `shared/`는 `features/`를 가져오지 않습니다.
- `api/` 함수는 HTTP 요청만 합니다. 데이터를 바꾼 뒤에는 화면에서 `mutate(apiCall)`로 감싸 최신 `/state`를 다시 받습니다. 토스트·화면 이동은 화면 컴포넌트가 합니다(`run()`).
- `model/`은 표시 규칙과 타입입니다. 평가 가능 여부 등은 안내용이고 최종 판단은 서버가 합니다.
- 인증은 세션 쿠키와 CSRF 헤더(`shared/api/client.ts`)로 합니다. 브라우저 저장소에 토큰이나 서버 데이터를 저장하지 않습니다.
- 화면 데이터는 15초마다(탭이 보일 때만) 다시 받습니다. 입력 중인 점수·폼 값은 각 화면의 상태라 지워지지 않습니다.

## 다음 단계 (설계 문서 3단계)

지금은 전환용 `GET /state` 하나로 전체 화면 데이터를 받습니다. 사용자가 늘면 화면별 조회 API와 TanStack Query로 나누는 것을 권장합니다.
