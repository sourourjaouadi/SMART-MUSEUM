/*
 * Module  : MeasurementResource
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.repository.MeasurementRepository;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

/** TODO S3/S4 : proteger par authentification et RBAC par zone (lecture ouverte en dev uniquement). */
@Path("/measurements")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class MeasurementResource {

    @Inject
    MeasurementRepository measurements;

    @GET
    @Path("/latest")
    public List<Measurement> latest(@QueryParam("zoneId") String zoneId) {
        if (zoneId == null || zoneId.isBlank()) throw ApiException.badRequest("zoneId obligatoire");
        return measurements.findLatest(zoneId);
    }

    @GET
    public List<Measurement> history(@QueryParam("deviceId") String deviceId,
                                     @QueryParam("property") String property,
                                     @QueryParam("from") String from,
                                     @QueryParam("to") String to,
                                     @QueryParam("limit") @DefaultValue("1000") int limit) {
        if (deviceId == null || deviceId.isBlank() || property == null || property.isBlank())
            throw ApiException.badRequest("deviceId et property obligatoires");
        int capped = Math.max(1, Math.min(limit, 5000));
        return measurements.findHistory(deviceId, property, parse(from, "from"), parse(to, "to"), capped);
    }

    private static Instant parse(String s, String name) {
        if (s == null || s.isBlank()) return null;
        try {
            return Instant.parse(s);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(name + " doit etre en ISO 8601 UTC");
        }
    }
}
