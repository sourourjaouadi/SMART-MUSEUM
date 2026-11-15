package tn.supcom.museum.api.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.core.data.DeviceData;

import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

@Path("/health")
@ApplicationScoped
public class HealthResource {

    private static final Logger LOG = Logger.getLogger(HealthResource.class.getName());

    @Inject
    DeviceData devices;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> health() {
        return Map.of("status", "UP", "mongo", ping() ? "UP" : "DOWN");
    }

    /** Une lecture par identifiant via Jakarta Data suffit a verifier que MongoDB repond. */
    private boolean ping() {
        try {
            devices.findById("__health__");
            return true;
        } catch (RuntimeException e) {
            LOG.log(Level.FINE, "MongoDB injoignable", e);
            return false;
        }
    }
}
