package tn.supcom.museum.core.repository;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.entity.DeviceEntity;
import tn.supcom.museum.core.entity.ZoneEntity;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;

import static org.junit.jupiter.api.Assertions.*;

class LocationMappingTest {

    @Test
    void zoneCoordinatesRoundTrip() {
        Zone zone = new Zone("salle-01", "Textile gallery", new Location(36.8065, 10.1815, 0));
        Zone back = ZoneRepository.toModel(ZoneRepository.toEntity(zone));
        assertEquals("salle-01", back.zoneId);
        assertEquals("Textile gallery", back.name);
        assertEquals(36.8065, back.location.latitude);
        assertEquals(10.1815, back.location.longitude);
        assertEquals(0, back.location.floor);
    }

    @Test
    void zoneWithoutCoordinatesHasNoLocation() {
        ZoneEntity entity = new ZoneEntity();
        entity.zoneId = "salle-09";
        entity.latitude = 36.8;
        assertNull(ZoneRepository.toModel(entity).location);
    }

    @Test
    void deviceWithoutOwnCoordinatesHasNoLocation() {
        DeviceEntity entity = new DeviceEntity();
        entity.deviceId = "bme280-01";
        entity.zoneId = "salle-01";
        Device device = DeviceRepository.toModel(entity);
        assertNull(device.location);
        assertNull(device.locationSource);
    }

    @Test
    void ownDeviceCoordinatesArePersistedAndMarkedAsDevice() {
        Device device = new Device();
        device.deviceId = "bme280-01";
        device.zoneId = "salle-01";
        device.location = new Location(36.80652, 10.18148, 1);
        device.locationSource = Device.LOCATION_DEVICE;
        Device back = DeviceRepository.toModel(DeviceRepository.toEntity(device));
        assertEquals(36.80652, back.location.latitude);
        assertEquals(10.18148, back.location.longitude);
        assertEquals(1, back.location.floor);
        assertEquals(Device.LOCATION_DEVICE, back.locationSource);
        assertEquals("salle-01", back.zoneId);
    }

    @Test
    void inheritedZoneLocationIsNeverPersistedOnTheDevice() {
        Device device = new Device();
        device.deviceId = "bme280-01";
        device.location = new Location(36.8, 10.18, 0);
        device.locationSource = Device.LOCATION_ZONE;
        DeviceEntity entity = DeviceRepository.toEntity(device);
        assertNull(entity.latitude);
        assertNull(entity.longitude);
        assertNull(entity.floor);
    }
}
