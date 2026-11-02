/*
 * Module  : Device
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.model;

public class Device {
    public String deviceId;
    public String type;
    public String zoneId;
    public String gatewayId;
    public String status;     // pending | active | rejected | offline
    public String lastSeenAt;
}
