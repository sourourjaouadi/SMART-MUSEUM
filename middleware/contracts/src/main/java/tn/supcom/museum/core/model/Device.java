package tn.supcom.museum.core.model;

public class Device {
    public static final String PENDING = "pending";
    public static final String ACTIVE = "active";
    public static final String REJECTED = "rejected";
    public static final String OFFLINE = "offline";
    public String deviceId;
    public String type;
    public String zoneId;
    public String gatewayId;
    public String status;
    public String lastSeenAt;
    public String thingId;
}
