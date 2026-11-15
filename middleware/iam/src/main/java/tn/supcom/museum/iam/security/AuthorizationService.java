package tn.supcom.museum.iam.security;

import jakarta.enterprise.context.ApplicationScoped;
import tn.supcom.museum.iam.model.AuthenticatedUser;

@ApplicationScoped
public class AuthorizationService {
    public void requireAdmin(AuthenticatedUser user) {
        if (user == null || !"ADMIN".equals(user.role())) {
            throw IamException.forbidden("ADMIN role required");
        }
    }

    public void requireZone(AuthenticatedUser user, String zoneId) {
        if (user == null || (!"ADMIN".equals(user.role())
                && (user.zoneIds() == null || !user.zoneIds().contains(zoneId)))) {
            throw IamException.forbidden("Access to this zone is not permitted");
        }
    }
}
