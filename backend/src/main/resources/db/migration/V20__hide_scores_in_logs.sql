-- 시스템 관리자 로그에서 점수를 가린다. 이미 남은 평가 로그의 "70점" 같은 점수를 "**점"으로 바꾼다.
UPDATE system_logs
SET message = regexp_replace(message, '\m\d+점', '**점', 'g')
WHERE action IN ('RATING_SUBMITTED', 'RATING_UPDATED');

UPDATE system_logs
SET detail = regexp_replace(detail, '\m\d+점', '**점', 'g')
WHERE action IN ('RATING_SUBMITTED', 'RATING_UPDATED', 'RATINGS_DELETED', 'PROJECT_DELETED')
  AND detail IS NOT NULL;
