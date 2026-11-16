package tn.supcom.museum.core.startup;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.geo.LocationService;
import tn.supcom.museum.core.model.Zone;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SeedZonesTest {

    @Test
    void sampleZonesCoverSeededDevicesWithValidTunisCoordinates() {
        List<Zone> zones = SeedBean.sampleZones();
        assertEquals(List.of("salle-01", "salle-02"), zones.stream().map(z -> z.zoneId).toList());
        for (Zone zone : zones) {
            assertFalse(zone.name.isBlank());
            assertDoesNotThrow(() -> LocationService.validate(zone.location));
            // Echantillon dans le centre de Tunis.
            assertEquals(36.8, zone.location.latitude, 0.05);
            assertEquals(10.18, zone.location.longitude, 0.05);
        }
    }
}
