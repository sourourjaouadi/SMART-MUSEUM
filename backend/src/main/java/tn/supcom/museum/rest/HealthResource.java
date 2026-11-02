/*
 * Module  : HealthResource
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.infra.MongoProvider;

import java.util.Map;

@Path("/health")
@ApplicationScoped
public class HealthResource {

    @Inject
    MongoProvider mongo;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> health() {
        return Map.of("status", "UP", "mongo", mongo.ping() ? "UP" : "DOWN");
    }
}
