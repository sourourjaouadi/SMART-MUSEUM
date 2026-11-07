package tn.supcom.museum.data;

import jakarta.data.repository.BasicRepository;
import jakarta.data.repository.Insert;
import jakarta.data.repository.Repository;
import tn.supcom.museum.entity.MeasurementEntity;

import java.util.Date;
import java.util.stream.Stream;

/**
 * Repository Jakarta Data des mesures (requetes par nom de methode, Jakarta Data 1.0).
 * Les Stream retournes doivent etre fermes (try-with-resources).
 */
@Repository
public interface MeasurementData extends BasicRepository<MeasurementEntity, String> {

    @Insert
    MeasurementEntity insert(MeasurementEntity measurement);

    /** Historique d'une propriete d'un appareil sur [from, to], du plus recent au plus ancien. */
    Stream<MeasurementEntity> findByDeviceIdAndPropertyAndObservedAtBetweenOrderByObservedAtDesc(
            String deviceId, String property, Date from, Date to);

    /** Mesures d'un couple (appareil, propriete) dans une zone, la plus recente d'abord. */
    Stream<MeasurementEntity> findByZoneIdAndDeviceIdAndPropertyOrderByObservedAtDesc(
            String zoneId, String deviceId, String property);
}
