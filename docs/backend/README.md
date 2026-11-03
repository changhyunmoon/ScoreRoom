# ScoreRoom 백엔드 설계

작성일: 2026-11-03. 상태: 1차 구현 완료 (`backend/`). 구현 내용과 실행 방법은 [backend/README.md](../../backend/README.md).

Java/Spring과 PostgreSQL 사용은 사용자와 합의했다. 나머지는 현재 프런트엔드와 목업 API를 분석한 권장안이며, 실제 백엔드 코드는 아직 없다. 인프라 구축은 후속 작업이다.

## 권장 구성

**Java 21 + Spring Boot + Spring MVC + Spring Security + Spring Data JPA + PostgreSQL**로 단일 애플리케이션을 만든다. Gradle Wrapper로 빌드하고 Flyway로 DB 변경을 관리한다. Spring Boot의 정확한 안정 버전과 관련 라이브러리 버전은 구현 시작 시 호환성을 확인해 고정한다.

EC2 한 대에 React 정적 파일, Spring Boot API, PostgreSQL, 업로드 파일을 함께 두는 운영을 전제로 한다. 동시 사용자 약 50명은 초기 부하 시험의 목표이며 성능 보장은 아니다. 마이크로서비스, Redis, 메시지 브로커는 초기 구성에 넣지 않는다.

## 읽는 순서

1. [아키텍처와 기술 선택](01-architecture.md): MVC 적용 방식, 요청 흐름, DB 선택 이유
2. [패키지와 폴더 구조](02-project-structure.md): 실제 구현할 디렉터리와 계층 책임
3. [데이터 모델과 업무 규칙](03-data-model.md): 테이블, 제약조건, 평가 규칙, 동시성
4. [API와 인증](04-api-and-security.md): 기존 화면 연결, 접근 권한, 인증 변경점
5. [구현 순서와 검증](05-implementation-plan.md): 단계별 완료 기준과 남은 결정
6. [ERD SQL 가져오기](06-erd-import.md): 테이블 관계와 가져오기 방법

테이블 구조도 생성용 PostgreSQL DDL: [schema.sql](schema.sql).

## 확인한 현재 코드

- `frontend/src/store.ts`: 화면 타입, 목업 API 호출, 파일 업로드/다운로드
- `frontend/src/mock/server.ts`: 목업 라우트, 권한, 평가/초대/조직 관리 규칙
- `frontend/src/logic.ts`: 평가 제한, 결과 집계, 역할 및 화면 표시
- `frontend/README.md`: 브라우저 저장소 기반 목업이라는 현재 상태

실제 데이터는 현재 localStorage/IndexedDB에 있고 사용자 간 공유되지 않는다. 목업 로그인과 비밀번호 재설정은 서비스 인증으로 사용할 수 없다. 목업 동작을 유지할 항목과 실제 서비스에서 변경할 항목을 아래 문서에서 구분한다. 사용자 요청에 따라 조직과 사용자 초기 입력 SQL은 [docs/mock](../mock/README.md)에 별도로 준비했다. 실제 직원 정보는 테스트 픽스처로 사용하지 않는다.
