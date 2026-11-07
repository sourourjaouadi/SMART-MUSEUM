package tn.supcom.museum.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.error.ErrorResponse;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Jeton ADMIN provisoire (en-tete X-Admin-Token, variable ADMIN_TOKEN), en attendant
 * l'authentification ADMIN/CLIENT et le RBAC prevus en S3-S4. Jamais journalise.
 * Sans ADMIN_TOKEN defini, toutes les operations ADMIN sont refusees.
 */
@Provider
@AdminTokenRequired
@Priority(Priorities.AUTHENTICATION)
public class AdminTokenFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext ctx) {
        String expected = System.getenv("ADMIN_TOKEN");
        String given = ctx.getHeaderString("X-Admin-Token");
        boolean ok = expected != null && !expected.isBlank() && given != null
                && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                given.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            ctx.abortWith(Response.status(401).type(MediaType.APPLICATION_JSON)
                    .entity(new ErrorResponse("UNAUTHORIZED", "Jeton ADMIN absent ou invalide"))
                    .build());
        }
    }
}
