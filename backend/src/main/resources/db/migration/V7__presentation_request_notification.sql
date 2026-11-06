-- 룸 운영자가 발표 미등록자에게 보내는 '발표 등록 요청' 알림 종류를 추가한다
ALTER TABLE notifications DROP CONSTRAINT ck_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT ck_notifications_type CHECK (type IN ('ROOM_INVITED', 'PRESENTATION_REQUESTED'));
