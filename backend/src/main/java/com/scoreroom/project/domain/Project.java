package com.scoreroom.project.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.TimestampedEntity;

/**
 * 평가룸. version은 룸 안의 쓰기 작업마다 1씩 올라간다.
 * 위험한 변경(평가 삭제)을 확인받을 때 화면이 본 version과 비교해, 그 사이 데이터가 바뀌었으면 다시 확인받는다.
 */
@Entity
@Table(name = "projects")
public class Project extends TimestampedEntity<UUID> {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectStatus status = ProjectStatus.OPEN;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(nullable = false)
    private long version;

    @Column(name = "score_min", nullable = false)
    private int scoreMin;

    @Column(name = "score_max", nullable = false)
    private int scoreMax;

    @Column(name = "agg_min")
    private Integer aggMin;

    @Column(name = "agg_max")
    private Integer aggMax;

    @Column(name = "allow_self", nullable = false)
    private boolean allowSelf;

    @Column(name = "allow_same_team", nullable = false)
    private boolean allowSameTeam;

    @Column(name = "allow_same_crew", nullable = false)
    private boolean allowSameCrew;

    @Column(name = "allow_edit", nullable = false)
    private boolean allowEdit;

    @Column(name = "show_rating_status", nullable = false)
    private boolean showRatingStatus;

    @Column(name = "count_self", nullable = false)
    private boolean countSelf;

    @Column(name = "count_same_crew", nullable = false)
    private boolean countSameCrew;

    @Column(name = "count_same_team", nullable = false)
    private boolean countSameTeam;

    protected Project() {
    }

    public Project(String name, String description, UUID createdBy) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        applySettings(ProjectSettings.defaults());
    }

    public ProjectSettings settings() {
        return new ProjectSettings(scoreMin, scoreMax, aggMin, aggMax, allowSelf, allowSameTeam, allowSameCrew, allowEdit,
                showRatingStatus, countSelf, countSameCrew, countSameTeam);
    }

    public void applySettings(ProjectSettings settings) {
        this.scoreMin = settings.min();
        this.scoreMax = settings.max();
        this.aggMin = settings.aggMin();
        this.aggMax = settings.aggMax();
        this.allowSelf = settings.allowSelf();
        this.allowSameTeam = settings.allowSameTeam();
        this.allowSameCrew = settings.allowSameCrew();
        this.allowEdit = settings.allowEdit();
        this.showRatingStatus = settings.showRatingStatus();
        this.countSelf = settings.countSelf();
        this.countSameCrew = settings.countSameCrew();
        this.countSameTeam = settings.countSameTeam();
    }

    public boolean isOpen() {
        return status == ProjectStatus.OPEN;
    }

    public void close(Instant now) {
        this.status = ProjectStatus.CLOSED;
        this.closedAt = now;
    }

    /** 룸 쓰기 작업마다 부른다 */
    public void bumpVersion() {
        this.version++;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public ProjectStatus getStatus() {
        return status;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public long getVersion() {
        return version;
    }
}
