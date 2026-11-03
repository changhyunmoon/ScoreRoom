package com.scoreroom.organization.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.TimestampedEntity;

/** 회사 조직도의 팀. 과거 평가룸 참여 기록이 가리키는 팀은 지우지 않고 보관(archived) 처리한다 */
@Entity
@Table(name = "teams")
public class Team extends TimestampedEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean archived;

    protected Team() {
    }

    public Team(String name, UUID parentId, int sortOrder) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.parentId = parentId;
        this.sortOrder = sortOrder;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void moveUnder(UUID parentId) {
        this.parentId = parentId;
    }

    public void archive() {
        this.archived = true;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getParentId() {
        return parentId;
    }

    public String getName() {
        return name;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isArchived() {
        return archived;
    }
}
