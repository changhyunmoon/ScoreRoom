package com.scoreroom.presentation.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 발표 구성원 = 평가 대상. 대표도 여기에 들어 있고, 대표가 발표도 하면 isPresenter가 true다 */
@Entity
@Table(name = "presentation_members")
@IdClass(PresentationMemberId.class)
public class PresentationMember extends PersistableEntity<PresentationMemberId> {

    @Id
    @Column(name = "presentation_id")
    private UUID presentationId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "is_presenter", nullable = false)
    private boolean presenter;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected PresentationMember() {
    }

    public PresentationMember(UUID projectId, UUID presentationId, UUID userId, boolean presenter, int sortOrder) {
        this.projectId = projectId;
        this.presentationId = presentationId;
        this.userId = userId;
        this.presenter = presenter;
        this.sortOrder = sortOrder;
    }

    public void assignRole(boolean presenter, int sortOrder) {
        this.presenter = presenter;
        this.sortOrder = sortOrder;
    }

    @Override
    public PresentationMemberId getId() {
        return new PresentationMemberId(presentationId, userId);
    }

    public UUID getPresentationId() {
        return presentationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public boolean isPresenter() {
        return presenter;
    }

    public int getSortOrder() {
        return sortOrder;
    }
}
