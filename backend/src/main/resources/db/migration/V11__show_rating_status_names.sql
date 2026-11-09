-- 평가 현황 숫자를 누르면 해당하는 사람 목록(평가함·평가 불가·미평가)을 일반 참여자에게도 보여 줄지.
-- 참여자에게 평가 현황 보이기가 켜져 있을 때만 쓴다. 기본은 숨김(룸 관리자만 봄)
ALTER TABLE projects ADD COLUMN show_rating_status_names BOOLEAN NOT NULL DEFAULT FALSE;
