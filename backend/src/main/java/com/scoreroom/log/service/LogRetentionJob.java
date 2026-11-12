package com.scoreroom.log.service;

import java.time.Clock;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.common.config.AppProperties;
import com.scoreroom.log.repository.SystemLogRepository;

/** 보관 기간(기본 30일)이 지난 로그를 매일 새벽에 지운다 */
@Component
public class LogRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(LogRetentionJob.class);

    private final SystemLogRepository logs;
    private final AppProperties properties;
    private final Clock clock;

    public LogRetentionJob(SystemLogRepository logs, AppProperties properties, Clock clock) {
        this.logs = logs;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public int purge() {
        int deleted = logs.deleteOlderThan(clock.instant().minus(Duration.ofDays(properties.logs().retentionDays())));
        if (deleted > 0) {
            log.info("보관 기간이 지난 로그 {}건을 지웠습니다.", deleted);
        }
        return deleted;
    }
}
