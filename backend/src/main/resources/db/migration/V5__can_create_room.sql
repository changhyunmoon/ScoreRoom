-- 평가룸 생성 권한: 시스템 관리자가 준 사람만 평가룸을 만들 수 있다.
-- 지금까지 평가룸을 만든 적이 있는 사람은 하던 일을 계속할 수 있도록 권한을 준다.
ALTER TABLE users ADD COLUMN can_create_room BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET can_create_room = TRUE
WHERE is_sys_admin = FALSE AND id IN (SELECT DISTINCT created_by FROM projects);
