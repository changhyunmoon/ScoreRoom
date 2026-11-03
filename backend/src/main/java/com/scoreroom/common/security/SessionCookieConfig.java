package com.scoreroom.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

import com.scoreroom.common.config.AppProperties;

/**
 * 세션 쿠키: JS에서 읽지 못하고(HttpOnly), 다른 사이트에서 보낸 요청에는 실리지 않으며(SameSite=Lax),
 * 운영(HTTPS)에서는 Secure로만 보낸다. 로컬 http 개발 프로필에서만 Secure를 끈다.
 */
@Configuration(proxyBeanMethods = false)
public class SessionCookieConfig {

    public static final String COOKIE_NAME = "SCOREROOM_SESSION";

    @Bean
    public CookieSerializer cookieSerializer(AppProperties properties) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(COOKIE_NAME);
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setSameSite("Lax");
        serializer.setUseSecureCookie(properties.session().secureCookie());
        return serializer;
    }
}
