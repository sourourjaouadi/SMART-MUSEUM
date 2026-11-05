/*
 * Module  : MeasurementRepository
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.repository;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Accumulators;
import com.mongodb.client.model.Aggregates;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.conversions.Bson;
import tn.supcom.museum.infra.MongoProvider;
import tn.supcom.museum.model.Measurement;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@ApplicationScoped
public class MeasurementRepository {

    @Inject
    MongoProvider mongo;

    private MongoCollection<Document> col() {
        return mongo.db().getCollection("measurements");
    }

    /** Retourne false si measurementId existe deja (idempotence, B4). */
    public boolean insertIfAbsent(Measurement m) {
        try {
            col().insertOne(toDoc(m));
            return true;
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() == ErrorCategory.DUPLICATE_KEY) return false;
            throw e;
        }
    }

    /** Derniere mesure de chaque couple (deviceId, property) d'une zone. */
    public List<Measurement> findLatest(String zoneId) {
        List<Bson> pipeline = List.of(
                Aggregates.match(Filters.eq("zoneId", zoneId)),
                Aggregates.sort(Sorts.descending("observedAt")),
                Aggregates.group(new Document("d", "$deviceId").append("p", "$property"),
                        Accumulators.first("doc", "$$ROOT")));
        List<Measurement> out = new ArrayList<>();
        for (Document g : col().aggregate(pipeline)) {
            out.add(fromDoc(g.get("doc", Document.class)));
        }
        return out;
    }

    public List<Measurement> findHistory(String deviceId, String property,
                                         Instant from, Instant to, int limit) {
        List<Bson> f = new ArrayList<>();
        f.add(Filters.eq("deviceId", deviceId));
        f.add(Filters.eq("property", property));
        if (from != null) f.add(Filters.gte("observedAt", Date.from(from)));
        if (to != null) f.add(Filters.lte("observedAt", Date.from(to)));
        List<Measurement> out = new ArrayList<>();
        for (Document d : col().find(Filters.and(f)).sort(Sorts.ascending("observedAt")).limit(limit)) {
            out.add(fromDoc(d));
        }
        return out;
    }

    private static Document toDoc(Measurement m) {
        return new Document("measurementId", m.measurementId)
                .append("deviceId", m.deviceId)
                .append("zoneId", m.zoneId)
                .append("gatewayId", m.gatewayId)
                .append("property", m.property)
                .append("value", m.value)
                .append("unit", m.unit)
                .append("observedAt", Date.from(Instant.parse(m.observedAt)))
                .append("receivedAt", Date.from(Instant.parse(m.receivedAt)))
                .append("source", m.source)
                .append("quality", m.quality);
    }

    private static Measurement fromDoc(Document d) {
        Measurement m = new Measurement();
        m.measurementId = d.getString("measurementId");
        m.deviceId = d.getString("deviceId");
        m.zoneId = d.getString("zoneId");
        m.gatewayId = d.getString("gatewayId");
        m.property = d.getString("property");
        m.value = ((Number) d.get("value")).doubleValue();
        m.unit = d.getString("unit");
        m.observedAt = d.getDate("observedAt").toInstant().toString();
        m.receivedAt = d.getDate("receivedAt").toInstant().toString();
        m.source = d.getString("source");
        m.quality = d.getString("quality");
        return m;
    }
}
