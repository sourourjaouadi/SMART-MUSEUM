package tn.supcom.museum.core.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.core.data.DeviceData;
import tn.supcom.museum.core.entity.DeviceEntity;
import tn.supcom.museum.core.model.Device;

import java.time.Instant;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Acces aux appareils via le repository Jakarta Data {@link DeviceData} (Eclipse JNoSQL).
 * Convertit les entites Jakarta NoSQL en objets du contrat REST ({@link Device}).
 */
@ApplicationScoped
public class DeviceRepository {

    @Inject
    DeviceData data;

    public Optional<Device> findById(String deviceId) {
        return data.findById(deviceId).map(DeviceRepository::toModel);
    }

    public List<Device> findAll() {
        return findByStatus(null);
    }

    /** Tous les appareils, ou seulement ceux d'un statut donne (status null = pas de filtre). */
    public List<Device> findByStatus(String status) {
        if (status != null) {
            return data.findByStatus(status).stream()
                    .sorted(Comparator.comparing(e -> e.deviceId))
                    .map(DeviceRepository::toModel).toList();
        }
        try (Stream<DeviceEntity> all = data.findAll()) {
            return all.sorted(Comparator.comparing(e -> e.deviceId))
                    .map(DeviceRepository::toModel).toList();
        }
    }

    public List<String> findIdsByZone(String zoneId) {
        return data.findByZoneId(zoneId).stream().map(e -> e.deviceId).sorted().toList();
    }

    /** Insere l'appareil s'il n'existe pas ; false s'il existe deja. */
    public boolean insertIfAbsent(Device dev) {
        if (data.findById(dev.deviceId).isPresent()) return false;
        try {
            data.insert(toEntity(dev));
            return true;
        } catch (RuntimeException e) {
            // Insertion concurrente du meme deviceId : l'appareil existe maintenant.
            if (data.findById(dev.deviceId).isPresent()) return false;
            throw e;
        }
    }

    public void touch(String deviceId, Instant when) {
        data.findById(deviceId).ifPresent(e -> {
            e.lastSeenAt = Date.from(when);
            data.save(e);
        });
    }

    public void updateStatus(String deviceId, String status) {
        data.findById(deviceId).ifPresent(e -> {
            e.status = status;
            data.save(e);
        });
    }

    /** Met a jour le lien vers la TD (et le type/passerelle annonces) lors d'une nouvelle annonce. */
    public void updateThing(String deviceId, String thingId, String type, String gatewayId) {
        data.findById(deviceId).ifPresent(e -> {
            e.thingId = thingId;
            if (type != null) e.type = type;
            if (gatewayId != null) e.gatewayId = gatewayId;
            data.save(e);
        });
    }

    private static DeviceEntity toEntity(Device d) {
        DeviceEntity e = new DeviceEntity();
        e.deviceId = d.deviceId;
        e.type = d.type;
        e.zoneId = d.zoneId;
        e.gatewayId = d.gatewayId;
        e.status = d.status;
        e.thingId = d.thingId;
        e.lastSeenAt = d.lastSeenAt == null ? null : Date.from(Instant.parse(d.lastSeenAt));
        return e;
    }

    private static Device toModel(DeviceEntity e) {
        Device d = new Device();
        d.deviceId = e.deviceId;
        d.type = e.type;
        d.zoneId = e.zoneId;
        d.gatewayId = e.gatewayId;
        d.status = e.status;
        d.thingId = e.thingId;
        d.lastSeenAt = e.lastSeenAt == null ? null : e.lastSeenAt.toInstant().toString();
        return d;
    }
}
