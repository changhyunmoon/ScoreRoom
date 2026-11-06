package com.scoreroom.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.notification.domain.Notification;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** 최근 알림부터 */
    List<Notification> findTop50ByUserIdOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query("update Notification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
    int markAllRead(UUID userId, Instant now);
}
