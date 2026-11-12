-- 시스템 관리자 로그 화면에서 보는 기록: 활동, 로그인, 요청 거절, 서버·화면 오류.
-- 평가룸·사용자가 지워져도 로그는 남아야 하므로 FK를 두지 않고 이름을 그때 값으로 함께 저장한다.
-- 30일이 지난 로그는 매일 지운다 (LogRetentionJob).
CREATE TABLE system_logs (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(20) NOT NULL,
    level VARCHAR(10) NOT NULL,
    action VARCHAR(60) NOT NULL,
    message VARCHAR(500) NOT NULL,
    actor_id UUID,
    actor_name VARCHAR(100),
    project_id UUID,
    project_name VARCHAR(200),
    request_id VARCHAR(16),
    http_method VARCHAR(10),
    path VARCHAR(300),
    status INTEGER,
    ip VARCHAR(64),
    user_agent VARCHAR(300),
    error_type VARCHAR(200),
    detail TEXT,
    CONSTRAINT ck_system_logs_level CHECK (level IN ('INFO', 'WARN', 'ERROR'))
);

CREATE INDEX idx_system_logs_time ON system_logs (created_at DESC, id DESC);
CREATE INDEX idx_system_logs_category ON system_logs (category, action, created_at DESC);
CREATE INDEX idx_system_logs_project ON system_logs (project_id, created_at DESC);
CREATE INDEX idx_system_logs_request ON system_logs (request_id);

-- 지금까지의 관리 작업 기록을 옮겨 담는다. 이후로는 audit_events에 쓰지 않는다
INSERT INTO system_logs (id, created_at, category, level, action, message, actor_id, actor_name, project_id, project_name)
SELECT a.id, a.created_at,
       CASE
           WHEN a.action IN ('RATING_REQUESTED') THEN 'RATING'
           WHEN a.action IN ('PRESENTATION_REQUESTED') THEN 'PRESENTATION'
           WHEN a.action IN ('SETTINGS_CHANGED', 'PROJECT_INFO_CHANGED', 'PROJECT_CLOSED', 'PROJECT_DELETED') THEN 'PROJECT'
           WHEN a.action IN ('MEMBERS_ADDED', 'MEMBER_REMOVED', 'ROOM_ADMIN_GRANTED', 'ROOM_ADMIN_REVOKED') THEN 'MEMBER'
           WHEN a.action IN ('PASSWORD_RESET_SELF') THEN 'AUTH'
           ELSE 'SYSTEM'
       END,
       'INFO', a.action,
       CASE a.action
           WHEN 'RATING_REQUESTED' THEN '평가 요청 알림 ' || a.affected_count || '명'
           WHEN 'PRESENTATION_REQUESTED' THEN '발표 등록 요청 알림 ' || a.affected_count || '명'
           WHEN 'SETTINGS_CHANGED' THEN '평가룸 설정 변경 (평가 ' || a.affected_count || '건 삭제)'
           WHEN 'PROJECT_INFO_CHANGED' THEN '평가룸 정보 수정'
           WHEN 'PROJECT_CLOSED' THEN '평가룸 마감'
           WHEN 'PROJECT_DELETED' THEN '평가룸 삭제 (평가 ' || a.affected_count || '건 삭제)'
           WHEN 'MEMBERS_ADDED' THEN '참여자 ' || a.affected_count || '명 추가'
           WHEN 'MEMBER_REMOVED' THEN '참여자 제거 (평가 ' || a.affected_count || '건 삭제)'
           WHEN 'ROOM_ADMIN_GRANTED' THEN '룸 관리자 지정'
           WHEN 'ROOM_ADMIN_REVOKED' THEN '룸 관리자 해제'
           WHEN 'PASSWORD_RESET_SELF' THEN '비밀번호 찾기로 재설정'
           WHEN 'TEAM_CREATED' THEN '팀 생성'
           WHEN 'TEAM_UPDATED' THEN '팀 수정'
           WHEN 'TEAM_DELETED' THEN '팀 삭제'
           WHEN 'USER_CREATED' THEN '사용자 추가'
           WHEN 'USER_TEAM_CHANGED' THEN '사용자 팀 변경'
           WHEN 'VIEW_ALL_GRANTED' THEN '전체 열람 권한 부여'
           WHEN 'VIEW_ALL_REVOKED' THEN '전체 열람 권한 회수'
           WHEN 'CREATE_ROOM_GRANTED' THEN '평가룸 생성 권한 부여'
           WHEN 'CREATE_ROOM_REVOKED' THEN '평가룸 생성 권한 회수'
           WHEN 'USER_PASSWORD_RESET' THEN '비밀번호 초기화'
           ELSE a.action
       END,
       a.actor_id, u.name, a.project_id, p.name
FROM audit_events a
LEFT JOIN users u ON u.id = a.actor_id
LEFT JOIN projects p ON p.id = a.project_id;
