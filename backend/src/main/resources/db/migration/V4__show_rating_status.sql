-- 평가 화면에 내 평가 현황(전체·평가함·평가 불가·미평가 인원)을 보여 줄지. 룸 운영자가 설정에서 켜고 끈다
ALTER TABLE projects ADD COLUMN show_rating_status BOOLEAN NOT NULL DEFAULT TRUE;
