package tn.supcom.museum.core.config;

/** Lecture des variables d'environnement avec valeur par defaut. */
public final class Env {

    private Env() {
    }

    public static String get(String name, String def) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? def : v;
    }
}
