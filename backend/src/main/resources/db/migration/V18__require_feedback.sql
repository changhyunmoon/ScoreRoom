-- 점수를 줄 때 피드백도 꼭 쓰게 할지. 기본은 선택(기존 평가룸도 지금처럼). 이미 저장된 피드백 없는 평가는 그대로 둔다.
ALTER TABLE projects ADD COLUMN require_feedback BOOLEAN NOT NULL DEFAULT FALSE;
