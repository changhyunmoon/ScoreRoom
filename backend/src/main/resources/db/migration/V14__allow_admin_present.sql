-- 룸 관리자도 발표할지. 지금까지처럼 기본은 발표하지 않는다
ALTER TABLE projects ADD COLUMN allow_admin_present BOOLEAN NOT NULL DEFAULT FALSE;
