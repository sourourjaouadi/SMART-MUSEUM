package tn.supcom.museum.data;

import jakarta.data.repository.BasicRepository;
import jakarta.data.repository.Insert;
import jakarta.data.repository.Repository;
import tn.supcom.museum.entity.ThingEntity;

/** Repository Jakarta Data des Thing Descriptions W3C WoT. */
@Repository
public interface ThingData extends BasicRepository<ThingEntity, String> {

    @Insert
    ThingEntity insert(ThingEntity thing);
}
