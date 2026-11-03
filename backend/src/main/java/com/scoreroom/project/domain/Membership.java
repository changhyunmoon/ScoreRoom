package com.scoreroom.project.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/**
 * 평가룸 참여자. 참여할 때의 회사 팀(teamIdAtJoin, teamNameAtJoin)을 기록해 두고
 * 이후 조직이 바뀌어도 고치지 않는다. 같은 팀 평가 제한은 이 값으로 판단한다.
 */
@Entity
@Table(name = "memberships")
@IdClass(MembershipId.class)
public class Membership extends PersistableEntity<MembershipId> {

    @Id
    @Column(name = "project_id")
    private UUID projectId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "team_id_at_join")
    private UUID teamIdAtJoin;

    @Column(name = "team_name_at_join")
    private String teamNameAtJoin;

    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected Membership() {
    }

    public Membership(UUID projectId, UUID userId, UUID teamIdAtJoin, String teamNameAtJoin, boolean admin,
            Instant joinedAt) {
        this.projectId = projectId;
        this.userId = userId;
        this.teamIdAtJoin = teamNameAtJoin == null ? null : teamIdAtJoin;
        this.teamNameAtJoin = teamIdAtJoin == null ? null : teamNameAtJoin;
        this.admin = admin;
        this.joinedAt = joinedAt;
    }

    public void setAdmin(boolean admin) {
        this.admin = admin;
    }

    @Override
    public MembershipId getId() {
        return new MembershipId(projectId, userId);
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getTeamIdAtJoin() {
        return teamIdAtJoin;
    }

    public String getTeamNameAtJoin() {
        return teamNameAtJoin;
    }

    public boolean isAdmin() {
        return admin;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
