package tn.supcom.museum.core.model;

/**
 * Position WGS84 (latitude/longitude en degres decimaux) et numero d'etage optionnel.
 * Utilisee pour les coordonnees d'une zone et la localisation propre d'un appareil.
 */
public class Location {
    public static final double MIN_LATITUDE = -90.0;
    public static final double MAX_LATITUDE = 90.0;
    public static final double MIN_LONGITUDE = -180.0;
    public static final double MAX_LONGITUDE = 180.0;
    public static final int MIN_FLOOR = -10;
    public static final int MAX_FLOOR = 200;

    public Double latitude;
    public Double longitude;
    public Integer floor;

    public Location() {
    }

    public Location(Double latitude, Double longitude, Integer floor) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.floor = floor;
    }

    public Location copy() {
        return new Location(latitude, longitude, floor);
    }
}
