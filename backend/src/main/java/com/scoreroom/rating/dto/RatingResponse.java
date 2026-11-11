package com.scoreroom.rating.dto;

import java.util.UUID;

import com.scoreroom.common.web.Times;
import com.scoreroom.rating.domain.Rating;

/** 화면의 Rating 타입 (발표 하나에 준 점수). 작성자 본인과 룸 관리자에게만 보낸다 */
public record RatingResponse(UUID id, UUID projectId, UUID presentationId, UUID raterId, int score, String feedback,
        Long submittedAt) {

    public static RatingResponse from(Rating r) {
        return new RatingResponse(r.getId(), r.getProjectId(), r.getPresentationId(), r.getRaterId(), r.getScore(),
                r.getFeedback(), Times.toMillis(r.getSubmittedAt()));
    }
}
