package com.scoreroom.result.dto;

import java.util.List;
import java.util.UUID;

/**
 * 발표 하나의 집계 (팀 발표도 구성원별이 아니라 발표 단위).
 * total: 평가룸 참여자 수, blocked: 평가할 수 없는 인원(점수를 주지 않은 사람 중), eligible: total - blocked,
 * scored: 점수를 준 인원, notRated: 평가할 수 있는데 아직 안 준 인원.
 * avg: 전체 평균 (제출이 없으면 null), inCount/inAvg: 집계 기준 범위 안의 제출 수/평균 (범위를 안 쓰면 0/null,
 * 점수는 있는데 모두 범위 밖이면 평균 0).
 * 미제출과 평가 불가는 0점으로 넣지 않는다. 반올림은 화면에서 한다.
 * scoredIds / blockedIds / notRatedIds: 평가함 / 평가 불가 / 미평가 인원이 누구인지 (평가자 순서). 사람 목록을 볼 수 없는 사람에게는 null로 보낸다.
 */
public record SummaryResponse(
        UUID presentationId,
        int total,
        int blocked,
        int eligible,
        int scored,
        int notRated,
        Double avg,
        int inCount,
        Double inAvg,
        List<UUID> scoredIds,
        List<UUID> blockedIds,
        List<UUID> notRatedIds) {
}
