package tn.supcom.museum.core.config;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RuntimeConfigurationTest {
    private static final String KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    private Map<String, String> dev() {
        Map<String, String> env = new HashMap<>();
        env.put("SMART_MUSEUM_ENV", "dev");
        env.put("JNOSQL_MONGODB_HOST", "localhost:27018");
        env.put("JNOSQL_DOCUMENT_DATABASE", "museum_m2_sandbox");
        env.put("INGEST_SERVICE_TOKEN", "a-secure-test-token-with-32-chars");
        env.put("JWT_SIGNING_KEY_BASE64", KEY);
        env.put("JWT_ISSUER", "smart-museum");
        env.put("JWT_ACCESS_TOKEN_SECONDS", "900");
        env.put("CORS_ALLOWED_ORIGINS", "http://localhost:5173,https://admin.smartmuseum.test");
        env.put("SEED_DEVICES", "true");
        env.put("MQTT_BROKER_URI", "mqtt://localhost:1883");
        return env;
    }

    @Test
    void acceptsIsolatedDevelopmentConfiguration() {
        assertDoesNotThrow(() -> RuntimeConfiguration.validate(dev()));
    }

    @Test
    void rejectsDevelopmentConfigurationThatTargetsOriginalDatabase() {
        Map<String, String> env = dev();
        env.put("JNOSQL_MONGODB_HOST", "localhost:27017");
        env.put("JNOSQL_DOCUMENT_DATABASE", "museum");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(env));
    }

    @Test
    void rejectsProductionSandboxDatabaseAndSeeding() {
        Map<String, String> env = dev();
        env.put("SMART_MUSEUM_ENV", "prod");
        env.put("CORS_ALLOWED_ORIGINS", "https://smartmuseum.example");
        env.put("SEED_DEVICES", "false");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(env));

        Map<String, String> originalDatabase = dev();
        originalDatabase.put("SMART_MUSEUM_ENV", "prod");
        originalDatabase.put("JNOSQL_MONGODB_HOST", "mongo.internal:27017");
        originalDatabase.put("JNOSQL_DOCUMENT_DATABASE", "museum");
        originalDatabase.put("CORS_ALLOWED_ORIGINS", "https://museum.example");
        originalDatabase.put("SEED_DEVICES", "false");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(originalDatabase));

        env.put("JNOSQL_MONGODB_HOST", "mongo.internal:27017");
        env.put("JNOSQL_DOCUMENT_DATABASE", "museum_prod");
        env.put("SEED_DEVICES", "true");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(env));
    }

    @Test
    void rejectsWeakSecretsAndPartialBootstrap() {
        Map<String, String> weakSecret = dev();
        weakSecret.put("INGEST_SERVICE_TOKEN", "short");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(weakSecret));

        Map<String, String> partialBootstrap = dev();
        partialBootstrap.put("BOOTSTRAP_ADMIN_NAME", "Admin");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(partialBootstrap));
    }

    @Test
    void rejectsCorsOriginsWithPaths() {
        Map<String, String> env = dev();
        env.put("CORS_ALLOWED_ORIGINS", "http://localhost:5173/app");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(env));
    }

    @Test
    void rejectsEmptyCorsOrigins() {
        Map<String, String> env = dev();
        env.put("CORS_ALLOWED_ORIGINS", ",,");
        assertThrows(IllegalStateException.class, () -> RuntimeConfiguration.validate(env));
    }
}
