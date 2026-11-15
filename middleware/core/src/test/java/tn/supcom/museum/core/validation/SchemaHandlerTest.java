/*
 * Module  : SchemaHandlerTest
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.core.validation;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Measurement;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SchemaHandlerTest {

    static Measurement valid() {
        Measurement m = new Measurement();
        m.measurementId = UUID.randomUUID().toString();
        m.deviceId = "bme280-01";
        m.zoneId = "salle-01";
        m.gatewayId = "gw-01";
        m.property = "temperature";
        m.value = 21.4;
        m.unit = "°C";
        m.observedAt = Instant.now().toString();
        m.source = "real";
        m.quality = "good";
        return m;
    }

    private final SchemaHandler handler = new SchemaHandler();

    @Test
    void validMeasurementPasses() {
        assertEquals(ValidationHandler.Outcome.ACCEPTED, handler.handle(valid()));
    }

    @Test
    void missingQualityDefaultsToGood() {
        Measurement m = valid();
        m.quality = null;
        handler.handle(m);
        assertEquals("good", m.quality);
    }

    @Test
    void nullBodyIs400() {
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(null)).getStatus());
    }

    @Test
    void missingDeviceIdIs400() {
        Measurement m = valid();
        m.deviceId = null;
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void badUuidIs400() {
        Measurement m = valid();
        m.measurementId = "pas-un-uuid";
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void unknownPropertyIs400() {
        Measurement m = valid();
        m.property = "radiation";
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void badDateIs400() {
        Measurement m = valid();
        m.observedAt = "hier";
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void nanValueIs400() {
        Measurement m = valid();
        m.value = Double.NaN;
        assertEquals(400, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }
}
