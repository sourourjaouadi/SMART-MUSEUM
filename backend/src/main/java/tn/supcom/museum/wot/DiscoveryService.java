package tn.supcom.museum.wot;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.model.ThingAnnouncement;
import tn.supcom.museum.repository.DeviceRepository;
import tn.supcom.museum.repository.ThingRepository;
import tn.supcom.museum.validation.SchemaHandler;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Decouverte d'un objet : annonce MQTT sur /td -> validation de l'identifiant et de la TD
 * -> enregistrement en statut pending -> approbation ADMIN -> statut active.
 */
@ApplicationScoped
public class DiscoveryService {

    /** Resultat d'une annonce : created = nouvel appareil enregistre en pending. */
    public record Result(boolean created, Device device) {
    }

    private final Jsonb jsonb = JsonbBuilder.create();

    @Inject
    DeviceRepository devices;
    @Inject
    ThingRepository things;

    @PreDestroy
    void close() {
        try {
            jsonb.close();
        } catch (Exception ignored) {
            // fermeture best effort a l'arret de l'application
        }
    }

    public Result announce(ThingAnnouncement a) {
        if (a == null) throw ApiException.badRequest("Corps de requete vide");
        checkId(a.deviceId, "deviceId");
        checkId(a.zoneId, "zoneId");
        if (a.gatewayId != null) checkId(a.gatewayId, "gatewayId");
        if (a.type != null) checkId(a.type, "type");

        List<String> errors = ThingDescriptionValidator.validate(a.td, a.deviceId);
        if (!errors.isEmpty()) {
            throw ApiException.invalidThingDescription(String.join(" ; ", errors.subList(0, Math.min(5, errors.size()))));
        }
        String thingId = (String) a.td.get("id");
        String type = a.type != null ? a.type : typeFrom(a.td);

        Device dev = new Device();
        dev.deviceId = a.deviceId;
        dev.zoneId = a.zoneId;
        dev.gatewayId = a.gatewayId;
        dev.type = type;
        dev.thingId = thingId;
        dev.status = Device.PENDING;

        if (devices.insertIfAbsent(dev)) {
            things.save(a.deviceId, a.td, jsonb.toJson(a.td));
            return new Result(true, dev);
        }

        // Appareil deja connu : nouvelle annonce (redemarrage, mise a jour de la TD).
        Device existing = devices.findById(a.deviceId)
                .orElseThrow(() -> ApiException.conflict("Appareil en cours d'enregistrement : " + a.deviceId));
        if (Device.REJECTED.equals(existing.status))
            throw ApiException.forbidden("Appareil rejete par l'ADMIN : " + a.deviceId);
        if (!Objects.equals(existing.zoneId, a.zoneId))
            throw ApiException.forbidden("Zone incoherente pour l'appareil " + a.deviceId);

        things.save(a.deviceId, a.td, jsonb.toJson(a.td));
        devices.updateThing(a.deviceId, thingId, a.type, a.gatewayId);
        return new Result(false, devices.findById(a.deviceId).orElse(existing));
    }

    /** ADMIN : pending/offline/rejected -> active. La TD doit avoir ete enregistree. */
    public Device approve(String deviceId) {
        Device d = require(deviceId);
        if (!things.exists(deviceId))
            throw ApiException.conflict("Aucune Thing Description enregistree pour " + deviceId);
        if (!Device.ACTIVE.equals(d.status)) {
            devices.updateStatus(deviceId, Device.ACTIVE);
            d.status = Device.ACTIVE;
        }
        return d;
    }

    /** ADMIN : tout statut -> rejected. Les mesures de l'appareil seront refusees (403). */
    public Device reject(String deviceId) {
        Device d = require(deviceId);
        if (!Device.REJECTED.equals(d.status)) {
            devices.updateStatus(deviceId, Device.REJECTED);
            d.status = Device.REJECTED;
        }
        return d;
    }

    private Device require(String deviceId) {
        checkId(deviceId, "deviceId");
        return devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + deviceId));
    }

    private static String typeFrom(Map<String, Object> td) {
        Object t = td.get("@type");
        if (t instanceof String s && !"Thing".equals(s) && SchemaHandler.ID.matcher(s).matches()) return s;
        return "unknown";
    }

    private static void checkId(String v, String name) {
        if (v == null || !SchemaHandler.ID.matcher(v).matches())
            throw ApiException.badRequest("Identifiant invalide : " + name);
    }
}
