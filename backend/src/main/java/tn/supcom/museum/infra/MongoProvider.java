/*
 * Module  : MongoProvider
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.infra;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;

import java.util.logging.Level;
import java.util.logging.Logger;

@ApplicationScoped
public class MongoProvider {

    private static final Logger LOG = Logger.getLogger(MongoProvider.class.getName());
    private MongoClient client;
    private MongoDatabase db;

    public static String env(String name, String def) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? def : v;
    }

    @PostConstruct
    void init() {
        client = MongoClients.create(env("MONGO_URI", "mongodb://localhost:27017"));
        db = client.getDatabase(env("MONGO_DB", "museum"));
        try {
            db.getCollection("measurements").createIndex(
                    Indexes.ascending("measurementId"), new IndexOptions().unique(true));
            db.getCollection("measurements").createIndex(
                    Indexes.compoundIndex(Indexes.ascending("deviceId"),
                            Indexes.ascending("property"), Indexes.descending("observedAt")));
            db.getCollection("measurements").createIndex(Indexes.ascending("zoneId"));
            db.getCollection("devices").createIndex(
                    Indexes.ascending("deviceId"), new IndexOptions().unique(true));
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Creation des index impossible (MongoDB injoignable ?)", e);
        }
    }

    @PreDestroy
    void close() {
        if (client != null) client.close();
    }

    public MongoDatabase db() {
        return db;
    }

    public boolean ping() {
        try {
            db.runCommand(new Document("ping", 1));
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
