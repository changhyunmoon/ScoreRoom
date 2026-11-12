package com.scoreroom.log.repository;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.log.domain.SystemLog;

public interface SystemLogRepository extends JpaRepository<SystemLog, UUID> {

    @Modifying
    @Query("delete from SystemLog l where l.createdAt < :before")
    int deleteOlderThan(Instant before);
}
