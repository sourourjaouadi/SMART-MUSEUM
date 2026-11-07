package tn.supcom.museum.data;

import jakarta.data.repository.BasicRepository;
import jakarta.data.repository.Insert;
import jakarta.data.repository.Repository;
import tn.supcom.museum.entity.DeviceEntity;

import java.util.List;

/** Repository Jakarta Data des appareils, implemente a l'execution par Eclipse JNoSQL (MongoDB). */
@Repository
public interface DeviceData extends BasicRepository<DeviceEntity, String> {

    @Insert
    DeviceEntity insert(DeviceEntity device);

    List<DeviceEntity> findByStatus(String status);

    List<DeviceEntity> findByZoneId(String zoneId);
}
