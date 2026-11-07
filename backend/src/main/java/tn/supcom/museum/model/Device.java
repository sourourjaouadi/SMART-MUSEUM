
package tn.supcom.museum.model;

public class Device {

    public static final String PENDING = "pending";
    public static final String ACTIVE = "active";
    public static final String REJECTED = "rejected";
    public static final String OFFLINE = "offline";

    public String deviceId;
    public String type;
    public String zoneId;
    public String gatewayId;
    public String status;     // pending | active | rejected | offline
    public String lastSeenAt;
    public String thingId;    // id de la Thing Description W3C WoT (ex. urn:museum:device:bme280-01)
}
