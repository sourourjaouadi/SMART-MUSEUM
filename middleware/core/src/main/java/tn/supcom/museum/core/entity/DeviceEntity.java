package tn.supcom.museum.core.entity;

import jakarta.nosql.Column;
import jakarta.nosql.Entity;
import jakarta.nosql.Id;

import java.util.Date;

/** Appareil (collection "devices"), mappe par Jakarta NoSQL. L'identifiant est le deviceId. */
@Entity("devices")
public class DeviceEntity {

    @Id
    public String deviceId;

    @Column
    public String type;

    @Column
    public String zoneId;

    @Column
    public String gatewayId;

    @Column
    public String status;

    @Column
    public String thingId;

    @Column
    public Date lastSeenAt;

    public DeviceEntity() {
    }
}
