package com.scoreroom.common.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class ClockConfig {

    /** 시각은 UTC로 저장한다. 한국 시간은 화면에서 표시할 때 적용한다 */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
