package tn.supcom.museum.validation;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** Une mesure doit correspondre a une propriete declaree dans la TD de l'appareil. */
class AffordanceHandlerTest {

    private static final Map<String, String> TD_PROPS = Map.of("temperature", "°C", "humidity", "%");

    @Test
    void declaredPropertyIsAccepted() {
        AffordanceHandler h = new AffordanceHandler(id -> Optional.of(TD_PROPS));
        assertEquals(ValidationHandler.Outcome.ACCEPTED, h.handle(SchemaHandlerTest.valid()));
    }

    @Test
    void undeclaredPropertyIsRejected() {
        AffordanceHandler h = new AffordanceHandler(id -> Optional.of(TD_PROPS));
        Measurement m = SchemaHandlerTest.valid();
        m.property = "illuminance";
        m.unit = "lx";
        ApiException e = assertThrows(ApiException.class, () -> h.handle(m));
        assertEquals(422, e.getStatus());
        assertEquals("UNDECLARED_PROPERTY", e.getCode());
    }

    @Test
    void unitMustMatchThingDescription() {
        AffordanceHandler h = new AffordanceHandler(id -> Optional.of(TD_PROPS));
        Measurement m = SchemaHandlerTest.valid();
        m.unit = "K";
        assertEquals(422, assertThrows(ApiException.class, () -> h.handle(m)).getStatus());
    }

    @Test
    void deviceWithoutThingDescriptionIsNotChecked() {
        AffordanceHandler h = new AffordanceHandler(id -> Optional.empty());
        assertEquals(ValidationHandler.Outcome.ACCEPTED, h.handle(SchemaHandlerTest.valid()));
    }
}
