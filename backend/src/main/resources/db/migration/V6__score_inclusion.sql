-- 집계(평균·순위)에 넣을 점수: 본인 점수 / 같은 발표 팀원이 준 점수 / 같은 회사 팀원이 준 점수.
-- 평가 규칙(allow_*)은 점수를 줄 수 있는지, 이 값은 준 점수를 집계에 넣을지다. 기본은 모두 포함.
ALTER TABLE projects ADD COLUMN count_self BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN count_same_crew BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN count_same_team BOOLEAN NOT NULL DEFAULT TRUE;

-- 새 평가룸은 본인·같은 회사 팀·같은 발표 팀원 평가를 기본으로 허용한다 (기존 평가룸 설정은 그대로)
ALTER TABLE projects ALTER COLUMN allow_self SET DEFAULT TRUE;
ALTER TABLE projects ALTER COLUMN allow_same_team SET DEFAULT TRUE;
ALTER TABLE projects ALTER COLUMN allow_same_crew SET DEFAULT TRUE;
