package tn.supcom.museum.iam.model;

import java.security.Principal;
import java.util.List;

public record AuthenticatedUser(String userId, String role, List<String> zoneIds) implements Principal {
    @Override public String getName() { return userId; }
}
