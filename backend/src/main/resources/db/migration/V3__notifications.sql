-- 사람 지정 초대는 이제 수락 절차 없이 바로 참여자로 추가한다 (POST /projects/{id}/members).
-- 받은 사람이 수락·거절하던 초대 기록 대신, '어느 평가룸에 초대됐다'는 알림만 남긴다.
DROP TABLE IF EXISTS invitations;

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(30) NOT NULL,
    project_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_notifications_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users (id),
    CONSTRAINT ck_notifications_type CHECK (type IN ('ROOM_INVITED')),
    CONSTRAINT ck_notifications_read CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE INDEX idx_notifications_inbox ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_project ON notifications (project_id);
CREATE INDEX idx_notifications_actor ON notifications (actor_id);

COMMENT ON TABLE notifications IS '사용자에게 보여 줄 알림 (예: 평가룸에 초대됨). 읽으면 read_at을 기록한다';
