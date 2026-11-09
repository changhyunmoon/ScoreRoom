-- 발표 화면 위쪽 참여자·발표 등록·발표 미등록 인원을 일반 참여자에게도 보여 줄지. 기본은 숨김(기존 평가룸도 지금처럼 룸 관리자만 봄)
ALTER TABLE projects ADD COLUMN show_roster_summary BOOLEAN NOT NULL DEFAULT FALSE;
