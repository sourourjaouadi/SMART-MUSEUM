package tn.supcom.museum.api.rest;

import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.Test;
import tn.supcom.museum.api.error.ApiException;
import tn.supcom.museum.api.service.ApiAuthorizationService;
import tn.supcom.museum.api.service.InternalServiceClient;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;
import tn.supcom.museum.iam.model.AuthenticatedUser;

import java.security.Principal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ZoneAuthorizationTest {
    private final Zone east = new Zone("gallery-east", "East gallery", new Location(36.8065, 10.1815, 0));
    private final Zone west = new Zone("gallery-west", "West gallery", new Location(36.8066, 10.1817, 1));
    private final List<String> coreCalls = new ArrayList<>();

    private final InternalServiceClient services = new InternalServiceClient() {
        @Override public List<Zone> zones() { coreCalls.add("zones"); return List.of(east, west); }
        @Override public Zone zone(String id) {
            coreCalls.add("zone:" + id);
            return List.of(east, west).stream().filter(z -> z.zoneId.equals(id)).findFirst()
                    .orElseThrow(() -> ApiException.notFound("missing"));
        }
        @Override public Zone saveZone(String id, Zone zone) { coreCalls.add("save:" + id); return zone; }
        @Override public Device assignLocation(String id, Location location) { coreCalls.add("assign:" + id); return new Device(); }
        @Override public Device clearLocation(String id) { coreCalls.add("clear:" + id); return new Device(); }
    };

    private ZoneResource zones() {
        ZoneResource resource = new ZoneResource();
        resource.services = services;
        resource.authorization = new ApiAuthorizationService();
        return resource;
    }

    private DeviceResource devices() {
        DeviceResource resource = new DeviceResource();
        resource.services = services;
        resource.authorization = new ApiAuthorizationService();
        return resource;
    }

    static SecurityContext context(String role, String... zones) {
        AuthenticatedUser user = new AuthenticatedUser("user-id", role, List.of(zones));
        return new SecurityContext() {
            @Override public Principal getUserPrincipal() { return user; }
            @Override public boolean isUserInRole(String roleName) { return role.equals(roleName); }
            @Override public boolean isSecure() { return true; }
            @Override public String getAuthenticationScheme() { return "Bearer"; }
        };
    }

    private static int status(Runnable call) {
        return assertThrows(ApiException.class, call::run).getStatus();
    }

    @Test
    void adminSeesAllZonesAndClientOnlyAssignedOnes() {
        ZoneResource resource = zones();
        assertEquals(List.of(east, west), resource.list(context("ADMIN")));
        assertEquals(List.of(east), resource.list(context("CLIENT", "gallery-east")));
        assertEquals(List.of(), resource.list(context("CLIENT")));
    }

    @Test
    void clientZoneDetailIsDeniedBeforeExistenceIsRevealed() {
        ZoneResource resource = zones();
        assertEquals(east, resource.get("gallery-east", context("CLIENT", "gallery-east")));
        assertEquals(403, status(() -> resource.get("gallery-west", context("CLIENT", "gallery-east"))));
        assertEquals(403, status(() -> resource.get("unknown-zone", context("CLIENT", "gallery-east"))));
        // Les refus CLIENT ne consultent jamais le CORE : l'existence d'une zone n'est pas divulguee.
        assertEquals(List.of("zone:gallery-east"), coreCalls);
        assertEquals(404, status(() -> resource.get("unknown-zone", context("ADMIN"))));
    }

    @Test
    void invalidZoneIdIsRejectedBeforeCallingCore() {
        assertEquals(400, status(() -> zones().get("bad/zone", context("ADMIN"))));
        assertEquals(400, status(() -> zones().put("bad zone", east, context("ADMIN"))));
        assertTrue(coreCalls.isEmpty());
    }

    @Test
    void onlyAdminCanWriteZonesAndDeviceLocations() {
        Location location = new Location(36.8, 10.18, 0);
        assertEquals(403, status(() -> zones().put("gallery-east", east, context("CLIENT", "gallery-east"))));
        assertEquals(403, status(() -> devices().assignLocation("sensor-east", location, context("CLIENT", "gallery-east"))));
        assertEquals(403, status(() -> devices().clearLocation("sensor-east", context("CLIENT", "gallery-east"))));
        assertTrue(coreCalls.isEmpty());

        zones().put("gallery-east", east, context("ADMIN"));
        devices().assignLocation("sensor-east", location, context("ADMIN"));
        devices().clearLocation("sensor-east", context("ADMIN"));
        assertEquals(List.of("save:gallery-east", "assign:sensor-east", "clear:sensor-east"), coreCalls);
    }

    @Test
    void coreConflictForUnapprovedDeviceIsPropagated() {
        DeviceResource resource = devices();
        resource.services = new InternalServiceClient() {
            @Override public Device assignLocation(String id, Location location) {
                throw new ApiException(409, "INVALID_STATE", "Appareil non approuve (pending) : " + id);
            }
        };
        assertEquals(409, status(() -> resource.assignLocation("pending-01", new Location(36.8, 10.18, 0), context("ADMIN"))));
        assertEquals(400, status(() -> resource.assignLocation("bad id", new Location(36.8, 10.18, 0), context("ADMIN"))));
    }
}
