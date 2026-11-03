package com.scoreroom.project.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

import com.scoreroom.project.domain.Project;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    /**
     * 룸 쓰기 작업의 첫 단계. 같은 평가룸의 쓰기를 한 줄로 세워 마감·설정 변경·평가 제출이 서로 앞지르지 않게 한다.
     * 5초 안에 잠금을 얻지 못하면 409로 응답한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "5000"))
    @Query("select p from Project p where p.id = :id")
    Optional<Project> findByIdForUpdate(UUID id);

    List<Project> findByIdIn(Collection<UUID> ids);
}
