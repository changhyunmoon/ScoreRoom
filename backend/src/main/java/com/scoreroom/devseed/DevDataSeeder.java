package com.scoreroom.devseed;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.scoreroom.invitation.domain.InviteCode;
import com.scoreroom.invitation.repository.InviteCodeRepository;
import com.scoreroom.organization.domain.Team;
import com.scoreroom.organization.repository.TeamRepository;
import com.scoreroom.presentation.domain.Crew;
import com.scoreroom.presentation.domain.Presentation;
import com.scoreroom.presentation.domain.PresentationMember;
import com.scoreroom.presentation.domain.PresentationType;
import com.scoreroom.presentation.repository.PresentationMemberRepository;
import com.scoreroom.presentation.repository.PresentationRepository;
import com.scoreroom.project.domain.Project;
import com.scoreroom.project.domain.ProjectSettings;
import com.scoreroom.project.repository.ProjectRepository;
import com.scoreroom.project.service.MembershipService;
import com.scoreroom.rating.domain.Rating;
import com.scoreroom.rating.repository.RatingRepository;
import com.scoreroom.user.domain.User;
import com.scoreroom.user.repository.UserRepository;
import com.scoreroom.user.service.UserRegistrar;

/**
 * 로컬 개발용 가상 데이터. local 프로필에서 일반 사용자가 한 명도 없을 때만 한 번 넣는다.
 * 실제 직원 정보를 쓰지 않는다. 모든 가상 계정의 비밀번호는 password1! 이다.
 */
@Component
@Profile("local")
@Order(10)
public class DevDataSeeder implements ApplicationRunner {

    public static final String PASSWORD = "password1!";
    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private final UserRepository users;
    private final UserRegistrar registrar;
    private final TeamRepository teams;
    private final ProjectRepository projects;
    private final MembershipService membershipService;
    private final PresentationRepository presentations;
    private final PresentationMemberRepository presentationMembers;
    private final RatingRepository ratings;
    private final InviteCodeRepository inviteCodes;
    private final Clock clock;

    public DevDataSeeder(UserRepository users, UserRegistrar registrar, TeamRepository teams,
            ProjectRepository projects, MembershipService membershipService, PresentationRepository presentations,
            PresentationMemberRepository presentationMembers, RatingRepository ratings,
            InviteCodeRepository inviteCodes, Clock clock) {
        this.users = users;
        this.registrar = registrar;
        this.teams = teams;
        this.projects = projects;
        this.membershipService = membershipService;
        this.presentations = presentations;
        this.presentationMembers = presentationMembers;
        this.ratings = ratings;
        this.inviteCodes = inviteCodes;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.findAllByOrderBySortOrderAscNameAsc().stream().anyMatch(u -> !u.isSysAdmin())) {
            return;
        }
        Team company = teams.save(new Team("스코어랩", null, 0));
        Team dev = teams.save(new Team("제품개발본부", company.getId(), 0));
        Team platform = teams.save(new Team("플랫폼팀", dev.getId(), 0));
        Team service = teams.save(new Team("서비스팀", dev.getId(), 1));
        Team data = teams.save(new Team("데이터팀", dev.getId(), 2));
        Team support = teams.save(new Team("경영지원본부", company.getId(), 1));
        Team hr = teams.save(new Team("인사팀", support.getId(), 0));

        User head = user("doyun.kim", "김도윤", "본부장", dev, 1);
        User seojun = user("seojun.lee", "이서준", "팀장", platform, 2);
        User jiwoo = user("jiwoo.park", "박지우", "책임", platform, 3);
        User harin = user("harin.choi", "최하린", "선임", platform, 4);
        User minjae = user("minjae.jung", "정민재", "사원", platform, 5);
        User yerin = user("yerin.kang", "강예린", "팀장", service, 6);
        User siwoo = user("siwoo.yoon", "윤시우", "책임", service, 7);
        User jimin = user("jimin.han", "한지민", "선임", service, 8);
        User eunwoo = user("eunwoo.jo", "조은우", "사원", service, 9);
        User chaewon = user("chaewon.lim", "임채원", "팀장", data, 10);
        User yujin = user("yujin.song", "송유진", "선임", data, 11);
        User taeo = user("taeo.jang", "장태오", "사원", data, 12);
        User sua = user("sua.bae", "배수아", "팀장", hr, 13);
        sua.setViewAll(true);

        Instant now = clock.instant();

