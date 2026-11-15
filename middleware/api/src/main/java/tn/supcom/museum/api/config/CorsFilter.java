
package tn.supcom.museum.api.config;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** CORS limite aux origines des PWA (variable CORS_ALLOWED_ORIGINS, separees par des virgules). */
@Provider
@PreMatching
public class CorsFilter implements ContainerRequestFilter, ContainerResponseFilter {

    private final Set<String> allowed = Arrays
            .stream(System.getenv().getOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","))
            .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());

    @Override
    public void filter(ContainerRequestContext req) {
        String origin = req.getHeaderString("Origin");
        if ("OPTIONS".equalsIgnoreCase(req.getMethod()) && origin != null) {
            if (!isAllowed(origin)) {
                req.abortWith(Response.status(Response.Status.FORBIDDEN).build());
                return;
            }
            Response.ResponseBuilder preflight = Response.ok();
            addCorsHeaders(preflight::header, origin);
            req.abortWith(preflight.build());
        }
    }

    @Override
    public void filter(ContainerRequestContext req, ContainerResponseContext res) {
        String origin = req.getHeaderString("Origin");
        if (isAllowed(origin)) addCorsHeaders(res.getHeaders()::putSingle, origin);
    }

    private boolean isAllowed(String origin) {
        return origin != null && allowed.contains(origin);
    }

    private static void addCorsHeaders(java.util.function.BiConsumer<String, Object> headers, String origin) {
        headers.accept("Access-Control-Allow-Origin", origin);
        headers.accept("Vary", "Origin");
        headers.accept("Access-Control-Allow-Headers", "Content-Type, Authorization");
        headers.accept("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.accept("Access-Control-Expose-Headers", "Link, Location");
        headers.accept("Access-Control-Max-Age", "3600");
    }
}
