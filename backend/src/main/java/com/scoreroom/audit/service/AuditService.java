package com.scoreroom.audit.service;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.audit.domain.AuditEvent;
import com.scoreroom.audit.repository.AuditEventRepository;

/** 관리 작업을 호출한 트랜잭션 안에서 함께 기록한다 (작업이 롤백되면 기록도 남지 않는다) */
@Service
public class AuditService {

    private final AuditEventRepository events;
    private final Clock clock;

    public AuditService(AuditEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID actorId, UUID projectId, String action, int affectedCount) {
        events.save(new AuditEvent(actorId, projectId, action, affectedCount, clock.instant()));
    }
}
