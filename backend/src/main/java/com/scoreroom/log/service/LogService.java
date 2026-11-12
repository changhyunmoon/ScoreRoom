package com.scoreroom.log.service;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Clock;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.scoreroom.common.error.ErrorCode;
import com.scoreroom.common.security.AuthenticatedUser;
import com.scoreroom.common.web.RequestIdFilter;
import com.scoreroom.log.domain.LogAction;
import com.scoreroom.log.domain.SystemLog;
import com.scoreroom.log.repository.SystemLogRepository;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;

/**
 * 시스템 관리자 로그 화면에 보일 기록을 남긴다.
 * - activity: 업무 작업과 같은 트랜잭션에서 남긴다 (작업이 롤백되면 기록도 남지 않는다)
 * - independent: 오류·거절·로그인처럼 업무 트랜잭션 밖에서 남기는 기록. 실패해도 응답을 깨뜨리지 않는다
 * 요청 ID·경로·IP·브라우저는 현재 요청에서 자동으로 채운다. 비밀번호와 요청 본문은 남기지 않는다.
 */
@Service
public class LogService {

    private static final Logger log = LoggerFactory.getLogger(LogService.class);
    /** 이 요청에서 이미 따로 기록을 남겼다는 표시 (거절 기록이 겹치지 않게) */
    private static final String LOGGED_ATTRIBUTE = "scoreroom.logged";
    private static final int STACK_MAX = 8 * 1024;
    private static final Pattern ERROR_TYPE = Pattern.compile("^(?:Uncaught )?([A-Za-z]*Error)\\b");
    private static final Pattern PROJECT_PATH = Pattern.compile(
            "/(?:projects|p)/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");

    private final SystemLogRepository logs;
    private final UserRepository users;
    private final ProjectRepository projects;
    private final PresentationRepository presentations;
    private final TransactionTemplate separate;
    private final Clock clock;

