package tn.supcom.museum.api.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

@ApplicationScoped
public class ApiRuntimeConfiguration {
    void onStart(@Observes @Initialized(ApplicationScoped.class) Object initialized) { validate(); }
    static void validate() {
        String profile = required("SMART_MUSEUM_ENV").toLowerCase(Locale.ROOT);
        if (!Set.of("dev", "prod").contains(profile)) throw new IllegalStateException("SMART_MUSEUM_ENV must be dev or prod");
        endpoint(required("CORE_SERVICE_URL"), "CORE_SERVICE_URL", profile);
        endpoint(required("IAM_SERVICE_URL"), "IAM_SERVICE_URL", profile);
        if (required("INTER_SERVICE_TOKEN").length() < 32) throw new IllegalStateException("INTER_SERVICE_TOKEN must contain at least 32 characters");
        if (required("INGEST_SERVICE_TOKEN").length() < 32) throw new IllegalStateException("INGEST_SERVICE_TOKEN must contain at least 32 characters");
        boolean found = false;
        for (String item : required("CORS_ALLOWED_ORIGINS").split(",")) {
            String origin = item.trim();
            URI uri;
            try { uri = URI.create(origin); } catch (IllegalArgumentException e) { throw new IllegalStateException("CORS_ALLOWED_ORIGINS contains an invalid origin", e); }
            if (origin.isEmpty() || uri.getHost() == null || uri.getScheme() == null
                    || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()) || uri.getRawQuery() != null || uri.getRawFragment() != null)
                throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain HTTP(S) origins without paths");
            if (profile.equals("prod") && !"https".equalsIgnoreCase(uri.getScheme())) throw new IllegalStateException("PROD CORS origins must use HTTPS");
            found = true;
        }
        if (!found) throw new IllegalStateException("CORS_ALLOWED_ORIGINS must contain at least one origin");
    }
    private static void endpoint(String value, String name, String profile) {
        URI uri;
        try { uri = URI.create(value); } catch (IllegalArgumentException e) { throw new IllegalStateException(name + " must be a valid service URL", e); }
        if (uri.getHost() == null || uri.getScheme() == null || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getRawQuery() != null || uri.getRawFragment() != null)
            throw new IllegalStateException(name + " must be an HTTP(S) base URL without query or fragment");
        if (profile.equals("prod") && !"https".equalsIgnoreCase(uri.getScheme())) throw new IllegalStateException(name + " must use HTTPS in PROD");
    }
    private static String required(String name) { String value = System.getenv(name); if (value == null || value.isBlank()) throw new IllegalStateException(name + " must be configured"); return value.trim(); }
}
