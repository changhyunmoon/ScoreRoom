package com.scoreroom.attachment.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.scoreroom.attachment.domain.Attachment;
import com.scoreroom.attachment.domain.AttachmentStatus;
import com.scoreroom.attachment.dto.AttachmentDownload;
import com.scoreroom.attachment.dto.AttachmentResponse;
import com.scoreroom.attachment.repository.AttachmentRepository;
import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.infrastructure.storage.FileStorage;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.RoomGuard;
import com.scoreroom.project.service.RoomGuard.RoomWrite;
import com.scoreroom.user.service.UserAccessService;

/**
 * 발표 자료 (형식 제한 없음, 파일당 50MB, 발표당 10개).
 * 업로드: STAGING으로 자리를 잡고(트랜잭션 1) → 파일 저장(트랜잭션 밖) → READY로 전환(트랜잭션 2).
 * 파일을 받는 동안 DB 트랜잭션과 평가룸 잠금을 붙잡지 않는다.
 */
@Service
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);
    private static final List<AttachmentStatus> COUNTED = List.of(AttachmentStatus.STAGING, AttachmentStatus.READY);

    private final AttachmentRepository attachments;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final ProjectRepository projects;
    private final RoomGuard roomGuard;
    private final UserAccessService userAccess;
    private final FileStorage storage;
    private final FileCleanupService cleanup;
    private final TransactionTemplate transaction;

    public AttachmentService(AttachmentRepository attachments, PresentationRepository presentations,
            PresentationMemberRepository presentationMembers,
            ProjectRepository projects, RoomGuard roomGuard, UserAccessService userAccess, FileStorage storage,
            FileCleanupService cleanup, PlatformTransactionManager transactionManager) {
        this.attachments = attachments;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.projects = projects;
        this.roomGuard = roomGuard;
        this.userAccess = userAccess;
        this.storage = storage;
        this.cleanup = cleanup;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public AttachmentResponse upload(UUID actorId, UUID projectId, UUID presentationId, MultipartFile file) {
        if (file.isEmpty()) {
            throw ApiException.badRequest("빈 파일은 올릴 수 없습니다.");
        }
        if (file.getSize() > Attachment.MAX_BYTES) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, "발표 자료는 파일당 50MB 이하만 올릴 수 있습니다.");
        }
        Attachment staged = transaction.execute(status -> {
            requireEditable(roomGuard.lockAsMember(projectId, actorId), presentationId);
            if (attachments.countByPresentationIdAndStatusIn(presentationId, COUNTED) >= Attachment.MAX_PER_PRESENTATION) {
                throw ApiException.badRequest("발표 자료는 " + Attachment.MAX_PER_PRESENTATION + "개까지 올릴 수 있습니다.");
            }
            String contentType = file.getContentType() == null || file.getContentType().isBlank()
                    ? "application/octet-stream" : truncate(file.getContentType(), 255);
            return attachments.save(new Attachment(projectId, presentationId, storage.newKey(),
                    safeFileName(file.getOriginalFilename()), file.getSize(), contentType, actorId));
        });

        try (InputStream in = file.getInputStream()) {
            storage.store(staged.getStorageKey(), in);
        } catch (IOException e) {
            log.error("발표 자료를 저장하지 못했습니다.", e);
            discard(staged);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "발표 자료를 저장하지 못했습니다. 다시 시도해 주세요.");
        }

        // 그 사이 발표가 지워졌거나 평가룸이 마감됐으면 올린 파일을 버린다
        Boolean ready = transaction.execute(status -> {
            boolean open = projects.findByIdForUpdate(projectId).map(Project::isOpen).orElse(false);
            if (!open) {
                return false;
            }
            return attachments.findById(staged.getId())
                    .filter(a -> a.getStatus() == AttachmentStatus.STAGING)
                    .map(a -> {
                        a.markReady();
                        return true;
                    })
                    .orElse(false);
        });
        if (!Boolean.TRUE.equals(ready)) {
            discard(staged);
            throw ApiException.conflict("발표나 평가룸이 바뀌어 발표 자료를 올리지 못했습니다. 새로 고침한 뒤 다시 시도해 주세요.");
        }
        return AttachmentResponse.from(staged);
    }

    @Transactional
    public void delete(UUID actorId, UUID projectId, UUID presentationId, UUID attachmentId) {
        requireEditable(roomGuard.lockAsMember(projectId, actorId), presentationId);
        Attachment attachment = attachments.findByIdAndProjectIdAndPresentationId(attachmentId, projectId, presentationId)
                .filter(a -> a.getStatus() == AttachmentStatus.READY)
                .orElseThrow(() -> ApiException.notFound("발표 자료를 찾을 수 없습니다."));
        cleanup.enqueue(attachment.getStorageKey());
        attachments.deleteByIdNow(attachment.getId());
    }

    /** 평가룸 참여자와 전체 열람 권한자가 내려받는다 */
    @Transactional(readOnly = true)
    public AttachmentDownload download(UUID actorId, UUID projectId, UUID presentationId, UUID attachmentId) {
        roomGuard.requireViewable(projectId, userAccess.require(actorId));
        Attachment attachment = attachments.findByIdAndProjectIdAndPresentationId(attachmentId, projectId, presentationId)
                .filter(a -> a.getStatus() == AttachmentStatus.READY)
                .orElseThrow(() -> ApiException.notFound("발표 자료를 찾을 수 없습니다."));
        try {
            return new AttachmentDownload(attachment.getOriginalName(), attachment.getSizeBytes(),
                    storage.load(attachment.getStorageKey()));
        } catch (IOException e) {
            log.error("발표 자료 파일이 없습니다: {}", attachment.getStorageKey(), e);
            throw ApiException.notFound("발표 자료 파일을 찾을 수 없습니다.");
        }
    }

    /** 발표를 지울 때 그 발표의 자료 메타데이터를 지우고 파일 삭제 작업을 남긴다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteAllOf(UUID presentationId) {
        for (Attachment a : attachments.findByPresentationId(presentationId)) {
            cleanup.enqueue(a.getStorageKey());
            attachments.deleteByIdNow(a.getId());
        }
    }

    /** 화면에 보여줄 자료 (READY만), 발표별로 묶어서 */
    @Transactional(readOnly = true)
    public Map<UUID, List<AttachmentResponse>> readyByPresentation(Collection<UUID> presentationIds) {
        if (presentationIds.isEmpty()) {
            return Map.of();
        }
        return attachments.findByPresentationIdInAndStatusOrderByCreatedAtAsc(presentationIds, AttachmentStatus.READY)
                .stream()
                .collect(Collectors.groupingBy(Attachment::getPresentationId,
                        Collectors.mapping(AttachmentResponse::from, Collectors.toList())));
    }

    private void requireEditable(RoomWrite room, UUID presentationId) {
        Presentation presentation = presentations.findByIdAndProjectId(presentationId, room.projectId())
                .orElseThrow(() -> ApiException.notFound("발표를 찾을 수 없습니다."));
        UUID actorId = room.membership().getUserId();
        boolean crew = presentationMembers.existsByPresentationIdAndUserId(presentationId, actorId);
        if (!presentation.canBeEditedBy(actorId, room.membership().isAdmin(), crew)) {
            throw ApiException.forbidden("발표 구성원, 발표를 만든 사람, 룸 관리자만 발표 자료를 바꿀 수 있습니다.");
        }
    }

    private void discard(Attachment staged) {
        transaction.executeWithoutResult(status -> {
            if (attachments.findById(staged.getId()).isPresent()) {
                cleanup.enqueue(staged.getStorageKey());
                attachments.deleteByIdNow(staged.getId());
            } else {
                // 발표 삭제 등으로 메타데이터가 먼저 지워졌으면 파일만 지운다
                try {
                    storage.delete(staged.getStorageKey());
                } catch (IOException e) {
                    log.warn("올리다 만 파일을 지우지 못했습니다: {}", staged.getStorageKey(), e);
                }
            }
        });
    }

    /** 경로를 뺀 파일 이름만 쓴다 (저장은 임의 키로 하므로 표시용) */
    static String safeFileName(String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        return name.isEmpty() ? "file" : truncate(name, 255);
    }

    private static String truncate(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }
}
