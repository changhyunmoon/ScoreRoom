package com.scoreroom.attachment.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.scoreroom.attachment.domain.Attachment;
import com.scoreroom.attachment.domain.AttachmentStatus;
import com.scoreroom.attachment.domain.FileDeletionJob;
import com.scoreroom.attachment.repository.AttachmentRepository;
import com.scoreroom.attachment.repository.FileDeletionJobRepository;
import com.scoreroom.common.config.AppProperties;
import com.scoreroom.infrastructure.storage.FileStorage;

/**
 * 파일 삭제 작업 처리.
 * - 원본 메타데이터를 지우는 트랜잭션에서 enqueue()로 작업을 기록하고, 커밋되면 바로 한 번 처리한다.
 * - 실패한 작업과 서버 재시작 전 남은 작업은 주기적으로 다시 처리한다.
 * - 끝나지 않은 업로드(STAGING)는 일정 시간이 지나면 정리한다.
 */
@Service
public class FileCleanupService {

    private static final Logger log = LoggerFactory.getLogger(FileCleanupService.class);

    private final FileDeletionJobRepository jobs;
    private final AttachmentRepository attachments;
    private final FileStorage storage;
    private final Clock clock;
    private final AppProperties properties;
    private final TransactionTemplate newTransaction;

    public FileCleanupService(FileDeletionJobRepository jobs, AttachmentRepository attachments, FileStorage storage,
            Clock clock, AppProperties properties, PlatformTransactionManager transactionManager) {
        this.jobs = jobs;
        this.attachments = attachments;
        this.storage = storage;
        this.clock = clock;
        this.properties = properties;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** 원본을 지우는 트랜잭션 안에서 부른다. 커밋되면 파일을 지운다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String storageKey) {
        jobs.save(new FileDeletionJob(storageKey, clock.instant()));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    processDue();
                }
            });
        }
    }

    @Scheduled(initialDelayString = "PT10S", fixedDelayString = "PT1M")
    public void processDue() {
        List<FileDeletionJob> due = newTransaction.execute(
                status -> jobs.findTop50ByNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(clock.instant()));
        if (due == null) {
            return;
        }
        for (FileDeletionJob job : due) {
            try {
                storage.delete(job.getStorageKey());
                newTransaction.executeWithoutResult(status -> jobs.deleteByIdNow(job.getId()));
            } catch (Exception e) {
                log.warn("발표 자료 파일을 지우지 못했습니다. 나중에 다시 시도합니다: {}", job.getStorageKey(), e);
                newTransaction.executeWithoutResult(status -> jobs.findById(job.getId())
                        .ifPresent(j -> j.recordFailure(e.getClass().getSimpleName(), clock.instant())));
            }
        }
    }

    /** 업로드 중 서버가 멈추거나 실패해 STAGING으로 남은 자료를 정리한다 */
    @Scheduled(initialDelayString = "PT30S", fixedDelayString = "PT10M")
    public void cleanupStaleUploads() {
        Instant before = clock.instant().minus(properties.storage().stagingTimeout());
        Integer removed = newTransaction.execute(status -> {
            List<Attachment> stale = attachments.findByStatusAndCreatedAtBefore(AttachmentStatus.STAGING, before);
            for (Attachment a : stale) {
                jobs.save(new FileDeletionJob(a.getStorageKey(), clock.instant()));
                attachments.deleteByIdNow(a.getId());
            }
            return stale.size();
        });
        if (removed != null && removed > 0) {
            log.info("끝나지 않은 업로드 {}건을 정리합니다.", removed);
            processDue();
        }
    }
}
