/*
 * Module  : SeedBean
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.startup;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import tn.supcom.museum.infra.MongoProvider;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.repository.DeviceRepository;

import java.util.logging.Level;
import java.util.logging.Logger;

/** Appareils de test (P0). La decouverte automatique vient en S3. Desactiver avec SEED_DEVICES=false. */
@ApplicationScoped
public class SeedBean {

    private static final Logger LOG = Logger.getLogger(SeedBean.class.getName());

    @Inject
    DeviceRepository devices;

    void onStart(@Observes @Initialized(ApplicationScoped.class) Object init) {
        if (!"true".equalsIgnoreCase(MongoProvider.env("SEED_DEVICES", "true"))) return;
        try {
            seed("bme280-01", "bme280", "salle-01", "gw-01");
            seed("sim-bme280-02", "bme280", "salle-02", "gw-sim");
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Seed des appareils impossible", e);
        }
    }

    private void seed(String id, String type, String zone, String gw) {
        Device d = new Device();
        d.deviceId = id;
        d.type = type;
        d.zoneId = zone;
        d.gatewayId = gw;
        d.status = "active";
        devices.insertIfAbsent(d);
    }
}
