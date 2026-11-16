package tn.supcom.museum.api.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import tn.supcom.museum.api.error.ApiException;
import tn.supcom.museum.api.service.ApiAuthorizationService;
import tn.supcom.museum.api.service.InternalServiceClient;
import tn.supcom.museum.core.model.Zone;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.iam.security.UserAuthenticated;

import java.util.List;
import java.util.regex.Pattern;

/** Zones du musee et leurs coordonnees WGS84. Lecture filtree par zone ; ecriture ADMIN. */
@Path("/zones")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@UserAuthenticated
public class ZoneResource {

    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Inject
    InternalServiceClient services;
    @Inject
    ApiAuthorizationService authorization;

    /** ADMIN : toutes les zones ; CLIENT : seulement les zones qui lui sont attribuees. */
    @GET
    public List<Zone> list(@Context SecurityContext security) {
        AuthenticatedUser user = currentUser(security);
        List<Zone> zones = services.zones();
        if ("ADMIN".equals(user.role())) return zones;
        List<String> allowed = user.zoneIds() == null ? List.of() : user.zoneIds();
        return zones.stream().filter(zone -> allowed.contains(zone.zoneId)).toList();
    }

    /** Detail d'une zone ; l'autorisation est verifiee avant l'existence (403 avant 404). */
    @GET
    @Path("/{zoneId}")
    public Zone get(@PathParam("zoneId") String zoneId, @Context SecurityContext security) {
        checkId(zoneId);
        authorization.requireZone(currentUser(security), zoneId);
        return services.zone(zoneId);
    }

    /** ADMIN : cree ou remplace le nom et les coordonnees de la zone. */
    @PUT
    @Path("/{zoneId}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Zone put(@PathParam("zoneId") String zoneId, Zone zone, @Context SecurityContext security) {
        authorization.requireAdmin(currentUser(security));
        checkId(zoneId);
        return services.saveZone(zoneId, zone);
    }

    private static AuthenticatedUser currentUser(SecurityContext security) {
        return (AuthenticatedUser) security.getUserPrincipal();
    }

    private static void checkId(String zoneId) {
        if (zoneId == null || !ID.matcher(zoneId).matches())
            throw ApiException.badRequest("Identifiant invalide : zoneId");
    }
}
