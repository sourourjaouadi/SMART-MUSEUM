package tn.supcom.museum.startup;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import tn.supcom.museum.config.Env;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.repository.DeviceRepository;
import tn.supcom.museum.repository.ThingRepository;
import tn.supcom.museum.wot.MuseumThings;

import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Appareils de test, deja approuves (active), avec leur Thing Description W3C WoT.
 * Les autres appareils passent par la decouverte (POST /api/things). Desactiver avec SEED_DEVICES=false.
 */
@ApplicationScoped
public class SeedBean {

    private static final Logger LOG = Logger.getLogger(SeedBean.class.getName());

    @Inject
    DeviceRepository devices;
    @Inject
    ThingRepository things;

    void onStart(@Observes @Initialized(ApplicationScoped.class) Object init) {
        if (!"true".equalsIgnoreCase(Env.get("SEED_DEVICES", "true"))) return;
        String broker = Env.get("MQTT_BROKER_URI", "mqtt://localhost:1883");
        try (Jsonb jsonb = JsonbBuilder.create()) {
            seed(jsonb, broker, "bme280-01", "bme280", "salle-01", "gw-01");
            seed(jsonb, broker, "sim-bme280-02", "bme280", "salle-02", "gw-sim");
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Seed des appareils impossible", e);
        }
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
