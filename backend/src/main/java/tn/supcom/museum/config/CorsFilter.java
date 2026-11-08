
package tn.supcom.museum.config;

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
            .stream(Env.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","))
            .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());

    @Override
    public void filter(ContainerRequestContext req) {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod()) && req.getHeaderString("Origin") != null) {
            req.abortWith(Response.ok().build());
        }
    }

    @Override
    public void filter(ContainerRequestContext req, ContainerResponseContext res) {
        String origin = req.getHeaderString("Origin");
        if (origin != null && allowed.contains(origin)) {
            var h = res.getHeaders();
            h.putSingle("Access-Control-Allow-Origin", origin);
            h.putSingle("Vary", "Origin");
            h.putSingle("Access-Control-Allow-Headers", "Content-Type, Authorization");
            h.putSingle("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            h.putSingle("Access-Control-Expose-Headers", "Link, Location");
            h.putSingle("Access-Control-Max-Age", "3600");
        }
    }
}
