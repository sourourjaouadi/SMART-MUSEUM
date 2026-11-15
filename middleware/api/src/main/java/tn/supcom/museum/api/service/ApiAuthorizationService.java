package tn.supcom.museum.api.service;
import jakarta.enterprise.context.ApplicationScoped;
import tn.supcom.museum.api.error.ApiException;
import tn.supcom.museum.iam.model.AuthenticatedUser;
@ApplicationScoped public class ApiAuthorizationService {
 public void requireAdmin(AuthenticatedUser user) { if (user == null || !"ADMIN".equals(user.role())) throw ApiException.accessDenied("ADMIN role required"); }
 public void requireZone(AuthenticatedUser user, String zone) { if (user == null || (!"ADMIN".equals(user.role()) && (user.zoneIds()==null || !user.zoneIds().contains(zone)))) throw ApiException.accessDenied("Access to this zone is not permitted"); }
}
