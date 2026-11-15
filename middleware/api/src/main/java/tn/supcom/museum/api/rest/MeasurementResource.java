/*
 * Module  : MeasurementResource
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.api.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Measurement;
import tn.supcom.museum.core.repository.DeviceRepository;
import tn.supcom.museum.core.repository.MeasurementRepository;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.iam.security.AuthorizationService;
import tn.supcom.museum.iam.security.UserAuthenticated;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

@Path("/measurements")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@UserAuthenticated
public class MeasurementResource {

    @Inject
    MeasurementRepository measurements;
    @Inject
    DeviceRepository devices;
    @Inject
    AuthorizationService authorization;

    @GET
    @Path("/latest")
    public List<Measurement> latest(@QueryParam("zoneId") String zoneId,
                                    @jakarta.ws.rs.core.Context SecurityContext security) {
        if (zoneId == null || zoneId.isBlank()) throw ApiException.badRequest("zoneId obligatoire");
        authorization.requireZone(currentUser(security), zoneId);
        return measurements.findLatest(zoneId);
    }

    @GET
    public List<Measurement> history(@QueryParam("deviceId") String deviceId,
                                     @QueryParam("property") String property,
                                     @QueryParam("from") String from,
                                     @QueryParam("to") String to,
                                     @QueryParam("limit") @DefaultValue("1000") int limit,
                                     @jakarta.ws.rs.core.Context SecurityContext security) {
        if (deviceId == null || deviceId.isBlank() || property == null || property.isBlank())
            throw ApiException.badRequest("deviceId et property obligatoires");
        var device = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + deviceId));
        authorization.requireZone(currentUser(security), device.zoneId);
        int capped = Math.max(1, Math.min(limit, 5000));
        return measurements.findHistory(deviceId, property, parse(from, "from"), parse(to, "to"), capped);
    }

    private static AuthenticatedUser currentUser(SecurityContext security) {
        return (AuthenticatedUser) security.getUserPrincipal();
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
