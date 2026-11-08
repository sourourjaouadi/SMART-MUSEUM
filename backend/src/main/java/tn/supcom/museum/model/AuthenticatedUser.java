package tn.supcom.museum.model;

import java.security.Principal;
import java.util.List;

/** Principal built from a validated access token; current role and zones come from storage. */
public record AuthenticatedUser(String userId, String role, List<String> zoneIds) implements Principal {
    @Override
    public String getName() {
        return userId;
    }
}
