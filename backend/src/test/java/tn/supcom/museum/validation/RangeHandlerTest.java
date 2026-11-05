/*
 * Module  : RangeHandlerTest
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class RangeHandlerTest {

    private final RangeHandler handler = new RangeHandler();

    @Test
    void normalValuePasses() {
        assertEquals(ValidationHandler.Outcome.ACCEPTED, handler.handle(SchemaHandlerTest.valid()));
    }

    @Test
    void temperatureTooHighIs422() {
        Measurement m = SchemaHandlerTest.valid();
        m.value = 120.0;
        assertEquals(422, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void humidityAbove100Is422() {
        Measurement m = SchemaHandlerTest.valid();
        m.property = "humidity";
        m.value = 101.0;
        assertEquals(422, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void pressureBelowMinIs422() {
        Measurement m = SchemaHandlerTest.valid();
        m.property = "pressure";
        m.value = 100.0;
        assertEquals(422, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void badQualityIs422() {
        Measurement m = SchemaHandlerTest.valid();
        m.quality = "bad";
        assertEquals(422, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }

    @Test
    void futureDateIs422() {
        Measurement m = SchemaHandlerTest.valid();
        m.observedAt = Instant.now().plus(1, ChronoUnit.HOURS).toString();
        assertEquals(422, assertThrows(ApiException.class, () -> handler.handle(m)).getStatus());
    }
}
