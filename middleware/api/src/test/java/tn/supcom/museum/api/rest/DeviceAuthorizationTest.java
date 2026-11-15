package tn.supcom.museum.api.rest;

import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.iam.security.AuthorizationService;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class DeviceAuthorizationTest {
    private final Device east = device("sensor-east", "gallery-east", "pending");
    private final Device west = device("sensor-west", "gallery-west", "active");

    private DeviceResource resource() {
        DeviceResource resource = new DeviceResource();
        resource.devices = new DeviceRepository() {
            @Override
            public List<Device> findByStatus(String status) {
                return List.of(east, west).stream()
                        .filter(device -> status == null || status.equals(device.status)).toList();
            }

            @Override
            public Optional<Device> findById(String deviceId) {
                return List.of(east, west).stream().filter(device -> deviceId.equals(device.deviceId)).findFirst();
            }
        };
        resource.authorization = new AuthorizationService();
        return resource;
    }

    private static SecurityContext context(String role, String... zones) {
        AuthenticatedUser user = new AuthenticatedUser("user-id", role, List.of(zones));
        return new SecurityContext() {
            @Override public Principal getUserPrincipal() { return user; }
            @Override public boolean isUserInRole(String roleName) { return role.equals(roleName); }
            @Override public boolean isSecure() { return true; }
            @Override public String getAuthenticationScheme() { return "Bearer"; }
        };
    }

    private static Device device(String id, String zone, String status) {
        Device device = new Device();
        device.deviceId = id;
        device.zoneId = zone;
        device.status = status;
        return device;
    }

    @Test
    void clientListIsFilteredAndDetailCannotEscapeAssignedZone() {
        DeviceResource resource = resource();
        assertEquals(List.of(east), resource.list(null, context("CLIENT", "gallery-east")));
        ApiException denied = assertThrows(ApiException.class,
                () -> resource.get("sensor-west", null, context("CLIENT", "gallery-east")));
        assertEquals(403, denied.getStatus());
        assertEquals(List.of(), resource.list(null, context("CLIENT")));
    }

    @Test
    void adminCanReadAcrossZonesAndClientsCannotApproveOrReject() {
        DeviceResource resource = resource();
        assertEquals(List.of(east, west), resource.list(null, context("ADMIN")));
        ApiException denied = assertThrows(ApiException.class,
                () -> resource.approve("sensor-east", context("CLIENT", "gallery-east")));
        assertEquals(403, denied.getStatus());
        denied = assertThrows(ApiException.class,
                () -> resource.reject("sensor-east", context("CLIENT", "gallery-east")));
        assertEquals(403, denied.getStatus());
    }
}
