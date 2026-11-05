/*
 * Module  : IngestResource
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import tn.supcom.museum.model.Measurement;
import tn.supcom.museum.security.ServiceTokenRequired;
import tn.supcom.museum.validation.ValidationChain;
import tn.supcom.museum.validation.ValidationHandler.Outcome;

import java.util.Map;

@Path("/ingest/measurements")
@ApplicationScoped
public class IngestResource {

    @Inject
    ValidationChain chain;

    @POST
    @ServiceTokenRequired
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response ingest(Measurement m) {
        Outcome o = chain.process(m);
        if (o == Outcome.DUPLICATE) {
            return Response.ok(Map.of("status", "duplicate", "message", "Mesure deja traitee")).build();
        }
        return Response.accepted(Map.of("status", "accepted")).build();
    }
}
