package com.scoreroom.rating.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.scoreroom.common.persistence.PersistableEntity;

/** 평가자가 발표 구성원 한 명(target)에게 준 점수와 피드백. 수정은 덮어쓰기만 한다 */
@Entity
@Table(name = "ratings")
public class Rating extends PersistableEntity<UUID> {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "presentation_id", nullable = false)
    private UUID presentationId;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "rater_id", nullable = false)
    private UUID raterId;

    @Column(nullable = false)
    private int score;

    private String feedback;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    protected Rating() {
    }

    public Rating(UUID projectId, UUID presentationId, UUID targetId, UUID raterId, int score, String feedback,
            Instant submittedAt) {
        this.id = UUID.randomUUID();
        this.projectId = projectId;
        this.presentationId = presentationId;
        this.targetId = targetId;
        this.raterId = raterId;
        this.score = score;
        this.feedback = feedback;
        this.submittedAt = submittedAt;
    }

    public boolean sameAs(int score, String feedback) {
        return this.score == score && Objects.equals(this.feedback, feedback);
    }

    public void overwrite(int score, String feedback, Instant submittedAt) {
        this.score = score;
        this.feedback = feedback;
        this.submittedAt = submittedAt;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getPresentationId() {
        return presentationId;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public UUID getRaterId() {
        return raterId;
    }

    public int getScore() {
        return score;
    }

    public String getFeedback() {
        return feedback;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }
}
