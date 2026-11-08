package tn.supcom.museum.security;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.entity.UserEntity;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.LoginRequest;
import tn.supcom.museum.model.LoginResponse;
import tn.supcom.museum.model.UserAccount;
import tn.supcom.museum.repository.UserRepository;

import java.util.List;
import java.util.HashSet;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Pattern;

@ApplicationScoped
public class UserAuthenticationService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final List<String> ROLES = List.of("ADMIN", "CLIENT");

    @Inject
    UserRepository users;
    @Inject
    PasswordHasher passwords;
    @Inject
    AccessTokenService tokens;

    public LoginResponse login(LoginRequest request) {
        if (request == null || request.email == null || request.password == null
                || !EMAIL.matcher(request.email.trim()).matches()
                || request.password.isEmpty()) {
            throw ApiException.badRequest("Valid email and password are required");
        }
        UserEntity user = users.findByEmail(request.email).orElse(null);
        if (user == null || !"active".equals(user.status)
                || !passwords.verify(request.password, user.passwordHash)) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        AccessTokenService.IssuedToken issued = tokens.issue(user.userId, user.role);
        UserAccount account = UserRepository.toAccount(user);
        return new LoginResponse(issued.value(), "Bearer", issued.expiresIn(), account);
    }

    public UserEntity requireActiveUser(String userId) {
        UserEntity user = users.findByUserId(userId)
                .filter(candidate -> "active".equals(candidate.status))
                .orElseThrow(() -> ApiException.unauthorized("Invalid or expired access token"));
        if (!ROLES.contains(user.role)) {
            throw ApiException.unauthorized("Invalid or expired access token");
        }
        return user;
    }

    public UserEntity provision(String name, String email, String password, String role, List<String> zones) {
        validateAccount(name, email, password, role, zones);
        String normalizedEmail = UserRepository.normalizeEmail(email);
        if (users.findByEmail(normalizedEmail).isPresent()) {
            throw ApiException.conflict("An account with this email already exists");
        }
        UserEntity user = new UserEntity();
        user.emailKey = normalizedEmail;
        user.userId = UUID.randomUUID().toString();
        user.name = name.trim();
        user.email = normalizedEmail;
        user.passwordHash = passwords.hash(password);
        user.role = role;
        user.status = "active";
        user.zoneIds = role.equals("ADMIN") ? List.of() : List.copyOf(zones);
        try {
            return users.insert(user);
        } catch (RuntimeException e) {
            // Mongo's _id is the normalized email, so concurrent duplicate provisioning is rejected.
            if (users.findByEmail(normalizedEmail).isPresent()) {
                throw ApiException.conflict("An account with this email already exists");
            }
            throw e;
        }
    }

    private static void validateAccount(String name, String email, String password,
                                        String role, List<String> zones) {
        if (name == null || name.isBlank() || name.length() > 120
                || email == null || !EMAIL.matcher(email.trim()).matches() || email.length() > 254
                || password == null || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72
                || role == null || !ROLES.contains(role)
                || zones == null || new HashSet<>(zones).size() != zones.size()
                || zones.stream().anyMatch(z -> z == null || !tn.supcom.museum.validation.SchemaHandler.ID.matcher(z).matches())) {
            throw ApiException.badRequest("Invalid user account fields");
        }
    }
}