        // 진행 중인 평가룸: 개발본부 전원 참여, 운영자 이서준·강예린
        Project seminar = projects.save(new Project("2026 하반기 기술 세미나", "팀별 기술 공유 발표", seojun.getId()));
        seminar.applySettings(new ProjectSettings(0, 100, 30, 80, false, false, false, true));
        for (User u : List.of(seojun, yerin)) {
            membershipService.join(seminar, u, true);
        }
        for (User u : List.of(head, jiwoo, harin, minjae, siwoo, jimin, eunwoo, chaewon, yujin, taeo)) {
            membershipService.join(seminar, u, false);
        }
        InviteCode code = new InviteCode(seminar.getId());
        code.reissue("SEM26H", seojun.getId(), now, null);
        inviteCodes.save(code);

        Presentation p1 = presentation(seminar, 1, "쿠버네티스 비용 최적화 사례", "클러스터 비용을 40% 줄인 과정과 시행착오",
                PresentationType.PERSONAL, new Crew(jiwoo.getId(), List.of(), List.of()), null);
        Presentation p2 = presentation(seminar, 2, "결제 서비스 장애 회고", "결제 지연 장애의 원인과 재발 방지 대책",
                PresentationType.TEAM, new Crew(yerin.getId(), List.of(siwoo.getId()), List.of(jimin.getId(), eunwoo.getId())),
                "https://example.com/payment-postmortem");
        presentation(seminar, 3, "실시간 데이터 파이프라인 설계", "스트리밍 처리로 지표 지연을 줄인 방법",
                PresentationType.TEAM, new Crew(chaewon.getId(), List.of(chaewon.getId(), yujin.getId()), List.of(taeo.getId())), null);
        presentation(seminar, 4, "사내 디자인 시스템 2.0", "컴포넌트 규칙을 다시 정리한 이야기",
                PresentationType.PERSONAL, new Crew(harin.getId(), List.of(), List.of()), null);

        rate(seminar, p1, jiwoo, yerin, 85, null);
        rate(seminar, p1, jiwoo, siwoo, 72, "비용 절감 수치가 구체적이라 좋았어요.");
        rate(seminar, p1, jiwoo, chaewon, 64, null);
        rate(seminar, p1, jiwoo, yujin, 90, null);
        rate(seminar, p2, yerin, seojun, 77, "재발 방지 대책이 명확했습니다.");
        rate(seminar, p2, yerin, jiwoo, 81, null);
        rate(seminar, p2, siwoo, seojun, 70, null);

        // 마감된 평가룸
        Project onboarding = projects.save(new Project("신입 온보딩 발표회", "온보딩 과제 결과 발표", chaewon.getId()));
        onboarding.applySettings(new ProjectSettings(0, 5, null, null, false, true, false, false));
        membershipService.join(onboarding, chaewon, true);
        for (User u : List.of(head, taeo, minjae, eunwoo)) {
            membershipService.join(onboarding, u, false);
        }
        Presentation p5 = presentation(onboarding, 1, "첫 달 회고", "온보딩 과제와 배운 점", PresentationType.PERSONAL,
                new Crew(taeo.getId(), List.of(), List.of()), null);
        rate(onboarding, p5, taeo, chaewon, 4, null);
        rate(onboarding, p5, taeo, head, 5, "꾸준히 성장한 모습이 보였어요.");
        onboarding.close(now.minus(Duration.ofDays(20)));

        log.info("로컬 가상 데이터를 넣었습니다. 계정 예: seojun.lee@example.com / {}", PASSWORD);
    }

    private User user(String id, String name, String position, Team team, int no) {
        return registrar.registerMember(id + "@example.com", PASSWORD, name, String.format("010-0000-%04d", no),
                team.getId(), position);
    }

    private Presentation presentation(Project project, int order, String title, String intro, PresentationType type,
            Crew crew, String deployUrl) {
        Presentation p = new Presentation(project.getId(), crew.leaderId(), order);
        p.describe(title, intro, type, deployUrl);
        p.changeLeader(crew.leaderId());
        presentations.save(p);
        List<UUID> everyone = crew.everyone();
        for (int i = 0; i < everyone.size(); i++) {
            presentationMembers.save(new PresentationMember(project.getId(), p.getId(), everyone.get(i),
                    crew.isPresenter(everyone.get(i)), i));
        }
        return p;
    }

    private void rate(Project project, Presentation p, User target, User rater, int score, String feedback) {
        ratings.save(new Rating(project.getId(), p.getId(), target.getId(), rater.getId(), score, feedback, clock.instant()));
    }
}
