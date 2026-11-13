/*
 * Module  : TrustHandler
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.core.validation;

import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Measurement;
import tn.supcom.museum.core.repository.DeviceRepository;

/** Maillon 4 : seuls les appareils au statut active sont fiables (403). */
public class TrustHandler extends ValidationHandler {

    private final DeviceRepository devices;

    public TrustHandler(DeviceRepository devices) {
        this.devices = devices;
    }

    @Override
    public Outcome handle(Measurement m) {
        var d = devices.findById(m.deviceId)
                .orElseThrow(() -> ApiException.forbidden("Appareil inconnu : " + m.deviceId));
        if (!"active".equals(d.status))
            throw ApiException.forbidden("Appareil non fiable (statut : " + d.status + ")");
        return forward(m);
    }
}
