package tn.supcom.museum.core.model;

/** Zone du musee (salle, aile) avec son nom et ses coordonnees WGS84. */
public class Zone {
    public String zoneId;
    public String name;
    public Location location;

    public Zone() {
    }

    public Zone(String zoneId, String name, Location location) {
        this.zoneId = zoneId;
        this.name = name;
        this.location = location;
    }
}
