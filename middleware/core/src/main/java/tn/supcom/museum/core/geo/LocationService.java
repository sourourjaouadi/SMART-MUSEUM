package tn.supcom.museum.core.geo;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.core.repository.ZoneRepository;
import tn.supcom.museum.core.validation.SchemaHandler;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Geolocalisation : coordonnees WGS84 des zones et localisation des appareils.
 * Un appareil a soit sa localisation propre, soit herite des coordonnees de sa zone.
 * Affecter une localisation ne modifie jamais le zoneId (lie a la TD et au topic MQTT).
 */
@ApplicationScoped
public class LocationService {

    static final int MAX_NAME_LENGTH = 100;

    @Inject
    ZoneRepository zones;
    @Inject
    DeviceRepository devices;

    public List<Zone> zones() {
        return zones.findAll();
    }

    public Zone zone(String zoneId) {
        checkId(zoneId, "zoneId");
        return zones.findById(zoneId).orElseThrow(() -> ApiException.notFound("Zone inconnue : " + zoneId));
    }

    /** ADMIN : cree ou remplace le nom et les coordonnees de la zone (PUT idempotent). */
    public Zone saveZone(String zoneId, Zone body) {
        checkId(zoneId, "zoneId");
        if (body == null) throw ApiException.badRequest("Corps de requete vide");
        if (body.zoneId != null && !body.zoneId.equals(zoneId))
            throw ApiException.badRequest("zoneId du corps different de celui du chemin");
        if (body.name == null || body.name.isBlank() || body.name.trim().length() > MAX_NAME_LENGTH)
            throw ApiException.badRequest("name est obligatoire (1 a " + MAX_NAME_LENGTH + " caracteres)");
        validate(body.location);
        return zones.save(new Zone(zoneId, body.name.trim(), body.location.copy()));
    }

    /** ADMIN : fixe la localisation propre d'un appareil approuve. */
    public Device assign(String deviceId, Location location) {
        requireApproved(deviceId);
        validate(location);
        devices.updateLocation(deviceId, location.copy());
        return device(deviceId);
    }

    /** ADMIN : efface la localisation propre ; l'appareil herite a nouveau de sa zone. */
    public Device clear(String deviceId) {
        requireApproved(deviceId);
        devices.updateLocation(deviceId, null);
        return device(deviceId);
    }

    public Device device(String deviceId) {
        checkId(deviceId, "deviceId");
        return resolve(devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + deviceId)));
    }

    /** Complete la localisation effective d'un appareil (propre, sinon celle de sa zone). */
    public Device resolve(Device device) {
        if (device == null || device.location != null || device.zoneId == null) return device;
        return zones.findById(device.zoneId).map(zone -> inherit(device, zone)).orElse(device);
    }

    /** Comme {@link #resolve(Device)} pour une liste, avec une seule lecture des zones. */
    public List<Device> resolveAll(List<Device> list) {
        Map<String, Zone> byId = zones.findAll().stream().collect(Collectors.toMap(z -> z.zoneId, Function.identity()));
        list.forEach(device -> {
            Zone zone = device.location == null && device.zoneId != null ? byId.get(device.zoneId) : null;
            if (zone != null) inherit(device, zone);
        });
        return list;
    }

    /** Coordonnees WGS84 obligatoires et dans les bornes ; etage optionnel. */
    public static void validate(Location location) {
        if (location == null) throw ApiException.badRequest("location est obligatoire");
        if (location.latitude == null || location.longitude == null)
            throw ApiException.badRequest("latitude et longitude sont obligatoires");
        if (!Double.isFinite(location.latitude) || location.latitude < Location.MIN_LATITUDE
                || location.latitude > Location.MAX_LATITUDE)
            throw ApiException.badRequest("latitude doit etre comprise entre -90 et 90");
        if (!Double.isFinite(location.longitude) || location.longitude < Location.MIN_LONGITUDE
                || location.longitude > Location.MAX_LONGITUDE)
            throw ApiException.badRequest("longitude doit etre comprise entre -180 et 180");
        if (location.floor != null && (location.floor < Location.MIN_FLOOR || location.floor > Location.MAX_FLOOR))
            throw ApiException.badRequest("floor doit etre compris entre " + Location.MIN_FLOOR + " et " + Location.MAX_FLOOR);
    }

    private Device requireApproved(String deviceId) {
        checkId(deviceId, "deviceId");
        Device d = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + deviceId));
        if (Device.PENDING.equals(d.status) || Device.REJECTED.equals(d.status))
            throw ApiException.conflict("Appareil non approuve (" + d.status + ") : " + deviceId);
        return d;
    }

    private static Device inherit(Device device, Zone zone) {
        if (zone.location != null) {
            device.location = zone.location.copy();
            device.locationSource = Device.LOCATION_ZONE;
        }
        return device;
    }

    private static void checkId(String value, String name) {
        if (value == null || !SchemaHandler.ID.matcher(value).matches())
            throw ApiException.badRequest("Identifiant invalide : " + name);
    }
}
