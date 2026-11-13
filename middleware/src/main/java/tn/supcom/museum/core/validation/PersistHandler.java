/*
 * Module  : PersistHandler
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.core.validation;

import tn.supcom.museum.core.model.Measurement;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.core.repository.MeasurementRepository;

import java.time.Instant;

/** Maillon 6 : persistance idempotente (B4). Un doublon n'est pas reecrit. */
public class PersistHandler extends ValidationHandler {

    private final MeasurementRepository measurements;
    private final DeviceRepository devices;

    public PersistHandler(MeasurementRepository measurements, DeviceRepository devices) {
        this.measurements = measurements;
        this.devices = devices;
    }

    @Override
    public Outcome handle(Measurement m) {
        Instant now = Instant.now();
        m.receivedAt = now.toString();
        if (!measurements.insertIfAbsent(m)) return Outcome.DUPLICATE;
        devices.touch(m.deviceId, now);
        return Outcome.ACCEPTED;
    }
}
