package tn.supcom.museum.iam.security;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.iam.model.AuthenticatedUser;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuthorizationServiceTest {
    private final AuthorizationService authorization = new AuthorizationService();

    @Test
    void adminCanAccessAllZonesAndAdminOperations() {
        var admin = new AuthenticatedUser("admin-id", "ADMIN", List.of());
        assertDoesNotThrow(() -> authorization.requireAdmin(admin));
        assertDoesNotThrow(() -> authorization.requireZone(admin, "any-zone"));
    }

    @Test
    void clientIsRestrictedToAssignedZonesAndCannotPerformAdminActions() {
        var client = new AuthenticatedUser("client-id", "CLIENT", List.of("gallery-a"));
        assertDoesNotThrow(() -> authorization.requireZone(client, "gallery-a"));
        assertThrows(ApiException.class, () -> authorization.requireZone(client, "gallery-b"));
        assertThrows(ApiException.class, () -> authorization.requireZone(
                new AuthenticatedUser("empty-client", "CLIENT", List.of()), "gallery-a"));
        assertThrows(ApiException.class, () -> authorization.requireAdmin(client));
    }
}
