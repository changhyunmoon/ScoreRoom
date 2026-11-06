package com.scoreroom.notification.service;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.notification.domain.Notification;
import com.scoreroom.notification.repository.NotificationRepository;

/** 알림: 평가룸에 초대됨 등. 받은 사람은 읽기만 한다 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    /** 룸 관리자(actorId)가 userId를 평가룸에 추가했다고 알린다. 추가하는 작업과 같은 트랜잭션에서 부른다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void roomInvited(UUID userId, UUID projectId, UUID actorId) {
        notifications.save(Notification.roomInvited(userId, projectId, actorId, clock.instant()));
    }

    /** 룸 관리자(actorId)가 userId에게 발표 등록을 요청했다고 알린다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void presentationRequested(UUID userId, UUID projectId, UUID actorId) {
        notifications.save(Notification.presentationRequested(userId, projectId, actorId, clock.instant()));
    }

    /** 내 알림을 모두 읽음으로 표시한다 */
    @Transactional
    public void markAllRead(UUID userId) {
        notifications.markAllRead(userId, clock.instant());
    }
}
