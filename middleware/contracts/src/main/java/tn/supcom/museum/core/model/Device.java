package tn.supcom.museum.core.model;

public class Device {
    public static final String PENDING = "pending";
    public static final String ACTIVE = "active";
    public static final String REJECTED = "rejected";
    public static final String OFFLINE = "offline";
    /** locationSource : coordonnees propres a l'appareil. */
    public static final String LOCATION_DEVICE = "device";
    /** locationSource : coordonnees heritees de la zone de l'appareil. */
    public static final String LOCATION_ZONE = "zone";
    public String deviceId;
    public String type;
    public String zoneId;
    public String gatewayId;
    public String status;
    public String lastSeenAt;
    public String thingId;
    /** Localisation effective (optionnelle) : propre a l'appareil, sinon celle de sa zone. */
    public Location location;
    /** Origine de {@link #location} : "device" ou "zone" ; absent sans localisation. */
    public String locationSource;
}
