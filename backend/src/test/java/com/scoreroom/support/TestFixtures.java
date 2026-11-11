package com.scoreroom.support;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.scoreroom.organization.domain.Team;
import com.scoreroom.organization.repository.TeamRepository;
import com.scoreroom.presentation.domain.PresentationType;
import com.scoreroom.presentation.dto.SavePresentationRequest;
import com.scoreroom.presentation.service.PresentationService;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.dto.CreateProjectRequest;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.project.service.ProjectService;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;
import com.scoreroom.user.service.UserRegistrar;

/** 테스트 데이터를 서비스 규칙대로 만든다. 모든 이름과 이메일은 가상이다 */
@Component
public class TestFixtures {

    public static final String PASSWORD = "password1!";

    private final TeamRepository teams;
    private final UserRepository users;
    private final UserRegistrar registrar;
    private final ProjectService projectService;
    private final ProjectRepository projects;
    private final MembershipService membershipService;
    private final PresentationService presentationService;
    private final AtomicInteger teamSeq = new AtomicInteger();
    private final TransactionTemplate tx;

    public TestFixtures(TeamRepository teams, UserRepository users, UserRegistrar registrar,
            ProjectService projectService, ProjectRepository projects, MembershipService membershipService,
            PresentationService presentationService, PlatformTransactionManager transactionManager) {
        this.teams = teams;
        this.users = users;
        this.registrar = registrar;
        this.projectService = projectService;
        this.projects = projects;
        this.membershipService = membershipService;
        this.presentationService = presentationService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public Team team(String name) {
        return teams.save(new Team(name, null, 0));
    }

    public User user(String key, Team team) {
        return tx.execute(s -> registrar.registerMember(key + "@example.com", PASSWORD, "사용자 " + key, "010-0000-0000",
                team == null ? null : team.getId(), ""));
    }

    public User sysAdmin() {
        return tx.execute(s -> registrar.registerSysAdmin("admin@example.com", PASSWORD, "관리자"));
    }

    public User reload(User user) {
        return users.findById(user.getId()).orElseThrow();
    }

    /** owner가 만든 평가룸에 나머지를 참여시킨다. owner에게는 평가룸 생성 권한을 먼저 준다 */
    public UUID room(User owner, User... members) {
        allowCreateRoom(owner);
        UUID projectId = projectService.create(owner.getId(), new CreateProjectRequest("평가룸", ""));
        tx.executeWithoutResult(s -> {
            var project = projects.findById(projectId).orElseThrow();
            // 기존 테스트는 본인·같은 팀·같은 발표 팀원 평가를 막는 평가룸 기준이다 (새 평가룸 기본값은 모두 허용)
            project.applySettings(new ProjectSettings(0, 100, null, null, false, false, false, true, true, true, true, true, true, true, false, false, false));
            for (User m : members) {
                membershipService.join(project, m, false);
            }
        });
        return projectId;
    }

    /** 시스템 관리자가 평가룸 생성 권한을 준 것처럼 만든다 */
    public void allowCreateRoom(User user) {
        tx.executeWithoutResult(s -> users.findById(user.getId()).orElseThrow().setCreateRoom(true));
    }

    public UUID personal(UUID projectId, User leader) {
        return presentationService.create(leader.getId(), projectId, new SavePresentationRequest(
                "개인 발표 " + leader.getName(), "", PresentationType.PERSONAL, leader.getId(), List.of(), List.of(), null));
    }

    public UUID teamPresentation(UUID projectId, User leader, List<User> presenters, List<User> members) {
        return presentationService.create(leader.getId(), projectId, new SavePresentationRequest(
                "팀 발표 " + teamSeq.incrementAndGet(), "", PresentationType.TEAM, leader.getId(),
                presenters.stream().map(User::getId).toList(), members.stream().map(User::getId).toList(), null));
    }

    public long version(UUID projectId) {
        return projects.findById(projectId).orElseThrow().getVersion();
    }
}
