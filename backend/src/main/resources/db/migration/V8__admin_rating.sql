-- 룸 관리자도 평가할지. 기존 평가룸은 지금처럼 관리자도 평가하고, 새 평가룸은 기본으로 관리자가 평가하지 않는다.
ALTER TABLE projects ADD COLUMN allow_admin_rating BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE projects ALTER COLUMN allow_admin_rating SET DEFAULT FALSE;
