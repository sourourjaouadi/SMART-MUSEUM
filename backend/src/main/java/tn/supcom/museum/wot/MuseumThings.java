package tn.supcom.museum.wot;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Construit les Thing Descriptions W3C WoT 1.1 des capteurs du musee.
 * Les formes d'interaction suivent la convention de topics MQTT :
 * museum/v1/{zoneId}/{deviceId}/{telemetry|status|event|td}.
 */
public final class MuseumThings {

    public static final String ID_PREFIX = "urn:museum:device:";

    private MuseumThings() {
    }

    public static String thingId(String deviceId) {
        return ID_PREFIX + deviceId;
    }

    /** TD d'un capteur BME280 : temperature, humidite et pression, plus l'evenement de statut. */
    public static Map<String, Object> bme280(String deviceId, String zoneId, String brokerUri) {
        String base = trimSlash(brokerUri) + "/museum/v1/" + zoneId + "/" + deviceId + "/";

        Map<String, Object> td = new LinkedHashMap<>();
        td.put("@context", List.of(ThingDescriptionValidator.TD_CONTEXT_V11, Map.of("museum", "urn:museum:")));
        td.put("@type", "Thing");
        td.put("id", thingId(deviceId));
        td.put("title", "BME280 " + deviceId);
        td.put("description", "Capteur environnemental de la zone " + zoneId);
        td.put("securityDefinitions", Map.of("nosec_sc", Map.of("scheme", "nosec")));
        td.put("security", "nosec_sc");

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("temperature", measurement("Temperature", "°C", -40, 85, base));
        props.put("humidity", measurement("Humidite relative", "%", 0, 100, base));
        props.put("pressure", measurement("Pression", "hPa", 300, 1100, base));
        td.put("properties", props);

        td.put("events", Map.of("status", Map.of(
                "title", "Statut de l'appareil (online/offline, LWT)",
                "data", Map.of("type", "string", "enum", List.of("online", "offline")),
                "forms", List.of(form(base + "status", "subscribeevent")))));
        return td;
    }

    private static Map<String, Object> measurement(String title, String unit, double min, double max, String base) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("title", title);
        p.put("type", "number");
        p.put("unit", unit);
        p.put("minimum", min);
        p.put("maximum", max);
        p.put("readOnly", true);
        p.put("observable", true);
        p.put("forms", List.of(form(base + "telemetry", "observeproperty")));
        return p;
    }

    private static Map<String, Object> form(String href, String op) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("href", href);
        f.put("op", List.of(op));
        f.put("contentType", "application/json");
        return f;
    }

    private static String trimSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
