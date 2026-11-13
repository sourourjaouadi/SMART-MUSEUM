package tn.supcom.museum.core.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import tn.supcom.museum.core.data.ThingData;
import tn.supcom.museum.core.entity.ThingEntity;
import tn.supcom.museum.core.wot.ThingDescriptionValidator;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Thing Descriptions W3C WoT (collection "things"), une par appareil,
 * via le repository Jakarta Data {@link ThingData} (Eclipse JNoSQL).
 */
@ApplicationScoped
public class ThingRepository {

    @Inject
    ThingData data;

    /** Cree ou remplace la TD d'un appareil. */
    public void save(String deviceId, Map<String, Object> td, String tdJson) {
        Date now = new Date();
        ThingEntity e = data.findById(deviceId).orElseGet(() -> {
            ThingEntity n = new ThingEntity();
            n.deviceId = deviceId;
            n.registeredAt = now;
            return n;
        });
        fill(e, td, tdJson);
        e.updatedAt = now;
        data.save(e);
    }

    /** Insere la TD seulement si l'appareil n'en a pas encore (seed). */
    public boolean insertIfAbsent(String deviceId, Map<String, Object> td, String tdJson) {
        if (data.findById(deviceId).isPresent()) return false;
        Date now = new Date();
        ThingEntity e = new ThingEntity();
        e.deviceId = deviceId;
        e.registeredAt = now;
        e.updatedAt = now;
        fill(e, td, tdJson);
        try {
            data.insert(e);
            return true;
        } catch (RuntimeException ex) {
            if (data.findById(deviceId).isPresent()) return false;
            throw ex;
        }
    }

    public boolean exists(String deviceId) {
        return data.findById(deviceId).isPresent();
    }

    /** TD serialisee en JSON (application/td+json). */
    public Optional<String> findJson(String deviceId) {
        return data.findById(deviceId).map(e -> e.td);
    }

    public List<String> findAllJson() {
        try (Stream<ThingEntity> all = data.findAll()) {
            return all.sorted(Comparator.comparing(e -> e.deviceId)).map(e -> e.td).toList();
        }
    }

    /** Proprietes declarees (nom -> unite, null si la TD n'en precise pas) ; vide si l'appareil n'a pas de TD. */
    public Optional<Map<String, String>> findDeclaredProperties(String deviceId) {
        return data.findById(deviceId).map(e -> {
            Map<String, String> out = new HashMap<>();
            if (e.properties != null) {
                for (String p : e.properties) out.put(p, e.units == null ? null : e.units.get(p));
            }
            return out;
        });
    }

    private static void fill(ThingEntity e, Map<String, Object> td, String tdJson) {
        Map<String, String> declared = ThingDescriptionValidator.declaredProperties(td);
        e.thingId = td.get("id") instanceof String id ? id : null;
        e.td = tdJson;
        e.properties = new ArrayList<>(declared.keySet());
        Map<String, String> units = new HashMap<>();
        declared.forEach((name, unit) -> {
            if (unit != null) units.put(name, unit);
        });
        e.units = units;
    }
}
