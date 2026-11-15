package tn.supcom.museum.iam.data;

import jakarta.data.repository.BasicRepository;
import jakarta.data.repository.Insert;
import jakarta.data.repository.Repository;
import tn.supcom.museum.iam.entity.UserEntity;

import java.util.Optional;

/** Jakarta Data repository for middleware-managed accounts. */
@Repository
public interface UserData extends BasicRepository<UserEntity, String> {
    @Insert
    UserEntity insert(UserEntity user);

    Optional<UserEntity> findByUserId(String userId);

}
