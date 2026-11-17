-- 집계(평균·순위)에서 최고점 trim_top개·최저점 trim_bottom개를 뺀다. 점수가 trim_min_count개 미만인 발표는 빼지 않는다.
-- 기본은 사용 안 함(0/0). 기존 평가룸도 지금처럼 모든 점수로 계산한다.
ALTER TABLE projects ADD COLUMN trim_top INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN trim_bottom INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN trim_min_count INTEGER NOT NULL DEFAULT 3;
