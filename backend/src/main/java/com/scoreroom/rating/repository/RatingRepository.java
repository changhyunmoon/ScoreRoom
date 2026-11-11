package com.scoreroom.rating.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.rating.domain.Rating;

public interface RatingRepository extends JpaRepository<Rating, UUID> {

    Optional<Rating> findByPresentationIdAndRaterId(UUID presentationId, UUID raterId);

    List<Rating> findByProjectId(UUID projectId);

    List<Rating> findByProjectIdIn(Collection<UUID> projectIds);

    long countByProjectId(UUID projectId);

    boolean existsByPresentationId(UUID presentationId);

    /** 점수를 한 번이라도 받은 발표 (구성원 추가·제외를 막는 데 쓴다) */
    @Query("select distinct r.presentationId from Rating r where r.projectId in :projectIds")
    List<UUID> findRatedPresentationIds(Collection<UUID> projectIds);

    @Modifying(flushAutomatically = true)
    @Query("delete from Rating r where r.projectId = :projectId")
    int deleteAllInProject(UUID projectId);

    @Modifying(flushAutomatically = true)
    @Query("delete from Rating r where r.presentationId = :presentationId")
    int deleteAllForPresentation(UUID presentationId);

    /** 참여자가 준 점수 (받은 점수는 발표에 붙어 있어 발표가 지워질 때 함께 지워진다) */
    @Modifying(flushAutomatically = true)
    @Query("delete from Rating r where r.projectId = :projectId and r.raterId = :userId")
    int deleteGivenBy(UUID projectId, UUID userId);

    @Modifying(flushAutomatically = true)
    @Query("delete from Rating r where r.id in :ids")
    int deleteByIds(Collection<UUID> ids);
}
