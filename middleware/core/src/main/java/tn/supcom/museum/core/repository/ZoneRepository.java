package tn.supcom.museum.core.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.core.data.ZoneData;
import tn.supcom.museum.core.entity.ZoneEntity;
import tn.supcom.museum.core.model.Location;
import tn.supcom.museum.core.model.Zone;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Acces aux zones via le repository Jakarta Data {@link ZoneData} (Eclipse JNoSQL).
 * Convertit les entites Jakarta NoSQL en objets du contrat REST ({@link Zone}).
 */
@ApplicationScoped
public class ZoneRepository {

    @Inject
    ZoneData data;

    public Optional<Zone> findById(String zoneId) {
        return data.findById(zoneId).map(ZoneRepository::toModel);
    }

    public List<Zone> findAll() {
        try (Stream<ZoneEntity> all = data.findAll()) {
            return all.sorted(Comparator.comparing(e -> e.zoneId)).map(ZoneRepository::toModel).toList();
        }
    }

    /** Cree ou remplace la zone (PUT idempotent). */
    public Zone save(Zone zone) {
        return toModel(data.save(toEntity(zone)));
    }

    /** Insere la zone si elle n'existe pas ; false si elle existe deja (les modifications ADMIN sont conservees). */
    public boolean insertIfAbsent(Zone zone) {
        if (data.findById(zone.zoneId).isPresent()) return false;
        try {
            data.insert(toEntity(zone));
            return true;
        } catch (RuntimeException e) {
            if (data.findById(zone.zoneId).isPresent()) return false;
            throw e;
        }
    }

    static ZoneEntity toEntity(Zone z) {
        ZoneEntity e = new ZoneEntity();
        e.zoneId = z.zoneId;
        e.name = z.name;
        if (z.location != null) {
            e.latitude = z.location.latitude;
            e.longitude = z.location.longitude;
            e.floor = z.location.floor;
        }
        return e;
    }

    static Zone toModel(ZoneEntity e) {
        Location location = e.latitude == null || e.longitude == null
                ? null : new Location(e.latitude, e.longitude, e.floor);
        return new Zone(e.zoneId, e.name, location);
    }
}
