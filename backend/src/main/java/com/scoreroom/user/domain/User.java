package com.scoreroom.user.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.error.ApiException;
import com.scoreroom.common.persistence.TimestampedEntity;

/**
 * 로그인 사용자. loginId는 정규화한(소문자) 이메일 주소다.
 * sortOrder는 팀 안 순서로, 작을수록 위(높은 사람)다.
 */
@Entity
@Table(name = "users")
public class User extends TimestampedEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "login_id", nullable = false)
    private String loginId;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;

    @Column(name = "team_id")
    private UUID teamId;

    @Column(nullable = false)
    private String position;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_sys_admin", nullable = false)
    private boolean sysAdmin;

    @Column(name = "can_view_all", nullable = false)
    private boolean canViewAll;

    @Column(nullable = false)
    private boolean enabled = true;

    protected User() {
    }

    private User(String loginId, String passwordHash, String name, String phone, UUID teamId, String position,
            int sortOrder, boolean sysAdmin) {
        this.id = UUID.randomUUID();
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.name = name;
        this.phone = phone;
        this.teamId = teamId;
        this.position = position;
        this.sortOrder = sortOrder;
        this.sysAdmin = sysAdmin;
    }

    public static User member(String loginId, String passwordHash, String name, String phone, UUID teamId,
            String position, int sortOrder) {
        return new User(loginId, passwordHash, name, phone, teamId, position, sortOrder, false);
    }

    /** 시스템 관리자는 팀에 속하지 않고 평가룸에 참여하지 않는다 */
    public static User sysAdmin(String loginId, String passwordHash, String name) {
        return new User(loginId, passwordHash, name, "", null, "", 0, true);
    }

    public void updateContact(String loginId, String name, String phone) {
        this.loginId = loginId;
        this.name = name;
        this.phone = phone;
    }

    public void changePosition(String position) {
        this.position = position;
    }

    /** 팀을 옮기면 새 팀의 맨 아래(sortOrder)로 간다 */
    public void moveToTeam(UUID teamId, int sortOrder) {
        this.teamId = teamId;
        this.sortOrder = sortOrder;
    }

    public void changeSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setViewAll(boolean canViewAll) {
        if (sysAdmin && canViewAll) {
            throw ApiException.badRequest("시스템 관리자에게는 줄 수 없습니다.");
        }
        this.canViewAll = canViewAll;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public String getLoginId() {
        return loginId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getName() {
        return name;
    }

    public String getPhone() {
        return phone;
    }

    public UUID getTeamId() {
        return teamId;
    }

    public String getPosition() {
        return position;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isSysAdmin() {
        return sysAdmin;
    }

    public boolean canViewAll() {
        return canViewAll;
    }

    public boolean isEnabled() {
        return enabled;
    }
}
