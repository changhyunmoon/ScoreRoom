-- 집계(평균·순위)에 룸 관리자가 준 점수를 넣을지. 기본은 포함(기존 평가룸도 지금처럼 포함).
ALTER TABLE projects ADD COLUMN count_admin BOOLEAN NOT NULL DEFAULT TRUE;
