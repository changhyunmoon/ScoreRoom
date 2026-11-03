package com.scoreroom;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ScoreRoomApplication {

    public static void main(String[] args) {
        SpringApplication.run(ScoreRoomApplication.class, args);
    }
}
