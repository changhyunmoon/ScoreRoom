-- 극단값 제외의 '점수가 N개 이상일 때만' 설정을 없앤다. 점수가 빼는 개수보다 적거나 같으면 빼지 않는다.
ALTER TABLE projects DROP COLUMN trim_min_count;
