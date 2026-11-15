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
import tn.supcom.museum.api.error.ApiException;
import tn.supcom.museum.core.model.Measurement;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.iam.security.UserAuthenticated;
import tn.supcom.museum.api.service.ApiAuthorizationService;
import tn.supcom.museum.api.service.InternalServiceClient;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

@Path("/measurements")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@UserAuthenticated
public class MeasurementResource {

    @Inject
    InternalServiceClient services;
    @Inject ApiAuthorizationService authorization;

    @GET
    @Path("/latest")
    public List<Measurement> latest(@QueryParam("zoneId") String zoneId,
                                    @jakarta.ws.rs.core.Context SecurityContext security) {
        if (zoneId == null || zoneId.isBlank()) throw ApiException.badRequest("zoneId obligatoire");
        authorization.requireZone(currentUser(security), zoneId);
        return services.latest(zoneId);
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
        var device = services.device(deviceId);
        authorization.requireZone(currentUser(security), device.zoneId);
        int capped = Math.max(1, Math.min(limit, 5000));
        Instant parsedFrom = parse(from, "from"), parsedTo = parse(to, "to");
        return services.history(deviceId, property, parsedFrom == null ? null : parsedFrom.toString(), parsedTo == null ? null : parsedTo.toString(), capped);
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
