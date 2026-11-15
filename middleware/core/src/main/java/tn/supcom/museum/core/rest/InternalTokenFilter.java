package tn.supcom.museum.core.rest;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.contracts.security.InternalServiceRequired;
import tn.supcom.museum.core.error.ErrorResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Provider @InternalServiceRequired @Priority(Priorities.AUTHENTICATION)
public class InternalTokenFilter implements ContainerRequestFilter {
    public void filter(ContainerRequestContext request) {
        String expected = System.getenv("INTER_SERVICE_TOKEN"), supplied = request.getHeaderString("X-Internal-Service-Token");
        boolean valid = expected != null && expected.length() >= 32 && supplied != null && MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
        if (!valid) request.abortWith(Response.status(401).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse("UNAUTHORIZED", "Internal service authentication required")).build());
    }
}
