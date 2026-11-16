package tn.supcom.museum.core.entity;

import jakarta.nosql.Column;
import jakarta.nosql.Entity;
import jakarta.nosql.Id;

/** Zone du musee (collection "zones"), mappee par Jakarta NoSQL. L'identifiant est le zoneId. */
@Entity("zones")
public class ZoneEntity {

    @Id
    public String zoneId;

    @Column
    public String name;

    /** Latitude WGS84 en degres decimaux. */
    @Column
    public Double latitude;

    /** Longitude WGS84 en degres decimaux. */
    @Column
    public Double longitude;

    @Column
    public Integer floor;

    public ZoneEntity() {
    }
}
