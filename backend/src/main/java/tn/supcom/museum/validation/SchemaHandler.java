/*
 * Module  : SchemaHandler
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/** Maillon 1 : structure et types du message (400). */
public class SchemaHandler extends ValidationHandler {

    public static final Set<String> PROPERTIES = Set.of("temperature", "humidity", "pressure", "illuminance");
    static final Set<String> SOURCES = Set.of("real", "simulated");
    static final Set<String> QUALITIES = Set.of("good", "uncertain", "bad");
    public static final Pattern ID =Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Override
    public Outcome handle(Measurement m) {
        if (m == null) throw ApiException.badRequest("Corps de requete vide");
        try {
            UUID.fromString(nn(m.measurementId, "measurementId"));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("measurementId doit etre un UUID");
        }
        id(m.deviceId, "deviceId");
        id(m.zoneId, "zoneId");
        if (m.gatewayId != null) id(m.gatewayId, "gatewayId");
        if (!PROPERTIES.contains(nn(m.property, "property")))
            throw ApiException.badRequest("property inconnue : " + m.property);
        nn(m.unit, "unit");
        if (m.value == null || m.value.isNaN() || m.value.isInfinite())
            throw ApiException.badRequest("value doit etre un nombre fini");
        try {
            Instant.parse(nn(m.observedAt, "observedAt"));
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("observedAt doit etre en ISO 8601 UTC");
        }
        if (!SOURCES.contains(nn(m.source, "source")))
            throw ApiException.badRequest("source doit valoir real ou simulated");
        if (m.quality == null) m.quality = "good";
        else if (!QUALITIES.contains(m.quality))
            throw ApiException.badRequest("quality invalide");
        return forward(m);
    }

    private static String nn(String v, String name) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("Champ obligatoire manquant : " + name);
        return v;
    }

    private static void id(String v, String name) {
        if (!ID.matcher(nn(v, name)).matches())
            throw ApiException.badRequest("Identifiant invalide : " + name);
    }
}
