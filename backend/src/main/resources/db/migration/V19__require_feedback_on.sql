-- 피드백 필수 입력을 기본으로 켠다. 기존 평가룸도 모두 켠다 (이미 저장된 피드백 없는 평가는 그대로 둔다).
ALTER TABLE projects ALTER COLUMN require_feedback SET DEFAULT TRUE;
UPDATE projects SET require_feedback = TRUE;
