package com.scoreroom.common.persistence;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;

import org.springframework.data.domain.Persistable;

/**
 * ID를 애플리케이션에서 정하는 엔티티의 공통 부모.
 * save()가 새 엔티티를 merge(추가 SELECT) 대신 persist로 처리하도록 새 엔티티 여부를 알려준다.
 */
@MappedSuperclass
public abstract class PersistableEntity<ID> implements Persistable<ID> {

    @Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNew = false;
    }
}
