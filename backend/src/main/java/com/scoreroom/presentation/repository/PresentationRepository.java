package com.scoreroom.presentation.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.presentation.domain.Presentation;

public interface PresentationRepository extends JpaRepository<Presentation, UUID> {

    Optional<Presentation> findByIdAndProjectId(UUID id, UUID projectId);

    List<Presentation> findByProjectIdOrderBySortOrderAscIdAsc(UUID projectId);

    List<Presentation> findByProjectIdIn(Collection<UUID> projectIds);

    boolean existsByProjectIdAndTitleIgnoreCase(UUID projectId, String title);

    List<Presentation> findByIdIn(Collection<UUID> ids);

    @Query("select coalesce(max(p.sortOrder), 0) from Presentation p where p.projectId = :projectId")
    int findMaxSortOrder(UUID projectId);

    @Modifying(flushAutomatically = true)
    @Query("delete from Presentation p where p.id = :id")
    int deleteByIdNow(UUID id);
}
