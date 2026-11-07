package tn.supcom.museum.wot;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Regles W3C WoT TD 1.1 appliquees lors de la decouverte, sans base de donnees. */
class ThingDescriptionValidatorTest {

    static Map<String, Object> valid() {
        return new HashMap<>(MuseumThings.bme280("bme280-09", "salle-03", "mqtt://localhost:1883"));
    }

    @Test
    void seededThingDescriptionIsValid() {
        assertEquals(List.of(), ThingDescriptionValidator.validate(valid(), "bme280-09"));
    }

    @Test
    void contextMustBeTd11() {
        Map<String, Object> td = valid();
        td.put("@context", "https://www.w3.org/2019/wot/td/v1");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
        td.put("@context", ThingDescriptionValidator.TD_CONTEXT_V11);
        assertTrue(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
    }

    @Test
    void idMustBeUriMatchingDevice() {
        Map<String, Object> td = valid();
        td.put("id", "pas une uri");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
        td.put("id", "urn:museum:device:autre");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
    }

    @Test
    void securityMustReferenceDefinedScheme() {
        Map<String, Object> td = valid();
        td.put("security", "basic_sc");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
        td.remove("securityDefinitions");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
    }

    @Test
    void affordanceWithoutFormsIsRejected() {
        Map<String, Object> td = valid();
        td.put("properties", Map.of("temperature", Map.of("type", "number", "unit", "°C")));
        assertTrue(ThingDescriptionValidator.validate(td, "bme280-09").stream()
                .anyMatch(e -> e.contains("properties.temperature.forms")));
    }

    @Test
    void thingWithoutAffordanceIsRejected() {
        Map<String, Object> td = valid();
        td.remove("properties");
        td.remove("events");
        assertFalse(ThingDescriptionValidator.validate(td, "bme280-09").isEmpty());
    }

    @Test
    void declaredPropertiesExposeUnits() {
        Map<String, String> p = ThingDescriptionValidator.declaredProperties(valid());
        assertEquals("°C", p.get("temperature"));
        assertEquals("hPa", p.get("pressure"));
        assertFalse(p.containsKey("illuminance"));
    }
}
