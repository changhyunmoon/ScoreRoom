# ScoreRoom 화면 목업

React + Vite 화면과 브라우저 안에서 동작하는 목업 API입니다. 백엔드 연결은 없습니다.

```bash
npm ci
npm run dev      # http://localhost:5173
npm run build    # 정적 빌드 (목업 API 포함)
npm run preview  # 빌드 결과 확인
```

로그인 화면에서 목업 계정을 바로 선택할 수 있습니다. 데이터는 브라우저에 저장되므로 새로 고침해도 유지되며, 다른 브라우저와 공유되지 않습니다. 목업 데이터 초기화는 현재 브라우저의 변경 데이터와 업로드 자료를 지웁니다.

## 구조

| 파일 | 역할 |
|---|---|
| `src/store.ts` | 화면 데이터 타입과 상태, 목업 API 호출 |
| `src/mock/server.ts` | 브라우저 안의 목업 데이터와 요청 처리, 초기 데이터 |
| `src/mock/files.ts` | 업로드 자료의 IndexedDB 보관 |
| `src/logic.ts` | 평가 가능 여부와 화면용 결과 계산 |
| `src/pages/Auth.tsx` | 로그인, 회원가입, 계정 찾기와 목업 계정 선택 |
| `src/pages/ProjectList.tsx` | 평가룸 목록, 입장, 생성 |
| `src/pages/ProjectHome.tsx` | 발표 목록과 개인 평가 |
| `src/pages/PresentationForm.tsx` | 발표 등록과 편집 |
| `src/pages/Admin.tsx` | 룸 운영, 설정과 결과 현황 |
| `src/pages/ResultShare.tsx` | 결과 이미지 미리보기와 다운로드 |
| `src/pages/SysAdmin.tsx` | 팀 구조도와 사용자 관리 |

이 목업의 권한 검사는 화면 흐름 확인용이며, 실제 서비스의 서버 보안을 대신하지 않습니다.
