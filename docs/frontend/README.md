# ScoreRoom 프런트엔드 설계

작성일: 2026-11-03. 상태: 1~2단계(구조 분리, HTTP·세션 연결) 구현 완료. 3단계(화면별 조회 API·TanStack Query)는 후속 작업이다. [frontend/README.md](../../frontend/README.md) 참고. 기존 화면/동작과 앞으로 적용할 권장 구조를 구분한다. 설계 문서 작성으로 실제 화면이나 의존성이 변경되지는 않는다.

## 기본 방향

React + TypeScript + Vite SPA를 유지한다. React Router로 페이지를 구성하고, 기능별 폴더 안에서 화면/컴포넌트/API/조회 훅을 묶는다. 서버 데이터 관리는 TanStack Query 도입을 제안한다. 폼과 팝업 상태는 React state로 관리하고, 공통 UI는 기존 CSS와 컴포넌트를 정리해 재사용한다. 백엔드는 합의된 Java Spring + PostgreSQL 설계에 연결한다.

현재 설치 버전은 React 18.3.1, React Router 6.26.2, TypeScript 5.6.3, Vite 5.4.10이다. TanStack Query와 테스트 도구는 아직 설치되어 있지 않다. 추가/업그레이드 버전은 구현 시 React 호환성과 유지보수 상태를 확인해 고정한다.

## 문서 안내

1. [아키텍처와 상태 관리](01-architecture.md)
2. [폴더 구조와 컴포넌트 책임](02-project-structure.md)
3. [화면·라우팅·사용자 흐름](03-pages-and-flows.md)
4. [Spring API·인증·캐시 연결](04-api-and-state.md)
5. [화면 품질과 구현 순서](05-implementation-plan.md)

함께 볼 문서: [백엔드 설계](../backend/README.md), [API와 권한](../backend/04-api-and-security.md), [DB 구조](../backend/03-data-model.md).

## 확인한 현재 코드

- `frontend/src/App.tsx`: HashRouter, 공통 헤더, 계정 메뉴, 초대 알림, 라우트.
- `frontend/src/store.ts`: 데이터 타입, useSyncExternalStore 상태, 목업 호출, 인증 상태.
- `frontend/src/mock/`: localStorage/IndexedDB 기반 서버 대역과 첨부 저장.
- `frontend/src/logic.ts`: 평가 제한, 집계, 정렬, 표시용 함수.
- `frontend/src/ui.tsx`, `icons.tsx`, `styles.css`: 공통 UI와 스타일.
- `frontend/src/pages/`: 평가룸, 평가 입력, 발표 폼, 운영, 결과, 조직 관리 화면.

프런트엔드가 백엔드 MVC의 View 역할을 맡는다. 클라이언트의 권한 판단과 입력 검사는 사용 편의를 위한 것이며 서버의 권한/업무 규칙 검사를 대체하지 않는다.
