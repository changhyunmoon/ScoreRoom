package com.scoreroom.organization.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.organization.domain.Team;

public interface TeamRepository extends JpaRepository<Team, UUID> {

    /** 조직도 순서: sort_order, 이름 순 (화면이 상위 팀별로 묶는다) */
    List<Team> findByArchivedFalseOrderBySortOrderAscNameAsc();

    boolean existsByParentIdAndArchivedFalse(UUID parentId);

    boolean existsByParentId(UUID parentId);

    @Query("select coalesce(max(t.sortOrder), -1) from Team t where t.parentId is null")
    int findMaxRootSortOrder();

    @Query("select coalesce(max(t.sortOrder), -1) from Team t where t.parentId = :parentId")
    int findMaxChildSortOrder(UUID parentId);

    @Query(value = "select exists(select 1 from users where team_id = :teamId)", nativeQuery = true)
    boolean hasUsers(UUID teamId);

    /** 평가룸 참여 당시 소속으로 기록된 팀인지 (기록 보존을 위해 삭제 대신 보관) */
    @Query(value = "select exists(select 1 from memberships where team_id_at_join = :teamId)", nativeQuery = true)
    boolean isReferencedByMemberships(UUID teamId);
}
