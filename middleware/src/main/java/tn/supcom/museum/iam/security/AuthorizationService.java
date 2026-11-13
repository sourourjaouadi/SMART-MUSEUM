package tn.supcom.museum.iam.security;

import jakarta.enterprise.context.ApplicationScoped;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.iam.model.AuthenticatedUser;

@ApplicationScoped
public class AuthorizationService {
    public void requireAdmin(AuthenticatedUser user) {
        if (user == null || !"ADMIN".equals(user.role())) {
            throw ApiException.accessDenied("ADMIN role required");
        }
    }

    public void requireZone(AuthenticatedUser user, String zoneId) {
        if (user == null || (!"ADMIN".equals(user.role())
                && (user.zoneIds() == null || !user.zoneIds().contains(zoneId)))) {
            throw ApiException.accessDenied("Access to this zone is not permitted");
        }
    }
}
