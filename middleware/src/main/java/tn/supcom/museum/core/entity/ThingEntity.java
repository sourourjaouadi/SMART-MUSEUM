package tn.supcom.museum.core.entity;

import jakarta.nosql.Column;
import jakarta.nosql.Entity;
import jakarta.nosql.Id;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * Thing Description W3C WoT d'un appareil (collection "things").
 * La TD JSON-LD est conservee telle quelle dans "td" ; les proprietes declarees
 * (et leurs unites) sont extraites pour controler les mesures sans relire le JSON-LD.
 */
@Entity("things")
public class ThingEntity {

    @Id
    public String deviceId;

    @Column
    public String thingId;

    @Column
    public String td;

    @Column
    public List<String> properties;

    @Column
    public Map<String, String> units;

    @Column
    public Date registeredAt;

    @Column
    public Date updatedAt;

    public ThingEntity() {
    }
}
