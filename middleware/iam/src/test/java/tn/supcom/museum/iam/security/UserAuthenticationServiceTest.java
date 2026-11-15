package tn.supcom.museum.iam.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.iam.entity.UserEntity;
import tn.supcom.museum.iam.model.LoginRequest;
import tn.supcom.museum.iam.repository.UserRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class UserAuthenticationServiceTest {
    private final Map<String, UserEntity> records = new HashMap<>();
    private UserAuthenticationService authentication;
    private PasswordHasher passwords;

    @BeforeEach
    void setUp() {
        passwords = new PasswordHasher();
        UserRepository repository = new UserRepository() {
            @Override
            public Optional<UserEntity> findByEmail(String email) {
                return Optional.ofNullable(records.get(UserRepository.normalizeEmail(email)));
            }

            @Override
            public Optional<UserEntity> findByUserId(String userId) {
                return records.values().stream().filter(user -> userId.equals(user.userId)).findFirst();
            }

            @Override
            public UserEntity insert(UserEntity user) {
                if (records.containsKey(user.emailKey)) throw new IllegalStateException("duplicate _id");
                records.put(user.emailKey, user);
                return user;
            }
        };
        AccessTokenService tokens = new AccessTokenService();
        tokens.configure(new byte[32], "test", 900);
        authentication = new UserAuthenticationService();
        authentication.users = repository;
        authentication.passwords = passwords;
        authentication.tokens = tokens;
    }

    @Test
    void provisionsUniqueAccountsWithHashedPasswordsAndIssuesBearerToken() {
        UserEntity user = authentication.provision("Museum Admin", "Admin@museum.test",
                "a-long-admin-passphrase", "ADMIN", List.of());

        assertNotEquals("a-long-admin-passphrase", user.passwordHash);
        assertEquals("admin@museum.test", user.emailKey);
        assertTrue(passwords.verify("a-long-admin-passphrase", user.passwordHash));
        LoginRequest request = new LoginRequest();
        request.email = "ADMIN@museum.test";
        request.password = "a-long-admin-passphrase";
        var response = authentication.login(request);
        assertEquals("Bearer", response.tokenType());
        assertEquals("ADMIN", response.user().role());
        assertEquals(user.userId, response.user().userId());
        assertEquals(900, response.expiresIn());
        assertThrows(ApiException.class, () -> authentication.provision("Other", "admin@museum.test",
                "another-long-passphrase", "ADMIN", List.of()));
    }

    @Test
    void rejectsWrongPasswordsDisabledAccountsAndInvalidInput() {
        UserEntity user = authentication.provision("Client", "client@museum.test",
                "a-long-client-passphrase", "CLIENT", List.of("gallery-a"));
        LoginRequest request = new LoginRequest();
        request.email = user.email;
        request.password = "wrong-password";
        assertThrows(ApiException.class, () -> authentication.login(request));

        user.status = "disabled";
        request.password = "a-long-client-passphrase";
        assertThrows(ApiException.class, () -> authentication.login(request));
        assertThrows(ApiException.class, () -> authentication.requireActiveUser(user.userId));

        request.email = "not-an-email";
        assertThrows(ApiException.class, () -> authentication.login(request));
    }

    @Test
    void unknownEmailStillRunsPasswordCheck() {
        int[] verifyCalls = {0};
        authentication.passwords = new PasswordHasher() {
            @Override
            public boolean verify(String password, String hash) {
                verifyCalls[0]++;
                return super.verify(password, hash);
            }
        };
        LoginRequest request = new LoginRequest();
        request.email = "nobody@museum.test";
        request.password = "a-long-client-passphrase";

        ApiException e = assertThrows(ApiException.class, () -> authentication.login(request));
        assertEquals(401, e.getStatus());
        assertEquals(1, verifyCalls[0], "BCrypt doit tourner meme si l'email n'existe pas");
    }
}
