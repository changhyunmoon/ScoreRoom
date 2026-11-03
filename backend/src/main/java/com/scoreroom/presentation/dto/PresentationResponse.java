package com.scoreroom.presentation.dto;

import java.util.List;
import java.util.UUID;

import com.scoreroom.attachment.dto.AttachmentResponse;
import com.scoreroom.common.web.Times;
import com.scoreroom.presentation.domain.Crew;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.domain.PresentationType;

/**
 * 화면의 Presentation 타입. order는 관리자 설정 순서다.
 * hasRatings: 점수를 받은 적이 있는지 (있으면 구성원 추가·제외를 막는다. 누가 몇 점인지는 담지 않는다)
 */
public record PresentationResponse(
        UUID id,
        UUID projectId,
        String title,
        String intro,
        PresentationType type,
        UUID leaderId,
        int order,
        List<UUID> presenterIds,
        List<UUID> memberIds,
        UUID createdBy,
        Long createdAt,
        String deployUrl,
        List<AttachmentResponse> attachments,
        boolean hasRatings) {

    public static PresentationResponse of(Presentation p, Crew crew, List<AttachmentResponse> attachments,
            boolean hasRatings) {
        return new PresentationResponse(p.getId(), p.getProjectId(), p.getTitle(), p.getIntro(), p.getType(),
                p.getLeaderId(), p.getSortOrder(), crew.presenterIds(), crew.memberIds(), p.getCreatedBy(),
                Times.toMillis(p.getCreatedAt()), p.getDeployUrl(), attachments, hasRatings);
    }
}
