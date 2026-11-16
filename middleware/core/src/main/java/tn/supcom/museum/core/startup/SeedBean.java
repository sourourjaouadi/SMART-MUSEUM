package tn.supcom.museum.core.startup;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import tn.supcom.museum.core.config.Env;
import tn.supcom.museum.core.config.RuntimeConfiguration;
import tn.supcom.museum.core.model.Device;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.core.repository.ThingRepository;
import tn.supcom.museum.core.repository.ZoneRepository;
import tn.supcom.museum.core.wot.MuseumThings;

import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Zones d'exemple (coordonnees WGS84 fictives a Tunis) et appareils de test, deja approuves
 * (active), avec leur Thing Description W3C WoT.
 * Les autres appareils passent par la decouverte (POST /api/things). Desactiver avec SEED_DEVICES=false.
 */
@ApplicationScoped
public class SeedBean {

    private static final Logger LOG = Logger.getLogger(SeedBean.class.getName());

    @Inject
    DeviceRepository devices;
    @Inject
    ThingRepository things;
    @Inject
    ZoneRepository zones;

    void onStart(@Observes @Initialized(ApplicationScoped.class) Object init) {
        RuntimeConfiguration.validateCore();
        if (!"true".equalsIgnoreCase(Env.get("SEED_DEVICES", "true"))) return;
        try {
            for (Zone zone : sampleZones()) zones.insertIfAbsent(zone);
        } catch (RuntimeException e) {
            LOG.log(Level.WARNING, "Seed des zones impossible ({0})", e.getClass().getSimpleName());
        }
        String broker = Env.get("MQTT_BROKER_URI", "mqtt://localhost:1883");
        try (Jsonb jsonb = JsonbBuilder.create()) {
            seed(jsonb, broker, "bme280-01", "bme280", "salle-01", "gw-01");
            seed(jsonb, broker, "sim-bme280-02", "bme280", "salle-02", "gw-sim");
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Seed des appareils impossible ({0})", e.getClass().getSimpleName());
        }
    }

    /**
     * DONNEES D'EXEMPLE : coordonnees fictives dans le centre de Tunis (WGS84), pas celles d'un
     * batiment reel. Inserees seulement si la zone n'existe pas, pour conserver les modifications ADMIN.
     */
    static List<Zone> sampleZones() {
        return List.of(
                new Zone("salle-01", "Textile gallery", new Location(36.80650, 10.18150, 0)),
                new Zone("salle-02", "Manuscript room", new Location(36.80662, 10.18172, 1)));
    }

    private void seed(Jsonb jsonb, String broker, String id, String type, String zone, String gw) {
        Device d = new Device();
        d.deviceId = id;
        d.type = type;
        d.zoneId = zone;
        d.gatewayId = gw;
        d.status = Device.ACTIVE;
        d.thingId = MuseumThings.thingId(id);
        if (!devices.insertIfAbsent(d)) {
            devices.updateThing(id, d.thingId, null, null);
        }
        Map<String, Object> td = MuseumThings.bme280(id, zone, broker);
        things.insertIfAbsent(id, td, jsonb.toJson(td));
    }
}
