-- 팀 발표도 구성원 한 명씩이 아니라 발표 하나에 점수를 한 번 준다.
-- 예전에 한 평가자가 같은 발표의 여러 구성원에게 준 점수는 가장 나중에 낸 것 하나만 남긴다.
DELETE FROM ratings r
 USING ratings o
 WHERE r.presentation_id = o.presentation_id
   AND r.rater_id = o.rater_id
   AND (o.submitted_at > r.submitted_at OR (o.submitted_at = r.submitted_at AND o.id > r.id));

ALTER TABLE ratings DROP CONSTRAINT uq_ratings_submission;
ALTER TABLE ratings DROP CONSTRAINT fk_ratings_target;
DROP INDEX idx_ratings_summary;
ALTER TABLE ratings DROP COLUMN target_id;
ALTER TABLE ratings ADD CONSTRAINT uq_ratings_submission UNIQUE (presentation_id, rater_id);
CREATE INDEX idx_ratings_summary ON ratings (project_id, presentation_id);

COMMENT ON TABLE ratings IS '평가자가 발표 하나에 준 점수와 피드백 (팀 발표도 발표 단위로 한 번)';
