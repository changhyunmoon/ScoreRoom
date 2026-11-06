package com.scoreroom.presentation.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.TimestampedEntity;

/**
 * 개인·팀 발표. 대표(leaderId)는 한 명이며 presentation_members에도 반드시 들어 있다.
 * 발표자 여부는 presentation_members.is_presenter로 표현한다.
 */
@Entity
@Table(name = "presentations")
public class Presentation extends TimestampedEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String intro;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PresentationType type;

    @Column(name = "leader_id", nullable = false)
    private UUID leaderId;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "deploy_url")
    private String deployUrl;

    protected Presentation() {
    }

    public Presentation(UUID projectId, UUID createdBy, int sortOrder) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.createdBy = createdBy;
        this.sortOrder = sortOrder;
    }

    public void describe(String title, String intro, PresentationType type, String deployUrl) {
        this.title = title;
        this.intro = intro;
        this.type = type;
        this.deployUrl = deployUrl;
    }

    public void changeLeader(UUID leaderId) {
        this.leaderId = leaderId;
    }

    public void changeSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    /** 발표와 자료를 수정·삭제할 수 있는 사람: 룸 관리자, 구성원(대표·발표자·팀원), 발표를 만든 사람 */
    public boolean canBeEditedBy(UUID userId, boolean roomAdmin, boolean crewMember) {
        return roomAdmin || crewMember || leaderId.equals(userId) || createdBy.equals(userId);
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getTitle() {
        return title;
    }

    public String getIntro() {
        return intro;
    }

    public PresentationType getType() {
        return type;
    }

    public UUID getLeaderId() {
        return leaderId;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public String getDeployUrl() {
        return deployUrl;
    }
}
