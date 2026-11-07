/*
 * Module  : DeviceIdentityHandler
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.repository.DeviceRepository;

import java.util.Objects;

/** Maillon 2 : l'appareil existe et la zone correspond (403). */
public class DeviceIdentityHandler extends ValidationHandler {

    private final DeviceRepository devices;

    public DeviceIdentityHandler(DeviceRepository devices) {
        this.devices = devices;
    }

    @Override
    public Outcome handle(Measurement m) {
        Device d = devices.findById(m.deviceId)
                .orElseThrow(() -> ApiException.forbidden("Appareil inconnu : " + m.deviceId));
        if (!Objects.equals(d.zoneId, m.zoneId))
            throw ApiException.forbidden("Zone incoherente pour l'appareil " + m.deviceId);
        return forward(m);
    }
}
