package tn.supcom.museum.rest;

import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.Test;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.AuthenticatedUser;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.repository.DeviceRepository;
import tn.supcom.museum.repository.MeasurementRepository;
import tn.supcom.museum.security.AuthorizationService;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class MeasurementAuthorizationTest {
    private final MeasurementResource resource = createResource();

    private static MeasurementResource createResource() {
        Device east = device("sensor-east", "gallery-east");
        MeasurementResource resource = new MeasurementResource();
        resource.devices = new DeviceRepository() {
            @Override public Optional<Device> findById(String id) {
                return "sensor-east".equals(id) ? Optional.of(east) : Optional.empty();
            }
        };
        resource.measurements = new MeasurementRepository() {
            @Override public List<Measurement> findLatest(String zone) {
                return List.of(measurement(zone));
            }
            @Override public List<Measurement> findHistory(String device, String property,
                                                           java.time.Instant from, java.time.Instant to, int limit) {
                return List.of(measurement("gallery-east"));
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

    private static Device device(String id, String zone) {
        Device device = new Device();
        device.deviceId = id;
        device.zoneId = zone;
        return device;
    }

    private static Measurement measurement(String zone) {
        Measurement measurement = new Measurement();
        measurement.zoneId = zone;
        measurement.deviceId = "sensor-east";
        measurement.value = 20.0;
        return measurement;
    }

    @Test
    void clientCanReadOnlyAssignedZoneLatestAndHistory() {
        assertEquals("gallery-east", resource.latest("gallery-east", context("CLIENT", "gallery-east"))
                .getFirst().zoneId);
        assertEquals(403, assertThrows(ApiException.class,
                () -> resource.latest("gallery-west", context("CLIENT", "gallery-east"))).getStatus());

        assertEquals(1, resource.history("sensor-east", "temperature", null, null, 1000,
                context("CLIENT", "gallery-east")).size());
        assertEquals(403, assertThrows(ApiException.class,
                () -> resource.history("sensor-east", "temperature", null, null, 1000,
                        context("CLIENT", "gallery-west"))).getStatus());
        assertEquals(404, assertThrows(ApiException.class,
                () -> resource.history("missing", "temperature", null, null, 1000,
                        context("ADMIN"))).getStatus());
    }

    @Test
    void adminCanReadAnyZoneAndClientWithNoZonesGetsNoAccess() {
        assertEquals("gallery-west", resource.latest("gallery-west", context("ADMIN")).getFirst().zoneId);
        assertEquals(403, assertThrows(ApiException.class,
                () -> resource.latest("gallery-east", context("CLIENT"))).getStatus());
    }
}