    public LogService(SystemLogRepository logs, UserRepository users, ProjectRepository projects,
            PresentationRepository presentations, PlatformTransactionManager txManager, Clock clock) {
        this.logs = logs;
        this.users = users;
        this.projects = projects;
        this.presentations = presentations;
        this.separate = new TransactionTemplate(txManager);
        this.separate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activity(UUID actorId, UUID projectId, LogAction action, String message) {
        activity(actorId, projectId, action, message, null);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void activity(UUID actorId, UUID projectId, LogAction action, String message, String detail) {
        logs.save(build(actorId, projectId, action, message).detail(detail));
    }

    /** 지워지는 평가를 평가자·발표·점수·피드백과 함께 남긴다 (지우기 전에 부른다). 없으면 남기지 않는다 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void ratingsDeleted(UUID actorId, UUID projectId, String reason, Collection<Rating> removed) {
        if (removed.isEmpty()) {
            return;
        }
        activity(actorId == null ? currentActor() : actorId, projectId, LogAction.RATINGS_DELETED,
                "평가 " + removed.size() + "건 삭제 · 사유: " + reason, describeRatings(removed));
    }

    /** 업무 트랜잭션과 따로 남긴다. 어떤 이유로든 실패하면 서버 로그에만 남기고 넘어간다 */
    public void independent(LogAction action, UUID actorId, UUID projectId, String message, String detail,
            Integer status, String errorType) {
        HttpServletRequest request = currentRequest();
        if (request != null) {
            request.setAttribute(LOGGED_ATTRIBUTE, Boolean.TRUE);
        }
        UUID project = projectId != null ? projectId : projectInPath(request);
        try {
            separate.executeWithoutResult(tx -> logs.save(
                    build(actorId, project, action, message).detail(detail).status(status).error(errorType)));
        } catch (RuntimeException e) {
            log.warn("로그를 남기지 못했습니다: {} {}", action, e.toString());
        }
    }

    /**
     * 사용자에게 4xx로 거절한 요청. 이 요청에서 이미 다른 기록(로그인 실패 등)을 남겼으면 겹쳐 남기지 않는다.
     * 로그인 안 된 상태의 401은 세션 만료 확인 요청이 대부분이라 남기지 않는다.
     */
    public void rejected(ErrorCode code, String message) {
        HttpServletRequest request = currentRequest();
        if (code.status().value() >= 500 || code == ErrorCode.UNAUTHENTICATED
                || (request != null && request.getAttribute(LOGGED_ATTRIBUTE) != null)) {
            return;
        }
        independent(LogAction.rejectedBy(code), currentActor(), null, message, null, code.status().value(), code.name());
    }

    /** 처리하지 못한 서버 오류. 스택은 앞부분만 남긴다 */
    public void serverError(Throwable e) {
        independent(LogAction.SERVER_ERROR, currentActor(), null,
                e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage()),
                stackTrace(e), 500, e.getClass().getName());
    }

    /** DB 제약조건 위반 (동시 변경 충돌 등). 사용자에게는 409로 응답한다 */
    public void dataConflict(Throwable e, Throwable cause) {
        independent(LogAction.DATA_CONFLICT, currentActor(), null,
                "DB 제약 위반: " + cause.getMessage(), stackTrace(e), 409, cause.getClass().getName());
    }

    /** 로그인·로그아웃. 비밀번호는 받지 않는다 */
    public void auth(LogAction action, UUID actorId, String message) {
        independent(action, actorId, null, message, null, null, null);
    }

    /** 화면(브라우저)에서 보낸 오류. 화면 주소에 평가룸이 있으면 그 평가룸 로그로 묶는다 */
    public void clientError(String message, String stack, String url, String componentStack) {
        String text = message == null || message.isBlank() ? "(메시지 없음)" : SystemLog.cut(message.strip(), 300);
        String pagePath = pagePath(url);
        Matcher type = ERROR_TYPE.matcher(text);
        StringBuilder detail = new StringBuilder("화면 주소: ").append(SystemLog.cut(url, 500));
        if (stack != null && !stack.isBlank()) {
            detail.append("\n\n").append(SystemLog.cut(stack, STACK_MAX));
        }
        if (componentStack != null && !componentStack.isBlank()) {
            detail.append("\n\n[화면 구성 요소]\n").append(SystemLog.cut(componentStack.strip(), 4096));
        }
        independent(LogAction.CLIENT_ERROR, currentActor(), projectIn(pagePath),
                pagePath == null ? text : text + " · " + pagePath, detail.toString(), null,
                type.find() ? type.group(1) : null);
    }

    /** 전체 주소에서 경로 부분만 (https://host/p/123?x → /p/123) */
    private static String pagePath(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            String path = java.net.URI.create(url.strip()).getPath();
            return path == null || path.isEmpty() ? null : SystemLog.cut(path, 200);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static String stackTrace(Throwable e) {
        StringWriter out = new StringWriter();
        e.printStackTrace(new PrintWriter(out));
        return SystemLog.cut(out.toString(), STACK_MAX);
    }

    private static UUID projectInPath(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        return projectIn(request.getRequestURI());
    }

    /** 주소에 평가룸 ID가 있으면 꺼낸다 (API /projects/{id}, 화면 /p/{id}) */
    public static UUID projectIn(String path) {
        if (path == null) {
            return null;
        }
        Matcher m = PROJECT_PATH.matcher(path);
        return m.find() ? UUID.fromString(m.group(1)) : null;
    }

    /** 지금 로그인한 사람 (없으면 null) */
    public static UUID currentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthenticatedUser u ? u.userId() : null;
    }

    public String userName(UUID userId) {
        return userId == null ? null : users.findById(userId).map(User::getName).orElse(null);
    }

    /** "홍길동 → 'AI 도입' 8점 · 피드백: …" 한 줄씩 */
    public String describeRatings(Collection<Rating> ratings) {
        Map<UUID, String> names = users.findAllById(ratings.stream().map(Rating::getRaterId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, User::getName));
        Map<UUID, String> titles = presentations.findByIdIn(ratings.stream().map(Rating::getPresentationId).distinct().toList())
                .stream().collect(Collectors.toMap(Presentation::getId, Presentation::getTitle));
        return ratings.stream()
                .map(r -> names.getOrDefault(r.getRaterId(), "(알 수 없음)") + " → '"
                        + titles.getOrDefault(r.getPresentationId(), "(삭제된 발표)") + "' " + r.getScore() + "점"
                        + (r.getFeedback() == null ? "" : " · 피드백: " + r.getFeedback()))
                .collect(Collectors.joining("\n"));
    }

    private SystemLog build(UUID actorId, UUID projectId, LogAction action, String message) {
        SystemLog entry = new SystemLog(action, message, clock.instant())
                .actor(actorId, userName(actorId))
                .project(projectId, projectId == null ? null
                        : projects.findById(projectId).map(p -> p.getName()).orElse(null));
        HttpServletRequest request = currentRequest();
        if (request != null) {
            entry.request(RequestIdFilter.of(request), request.getMethod(), request.getRequestURI(),
                    request.getRemoteAddr(), request.getHeader("User-Agent"));
        }
        return entry;
    }

    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? attrs.getRequest() : null;
    }
}
