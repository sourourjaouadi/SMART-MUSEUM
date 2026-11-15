package tn.supcom.museum.core.model;

import java.util.Map;

/**
 * Annonce de decouverte relayee par Node-RED depuis le topic MQTT
 * museum/v1/{zoneId}/{deviceId}/td : identite de l'appareil + sa Thing Description.
 */
public class ThingAnnouncement {
    public String deviceId;
    public String zoneId;
    public String gatewayId;
    public String type;
    public Map<String, Object> td;
}
