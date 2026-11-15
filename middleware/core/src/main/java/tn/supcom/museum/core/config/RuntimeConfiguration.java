package tn.supcom.museum.core.config;

import java.net.URI;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Validates process configuration before startup observers access MongoDB or seed data. */
public final class RuntimeConfiguration {
    private static final Set<String> ALLOWED_PROFILES = Set.of("dev", "prod");

    private RuntimeConfiguration() {
    }

    public static void validate() {
        validate(System.getenv());
    }

    /** Validation owned by the independently deployed CORE application. */
    public static void validateCore() {
        Map<String, String> env = System.getenv();
        String profile = required(env, "SMART_MUSEUM_ENV").toLowerCase(Locale.ROOT);
        if (!ALLOWED_PROFILES.contains(profile)) throw new IllegalStateException("SMART_MUSEUM_ENV must be dev or prod");
        String host = required(env, "JNOSQL_MONGODB_HOST"), database = required(env, "JNOSQL_DOCUMENT_DATABASE");
        if (profile.equals("dev") && (!(host.equalsIgnoreCase("localhost:27018") || host.equals("127.0.0.1:27018"))
                || !database.equals("museum_m2_sandbox")))
            throw new IllegalStateException("DEV must use the isolated MongoDB sandbox on port 27018 and database museum_m2_sandbox");
        if (profile.equals("prod") && (host.toLowerCase(Locale.ROOT).contains(":27018")
                || database.equalsIgnoreCase("museum_m2_sandbox") || database.equalsIgnoreCase("museum")))
            throw new IllegalStateException("PROD must not use the M2 development MongoDB sandbox or museum database");
        if (required(env, "INTER_SERVICE_TOKEN").length() < 32)
            throw new IllegalStateException("INTER_SERVICE_TOKEN must contain at least 32 characters");
        String seed = required(env, "SEED_DEVICES");
        if (!seed.equalsIgnoreCase("true") && !seed.equalsIgnoreCase("false")) throw new IllegalStateException("SEED_DEVICES must be true or false");
        if (profile.equals("prod") && seed.equalsIgnoreCase("true")) throw new IllegalStateException("SEED_DEVICES must be false in PROD");
        String mqtt = required(env, "MQTT_BROKER_URI");
        URI broker = URI.create(mqtt);
        if (broker.getHost() == null || !("mqtt".equals(broker.getScheme()) || "mqtts".equals(broker.getScheme())))
            throw new IllegalStateException("MQTT_BROKER_URI must be an mqtt:// or mqtts:// URI");
    }

    static void validate(Map<String, String> env) {
        String profile = required(env, "SMART_MUSEUM_ENV").toLowerCase(Locale.ROOT);
        if (!ALLOWED_PROFILES.contains(profile)) {
            throw new IllegalStateException("SMART_MUSEUM_ENV must be dev or prod");
        }

        String mongoHost = required(env, "JNOSQL_MONGODB_HOST");
        String database = required(env, "JNOSQL_DOCUMENT_DATABASE");
        if (profile.equals("dev")) {
            if (!(mongoHost.equalsIgnoreCase("localhost:27018") || mongoHost.equals("127.0.0.1:27018"))
                    || !database.equals("museum_m2_sandbox")) {
                throw new IllegalStateException("DEV must use the isolated MongoDB sandbox on port 27018 and database museum_m2_sandbox");
            }
        } else {
            String normalizedHost = mongoHost.toLowerCase(Locale.ROOT);
            if (normalizedHost.contains("museum-m2-sandbox") || normalizedHost.contains(":27018")
                    || database.equalsIgnoreCase("museum_m2_sandbox") || database.equalsIgnoreCase("museum")) {
                throw new IllegalStateException("PROD must not use the M2 development MongoDB sandbox");
            }
        }

        if (required(env, "INGEST_SERVICE_TOKEN").length() < 32) {
            throw new IllegalStateException("INGEST_SERVICE_TOKEN must contain at least 32 characters");
        }
        String key = required(env, "JWT_SIGNING_KEY_BASE64");
        try {
            if (Base64.getDecoder().decode(key).length < 32) {
                throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must decode to at least 32 bytes");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must be valid Base64", e);
        }
        required(env, "JWT_ISSUER");
        long tokenSeconds;
        try {
            tokenSeconds = Long.parseLong(required(env, "JWT_ACCESS_TOKEN_SECONDS"));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be an integer", e);
        }
        if (tokenSeconds < 60 || tokenSeconds > 3600) {
            throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be between 60 and 3600");
        }

        String cors = required(env, "CORS_ALLOWED_ORIGINS");
        boolean hasCorsOrigin = false;
        for (String value : cors.split(",")) {
            String origin = value.trim();
            if (origin.isEmpty()) {
                throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain at least one origin and no empty entries");
            }
            URI uri;
            try {
                uri = URI.create(origin);
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain valid HTTP(S) origins", e);
            }
            if (uri.getScheme() == null
                    || !Set.of("http", "https").contains(uri.getScheme().toLowerCase(Locale.ROOT))
                    || uri.getHost() == null
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty())
                    || uri.getRawQuery() != null || uri.getRawFragment() != null) {
                throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain origins without paths");
            }
            if (profile.equals("prod") && (!"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getHost().equalsIgnoreCase("localhost") || uri.getHost().equals("127.0.0.1"))) {
                throw new IllegalStateException("PROD CORS origins must use HTTPS and public hostnames");
            }
            hasCorsOrigin = true;
        }
        if (!hasCorsOrigin) {
            throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain at least one origin");
        }

        String seed = required(env, "SEED_DEVICES");
        if (!seed.equalsIgnoreCase("true") && !seed.equalsIgnoreCase("false")) {
            throw new IllegalStateException("SEED_DEVICES must be true or false");
        }
        if (profile.equals("prod") && seed.equalsIgnoreCase("true")) {
            throw new IllegalStateException("SEED_DEVICES must be false in PROD");
        }

        String mqtt = required(env, "MQTT_BROKER_URI");
        try {
            URI broker = URI.create(mqtt);
            if (broker.getScheme() == null || !(broker.getScheme().equals("mqtt") || broker.getScheme().equals("mqtts"))
                    || broker.getHost() == null) {
                throw new IllegalStateException("MQTT_BROKER_URI must be an mqtt:// or mqtts:// URI");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("MQTT_BROKER_URI must be a valid MQTT URI", e);
        }

        boolean bootstrapName = present(env, "BOOTSTRAP_ADMIN_NAME");
        boolean bootstrapEmail = present(env, "BOOTSTRAP_ADMIN_EMAIL");
        boolean bootstrapPassword = present(env, "BOOTSTRAP_ADMIN_PASSWORD");
        int bootstrapFields = (bootstrapName ? 1 : 0) + (bootstrapEmail ? 1 : 0) + (bootstrapPassword ? 1 : 0);
        if (bootstrapFields != 0 && bootstrapFields != 3) {
            throw new IllegalStateException("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD together");
        }
    }

    private static String required(Map<String, String> env, String name) {
        String value = env.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " must be configured for this environment");
        }
        return value.trim();
    }

    private static boolean present(Map<String, String> env, String name) {
        String value = env.get(name);
        return value != null && !value.isBlank();
    }
}
