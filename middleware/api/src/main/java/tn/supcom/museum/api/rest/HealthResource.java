package tn.supcom.museum.api.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.api.service.InternalServiceClient;

import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

@Path("/health")
@ApplicationScoped
public class HealthResource {

    private static final Logger LOG = Logger.getLogger(HealthResource.class.getName());

    @jakarta.inject.Inject InternalServiceClient services;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> health() {
        try { var health = services.health(); return Map.of("status", "UP", "mongo", health.mongo == null ? "DOWN" : health.mongo); }
        catch (RuntimeException e) { LOG.log(Level.FINE, "CORE service unavailable ({0})", e.getClass().getSimpleName()); return Map.of("status", "UP", "mongo", "DOWN"); }
    }

    /** Une lecture par identifiant via Jakarta Data suffit a verifier que MongoDB repond. */
}
