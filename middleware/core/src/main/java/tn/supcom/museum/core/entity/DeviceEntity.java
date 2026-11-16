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

    /** Localisation propre (WGS84), optionnelle : absente, l'appareil herite des coordonnees de sa zone. */
    @Column
    public Double latitude;

    @Column
    public Double longitude;

    @Column
    public Integer floor;

    public DeviceEntity() {
    }
}
