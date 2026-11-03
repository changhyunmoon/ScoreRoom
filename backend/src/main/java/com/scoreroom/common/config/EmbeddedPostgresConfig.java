package com.scoreroom.common.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import com.zaxxer.hikari.HikariDataSource;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/**
 * 로컬 개발 전용(embedded-db 프로필): Docker나 PostgreSQL 설치 없이 실제 PostgreSQL을 함께 띄운다.
 * 데이터는 backend/.local/postgres에 남아 재시작해도 유지된다. 운영 jar에는 포함되지 않는다.
 */
@Configuration(proxyBeanMethods = false)
@Profile("embedded-db")
public class EmbeddedPostgresConfig {

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres(
            @Value("${scoreroom.embedded-db.port:54329}") int port,
            @Value("${scoreroom.embedded-db.dir:./.local/postgres}") String dir) throws IOException {
        Path dataDir = Path.of(dir).toAbsolutePath().normalize();
        // PostgreSQL 실행 파일을 ASCII 경로에 풀어 둔다 (사용자 폴더 이름이 한글이어도 동작하도록)
        Path binDir = dataDir.resolveSibling("postgres-bin");
        Files.createDirectories(dataDir);
        Files.createDirectories(binDir);
        return EmbeddedPostgres.builder()
                .setDataDirectory(dataDir.toFile())
                .setCleanDataDirectory(false)
                .setOverrideWorkingDirectory(binDir.toFile())
                .setPort(port)
                .setLocaleConfig("locale", "C")
                .start();
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres postgres) {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(postgres.getJdbcUrl("postgres", "postgres"));
        dataSource.setUsername("postgres");
        dataSource.setMaximumPoolSize(10);
        return dataSource;
    }
}
