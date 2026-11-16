package tn.supcom.museum.core.data;

import jakarta.data.repository.BasicRepository;
import jakarta.data.repository.Insert;
import jakarta.data.repository.Repository;
import tn.supcom.museum.core.entity.ZoneEntity;

/** Repository Jakarta Data des zones, implemente a l'execution par Eclipse JNoSQL (MongoDB). */
@Repository
public interface ZoneData extends BasicRepository<ZoneEntity, String> {

    @Insert
    ZoneEntity insert(ZoneEntity zone);
}
