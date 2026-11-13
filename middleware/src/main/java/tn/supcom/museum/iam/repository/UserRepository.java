package tn.supcom.museum.iam.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.iam.data.UserData;
import tn.supcom.museum.iam.entity.UserEntity;
import tn.supcom.museum.iam.model.UserAccount;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@ApplicationScoped
public class UserRepository {
    @Inject
    UserData data;

    public Optional<UserEntity> findByEmail(String email) {
        return data.findById(normalizeEmail(email));
    }

    public Optional<UserEntity> findByUserId(String userId) {
        return data.findByUserId(userId);
    }

    public UserEntity insert(UserEntity user) {
        return data.insert(user);
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public static UserAccount toAccount(UserEntity user) {
        return new UserAccount(user.userId, user.name, user.email, user.role,
                user.status, user.zoneIds == null ? List.of() : List.copyOf(user.zoneIds));
    }
}
