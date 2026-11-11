-- 룸 관리자가 아직 평가하지 않은 사람에게 보내는 '평가 요청' 알림 종류를 추가한다.
-- 어느 발표를 평가해 달라는지 알 수 있게 발표를 함께 남긴다 (발표가 지워지면 비운다).
ALTER TABLE notifications DROP CONSTRAINT ck_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT ck_notifications_type
    CHECK (type IN ('ROOM_INVITED', 'PRESENTATION_REQUESTED', 'RATING_REQUESTED'));

ALTER TABLE notifications ADD COLUMN presentation_id UUID;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_presentation
    FOREIGN KEY (presentation_id) REFERENCES presentations (id) ON DELETE SET NULL;
CREATE INDEX idx_notifications_presentation ON notifications (presentation_id);

COMMENT ON COLUMN notifications.presentation_id IS '평가 요청 알림이 가리키는 발표 (그 밖의 알림은 비어 있음)';
