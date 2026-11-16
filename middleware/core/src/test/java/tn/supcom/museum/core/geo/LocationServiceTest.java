package tn.supcom.museum.core.geo;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.core.repository.ZoneRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class LocationServiceTest {

    private final Map<String, Zone> zoneStore = new TreeMap<>();
    private final Map<String, Device> deviceStore = new TreeMap<>();

    private LocationService service() {
        LocationService service = new LocationService();
        service.zones = new ZoneRepository() {
            @Override public Optional<Zone> findById(String id) { return Optional.ofNullable(zoneStore.get(id)).map(LocationServiceTest::copy); }
            @Override public List<Zone> findAll() { return zoneStore.values().stream().map(LocationServiceTest::copy).toList(); }
            @Override public Zone save(Zone zone) { zoneStore.put(zone.zoneId, copy(zone)); return copy(zone); }
        };
        service.devices = new DeviceRepository() {
            @Override public Optional<Device> findById(String id) { return Optional.ofNullable(deviceStore.get(id)).map(LocationServiceTest::copy); }
            @Override public boolean updateLocation(String id, Location location) {
                Device d = deviceStore.get(id);
                if (d == null) return false;
                d.location = location;
                d.locationSource = location == null ? null : Device.LOCATION_DEVICE;
                return true;
            }
        };
        return service;
    }

    private void device(String id, String zone, String status) {
        Device d = new Device();
        d.deviceId = id;
        d.zoneId = zone;
        d.status = status;
        deviceStore.put(id, d);
    }

    private static Zone copy(Zone z) {
        return new Zone(z.zoneId, z.name, z.location == null ? null : z.location.copy());
    }

    private static Device copy(Device s) {
        Device d = new Device();
        d.deviceId = s.deviceId;
        d.zoneId = s.zoneId;
        d.status = s.status;
        d.location = s.location == null ? null : s.location.copy();
        d.locationSource = s.locationSource;
        return d;
    }

    private static int status(Runnable call) {
        return assertThrows(ApiException.class, call::run).getStatus();
    }

    @Test
    void saveZoneTrimsNameAndIsIdempotent() {
        LocationService service = service();
        Zone body = new Zone(null, "  Textile gallery ", new Location(36.8065, 10.1815, 0));
        Zone saved = service.saveZone("salle-01", body);
        service.saveZone("salle-01", body);
        assertEquals("Textile gallery", saved.name);
        assertEquals(1, service.zones().size());
        assertEquals(36.8065, service.zone("salle-01").location.latitude);
    }

    @Test
    void invalidCoordinatesAndZoneBodiesAreRejectedWith400() {
        LocationService service = service();
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(90.1, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(-90.1, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(36.0, 180.5, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(Double.NaN, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(36.0, null, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", new Location(36.0, 10.0, 201)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, "A", null))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone(null, " ", new Location(36.0, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", new Zone("salle-02", "A", new Location(36.0, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("bad id", new Zone(null, "A", new Location(36.0, 10.0, 0)))));
        assertEquals(400, status(() -> service.saveZone("salle-01", null)));
        assertTrue(zoneStore.isEmpty());
    }

    @Test
    void boundaryCoordinatesAreAccepted() {
        LocationService service = service();
        service.saveZone("pole", new Zone(null, "Edge", new Location(-90.0, 180.0, -10)));
        assertEquals(-90.0, service.zone("pole").location.latitude);
    }

    @Test
    void unknownZoneIs404() {
        assertEquals(404, status(() -> service().zone("salle-99")));
    }

    @Test
    void deviceInheritsZoneCoordinatesUntilItGetsItsOwn() {
        LocationService service = service();
        service.saveZone("salle-01", new Zone(null, "Textile gallery", new Location(36.8065, 10.1815, 0)));
        device("bme280-01", "salle-01", Device.ACTIVE);

        Device inherited = service.device("bme280-01");
        assertEquals(Device.LOCATION_ZONE, inherited.locationSource);
        assertEquals(36.8065, inherited.location.latitude);

        Device own = service.assign("bme280-01", new Location(36.80652, 10.18148, 1));
        assertEquals(Device.LOCATION_DEVICE, own.locationSource);
        assertEquals(10.18148, own.location.longitude);
        assertEquals("salle-01", own.zoneId);

        Device cleared = service.clear("bme280-01");
        assertEquals(Device.LOCATION_ZONE, cleared.locationSource);
        assertEquals(10.1815, cleared.location.longitude);
        assertEquals("salle-01", cleared.zoneId);
    }

    @Test
    void deviceInZoneWithoutCoordinatesHasNoLocation() {
        device("bme280-01", "salle-07", Device.ACTIVE);
        Device d = service().device("bme280-01");
        assertNull(d.location);
        assertNull(d.locationSource);
    }

    @Test
    void onlyApprovedDevicesCanBeLocated() {
        LocationService service = service();
        device("pending-01", "salle-01", Device.PENDING);
        device("rejected-01", "salle-01", Device.REJECTED);
        device("offline-01", "salle-01", Device.OFFLINE);
        Location location = new Location(36.8, 10.18, 0);
        assertEquals(409, status(() -> service.assign("pending-01", location)));
        assertEquals(409, status(() -> service.assign("rejected-01", location)));
        assertEquals(409, status(() -> service.clear("pending-01")));
        assertEquals(404, status(() -> service.assign("missing-01", location)));
        assertEquals(Device.LOCATION_DEVICE, service.assign("offline-01", location).locationSource);
        assertNull(deviceStore.get("pending-01").location);
    }

    @Test
    void invalidDeviceLocationIs400AndLeavesDeviceUnchanged() {
        LocationService service = service();
        device("bme280-01", "salle-01", Device.ACTIVE);
        assertEquals(400, status(() -> service.assign("bme280-01", new Location(91.0, 10.0, 0))));
        assertEquals(400, status(() -> service.assign("bme280-01", null)));
        assertNull(deviceStore.get("bme280-01").location);
    }

    @Test
    void resolveAllUsesOwnOrZoneLocation() {
        LocationService service = service();
        service.saveZone("salle-01", new Zone(null, "Textile gallery", new Location(36.8065, 10.1815, 0)));
        Device own = new Device();
        own.deviceId = "a";
        own.zoneId = "salle-01";
        own.location = new Location(1.0, 2.0, null);
        own.locationSource = Device.LOCATION_DEVICE;
        Device inheriting = new Device();
        inheriting.deviceId = "b";
        inheriting.zoneId = "salle-01";
        Device elsewhere = new Device();
        elsewhere.deviceId = "c";
        elsewhere.zoneId = "salle-02";

        List<Device> result = service.resolveAll(new ArrayList<>(List.of(own, inheriting, elsewhere)));
        assertEquals(Device.LOCATION_DEVICE, result.get(0).locationSource);
        assertEquals(1.0, result.get(0).location.latitude);
        assertEquals(Device.LOCATION_ZONE, result.get(1).locationSource);
        assertNull(result.get(2).location);
    }
}
