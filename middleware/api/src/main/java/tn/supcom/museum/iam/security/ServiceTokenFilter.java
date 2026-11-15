/*
 * Module  : ServiceTokenFilter
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.iam.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.core.error.ErrorResponse;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Jeton de service (Node-RED -> middleware), lu dans l'en-tete X-Service-Token. Jamais journalise. */
@Provider
@ServiceTokenRequired
@Priority(Priorities.AUTHENTICATION)
public class ServiceTokenFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext ctx) {
        String expected = System.getenv("INGEST_SERVICE_TOKEN");
        String given = ctx.getHeaderString("X-Service-Token");
        boolean ok = expected != null && !expected.isBlank() && given != null
                && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                given.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            ctx.abortWith(Response.status(401).type(MediaType.APPLICATION_JSON)
                    .entity(new ErrorResponse("UNAUTHORIZED", "Jeton de service absent ou invalide"))
                    .build());
        }
    }
}
