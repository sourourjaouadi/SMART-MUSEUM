package tn.supcom.museum.iam.config;

import java.util.Base64;
import java.util.Locale;

public final class IamRuntimeConfiguration {
    private IamRuntimeConfiguration() { }
    public static void validate() {
        String profile = required("SMART_MUSEUM_ENV").toLowerCase(Locale.ROOT);
        if (!profile.equals("dev") && !profile.equals("prod")) throw new IllegalStateException("SMART_MUSEUM_ENV must be dev or prod");
        String host = required("JNOSQL_MONGODB_HOST"), database = required("JNOSQL_DOCUMENT_DATABASE");
        if (profile.equals("dev") && (!(host.equalsIgnoreCase("localhost:27018") || host.equals("127.0.0.1:27018")) || !database.equals("museum_m2_sandbox")))
            throw new IllegalStateException("DEV must use the isolated MongoDB sandbox on port 27018 and database museum_m2_sandbox");
        if (profile.equals("prod") && (host.toLowerCase(Locale.ROOT).contains(":27018") || database.equalsIgnoreCase("museum_m2_sandbox") || database.equalsIgnoreCase("museum")))
            throw new IllegalStateException("PROD must not use the M2 development MongoDB sandbox or museum database");
        if (required("INTER_SERVICE_TOKEN").length() < 32) throw new IllegalStateException("INTER_SERVICE_TOKEN must contain at least 32 characters");
        byte[] key;
        try { key = Base64.getDecoder().decode(required("JWT_SIGNING_KEY_BASE64")); }
        catch (IllegalArgumentException e) { throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must be valid Base64", e); }
        if (key.length < 32) throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must decode to at least 32 bytes");
        required("JWT_ISSUER");
        long seconds;
        try { seconds = Long.parseLong(required("JWT_ACCESS_TOKEN_SECONDS")); }
        catch (NumberFormatException e) { throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be an integer", e); }
        if (seconds < 60 || seconds > 3600) throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be between 60 and 3600");
        int configured = count("BOOTSTRAP_ADMIN_NAME") + count("BOOTSTRAP_ADMIN_EMAIL") + count("BOOTSTRAP_ADMIN_PASSWORD");
        if (configured != 0 && configured != 3) throw new IllegalStateException("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD together");
    }
    private static int count(String name) { return System.getenv(name) == null || System.getenv(name).isBlank() ? 0 : 1; }
    private static String required(String name) { String value = System.getenv(name); if (value == null || value.isBlank()) throw new IllegalStateException(name + " must be configured"); return value.trim(); }
}
