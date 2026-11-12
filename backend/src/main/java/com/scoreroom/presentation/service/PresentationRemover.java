package com.scoreroom.presentation.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.attachment.service.AttachmentService;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.service.LogService;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.rating.repository.RatingRepository;

/**
 * 발표 하나를 하위 데이터와 함께 지운다 (평가 → 자료 → 구성원 → 발표 순서).
 * 발표 삭제와 참여자 제거(단독 발표)가 같은 처리를 쓴다. 자료 파일은 커밋 후 지운다.
 */
@Component
public class PresentationRemover {

    private final RatingRepository ratings;
    private final AttachmentService attachmentService;
    private final PresentationMemberRepository presentationMembers;
    private final PresentationRepository presentations;
    private final LogService logs;

    public PresentationRemover(RatingRepository ratings, AttachmentService attachmentService,
            PresentationMemberRepository presentationMembers, PresentationRepository presentations, LogService logs) {
        this.ratings = ratings;
        this.attachmentService = attachmentService;
        this.presentationMembers = presentationMembers;
        this.presentations = presentations;
        this.logs = logs;
    }

    /**
     * 지운 평가 건수를 돌려준다.
     * reason: 로그에 남길 삭제 사유 ("": 직접 삭제, null: 로그를 남기지 않음 — 평가룸 삭제처럼 호출하는 쪽이 한 번에 남길 때)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int remove(Presentation presentation, String reason) {
        if (reason != null) {
            String what = "'" + presentation.getTitle() + "' 발표 삭제";
            logs.ratingsDeleted(null, presentation.getProjectId(), what,
                    ratings.findByPresentationId(presentation.getId()));
            logs.activity(LogService.currentActor(), presentation.getProjectId(), LogAction.PRESENTATION_DELETED,
                    what + (reason.isEmpty() ? "" : " (" + reason + ")"));
        }
        int removedRatings = ratings.deleteAllForPresentation(presentation.getId());
        attachmentService.deleteAllOf(presentation.getId());
        presentationMembers.deleteAllOf(presentation.getId());
        presentations.deleteByIdNow(presentation.getId());
        return removedRatings;
    }
}
