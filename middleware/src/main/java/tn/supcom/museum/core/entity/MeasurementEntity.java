package tn.supcom.museum.core.entity;

import jakarta.nosql.Column;
import jakarta.nosql.Entity;
import jakarta.nosql.Id;

import java.util.Date;

/** Mesure (collection "measurements"). L'identifiant est le measurementId (UUID), ce qui garantit l'idempotence. */
@Entity("measurements")
public class MeasurementEntity {

    @Id
    public String measurementId;

    @Column
    public String deviceId;

    @Column
    public String zoneId;

    @Column
    public String gatewayId;

    @Column
    public String property;

    @Column
    public Double value;

    @Column
    public String unit;

    @Column
    public Date observedAt;

    @Column
    public Date receivedAt;

    @Column
    public String source;

    @Column
    public String quality;

    public MeasurementEntity() {
    }
}
