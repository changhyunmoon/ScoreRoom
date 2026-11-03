package com.scoreroom.user.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.scoreroom.user.domain.User;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByLoginId(String loginId);

    /** 이메일 찾기: 같은 이름의 사용 중인 일반 사용자 */
    List<User> findByNameAndSysAdminFalseAndEnabledTrue(String name);

    boolean existsByLoginId(String loginId);

    boolean existsByLoginIdAndIdNot(String loginId, UUID id);

    boolean existsByIdAndEnabledTrue(UUID id);

    boolean existsByIdAndSysAdminTrue(UUID id);

    boolean existsBySysAdminTrue();

    /** 팀 안 순서대로 (위 = 높은 사람). 같은 순서면 이름 순 */
    List<User> findByTeamIdAndSysAdminFalseOrderBySortOrderAscNameAsc(UUID teamId);

    List<User> findByTeamIdIsNullAndSysAdminFalseOrderBySortOrderAscNameAsc();

    List<User> findAllByOrderBySortOrderAscNameAsc();

    @Query("select coalesce(max(u.sortOrder), -1) from User u where u.teamId = :teamId and u.sysAdmin = false")
    int findMaxSortOrderInTeam(UUID teamId);

    @Query("select coalesce(max(u.sortOrder), -1) from User u where u.teamId is null and u.sysAdmin = false")
    int findMaxSortOrderWithoutTeam();
}
