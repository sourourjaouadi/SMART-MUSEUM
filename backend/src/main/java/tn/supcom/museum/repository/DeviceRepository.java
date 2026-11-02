/*
 * Module  : DeviceRepository
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.repository;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.bson.Document;
import tn.supcom.museum.infra.MongoProvider;
import tn.supcom.museum.model.Device;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class DeviceRepository {

    @Inject
    MongoProvider mongo;

    private MongoCollection<Document> col() {
        return mongo.db().getCollection("devices");
    }

    public Optional<Device> findById(String deviceId) {
        Document d = col().find(Filters.eq("deviceId", deviceId)).first();
        return Optional.ofNullable(d).map(DeviceRepository::fromDoc);
    }

    public List<Device> findAll() {
        List<Device> out = new ArrayList<>();
        for (Document d : col().find().sort(Sorts.ascending("deviceId"))) out.add(fromDoc(d));
        return out;
    }

    public boolean insertIfAbsent(Device dev) {
        try {
            col().insertOne(new Document("deviceId", dev.deviceId)
                    .append("type", dev.type)
                    .append("zoneId", dev.zoneId)
                    .append("gatewayId", dev.gatewayId)
                    .append("status", dev.status));
            return true;
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() == ErrorCategory.DUPLICATE_KEY) return false;
            throw e;
        }
    }

    public void touch(String deviceId, Instant when) {
        col().updateOne(Filters.eq("deviceId", deviceId),
                Updates.set("lastSeenAt", Date.from(when)));
    }

    private static Device fromDoc(Document d) {
        Device dev = new Device();
        dev.deviceId = d.getString("deviceId");
        dev.type = d.getString("type");
        dev.zoneId = d.getString("zoneId");
        dev.gatewayId = d.getString("gatewayId");
        dev.status = d.getString("status");
        Date seen = d.getDate("lastSeenAt");
        dev.lastSeenAt = seen == null ? null : seen.toInstant().toString();
        return dev;
    }
}
