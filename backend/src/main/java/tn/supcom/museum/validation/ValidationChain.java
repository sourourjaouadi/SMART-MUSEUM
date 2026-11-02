/*
 * Module  : ValidationChain
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.repository.DeviceRepository;
import tn.supcom.museum.repository.MeasurementRepository;
import tn.supcom.museum.validation.ValidationHandler.Outcome;

@ApplicationScoped
public class ValidationChain {

    @Inject
    DeviceRepository devices;
    @Inject
    MeasurementRepository measurements;

    private ValidationHandler head;

    @PostConstruct
    void build() {
        head = new SchemaHandler();
        head.linkWith(new DeviceIdentityHandler(devices))
                .linkWith(new RangeHandler())
                .linkWith(new TrustHandler(devices))
                .linkWith(new PersistHandler(measurements, devices));
    }

    public Outcome process(Measurement m) {
        return head.handle(m);
    }
}
