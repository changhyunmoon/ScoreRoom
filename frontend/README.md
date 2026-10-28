# ScoreRoom 화면 시안 (frontend)

백엔드 없이 동작하는 React + Vite 시안입니다. 데이터는 브라우저 localStorage에 목업으로 저장됩니다.

```bash
npm install
npm run dev      # http://localhost:5173
```

- 로그인 화면의 "빠른 로그인"으로 계정을 바로 바꿀 수 있습니다 (비밀번호 모두 `1234`, 시스템 관리자 `admin`).
- 시스템 관리자는 회사 팀 구조도와 사용자 정보를 관리하며, 평가룸 생성·참여·평가는 할 수 없습니다.
- 로그인은 탭 단위입니다. 한 탭에서 룸 운영자 결과 화면을 열고 다른 탭에서 평가하면 같은 브라우저 안에서는 바로 반영됩니다 (실서비스의 SSE 동작을 흉내냄).
- 데이터를 처음 상태로 되돌리려면 로그인 화면의 "목업 데이터 초기화"를 누르세요.

## 구조

| 파일 | 역할 |
|---|---|
| `src/store.ts` | 목업 데이터와 액션 (권한·검증 포함). 실제 구현 시 `/api/v1` 호출로 교체 |
| `src/logic.ts` | 평가 가능 여부, 결과 집계(전체/기준 범위 내 합계·평균) |
| `src/pages/Auth.tsx` | 로그인, 회원가입, 아이디/비밀번호 찾기 |
| `src/pages/ProjectList.tsx` | 내 평가룸, 입장 코드 참여, 평가룸 생성 |
| `src/pages/ProjectHome.tsx` | 참여자 화면: 현재 발표, 평가, 내 발표 |
| `src/pages/PresentationForm.tsx` | 발표 등록/편집 (개인·회사 팀·자유 구성) |
| `src/pages/Admin.tsx` | 룸 운영자: 진행(입장 코드·발표 테이블), 결과, 참여자, 설정·평가 마감 |
| `src/pages/SysAdmin.tsx` | 시스템 관리자: 팀 구조도, 사용자 정보 |
| `src/pages/Profile.tsx` | 개인정보 수정 |
