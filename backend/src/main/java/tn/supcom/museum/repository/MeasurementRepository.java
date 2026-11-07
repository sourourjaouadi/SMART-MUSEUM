package tn.supcom.museum.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.data.DeviceData;
import tn.supcom.museum.data.MeasurementData;
import tn.supcom.museum.entity.MeasurementEntity;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.validation.SchemaHandler;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.stream.Stream;

/**
 * Acces aux mesures via le repository Jakarta Data {@link MeasurementData} (Eclipse JNoSQL).
 * Convertit les entites Jakarta NoSQL en objets du contrat REST ({@link Measurement}).
 */
@ApplicationScoped
public class MeasurementRepository {

    private static final Date MIN_DATE = new Date(0);
    private static final Date MAX_DATE = Date.from(Instant.parse("9999-12-31T23:59:59Z"));

    @Inject
    MeasurementData data;
    @Inject
    DeviceData devices;

    /** Retourne false si measurementId existe deja (idempotence, B4). */
    public boolean insertIfAbsent(Measurement m) {
        if (data.findById(m.measurementId).isPresent()) return false;
        try {
            data.insert(toEntity(m));
            return true;
        } catch (RuntimeException e) {
            // Insertion concurrente du meme measurementId : doublon.
            if (data.findById(m.measurementId).isPresent()) return false;
            throw e;
        }
    }

    /** Derniere mesure de chaque couple (deviceId, property) d'une zone. */
    public List<Measurement> findLatest(String zoneId) {
        List<Measurement> out = new ArrayList<>();
        List<String> deviceIds = devices.findByZoneId(zoneId).stream().map(e -> e.deviceId).sorted().toList();
        for (String deviceId : deviceIds) {
            for (String property : SchemaHandler.PROPERTIES) {
                try (Stream<MeasurementEntity> s =
                             data.findByZoneIdAndDeviceIdAndPropertyOrderByObservedAtDesc(zoneId, deviceId, property)) {
                    s.findFirst().map(MeasurementRepository::toModel).ifPresent(out::add);
                }
            }
        }
        return out;
    }

    /** Les "limit" mesures les plus recentes sur [from, to], renvoyees dans l'ordre chronologique. */
    public List<Measurement> findHistory(String deviceId, String property,
                                         Instant from, Instant to, int limit) {
        Date f = from == null ? MIN_DATE : Date.from(from);
        Date t = to == null ? MAX_DATE : Date.from(to);
        List<Measurement> out;
        try (Stream<MeasurementEntity> s =
                     data.findByDeviceIdAndPropertyAndObservedAtBetweenOrderByObservedAtDesc(deviceId, property, f, t)) {
            out = new ArrayList<>(s.limit(limit).map(MeasurementRepository::toModel).toList());
        }
        Collections.reverse(out);
        return out;
    }

    private static MeasurementEntity toEntity(Measurement m) {
        MeasurementEntity e = new MeasurementEntity();
        e.measurementId = m.measurementId;
        e.deviceId = m.deviceId;
        e.zoneId = m.zoneId;
        e.gatewayId = m.gatewayId;
        e.property = m.property;
        e.value = m.value;
        e.unit = m.unit;
        e.observedAt = Date.from(Instant.parse(m.observedAt));
        e.receivedAt = Date.from(Instant.parse(m.receivedAt));
        e.source = m.source;
        e.quality = m.quality;
        return e;
    }

    private static Measurement toModel(MeasurementEntity e) {
        Measurement m = new Measurement();
        m.measurementId = e.measurementId;
        m.deviceId = e.deviceId;
        m.zoneId = e.zoneId;
        m.gatewayId = e.gatewayId;
        m.property = e.property;
        m.value = e.value;
        m.unit = e.unit;
        m.observedAt = e.observedAt.toInstant().toString();
        m.receivedAt = e.receivedAt == null ? null : e.receivedAt.toInstant().toString();
        m.source = e.source;
        m.quality = e.quality;
        return m;
    }
}
