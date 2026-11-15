package tn.supcom.museum.iam.security;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.core.error.ErrorResponse;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.api.service.InternalServiceClient;
import tn.supcom.museum.api.error.ApiException;

import java.security.Principal;
import java.util.List;

@Provider
@UserAuthenticated
@Priority(Priorities.AUTHENTICATION)
public class UserAuthenticationFilter implements ContainerRequestFilter {
    @Inject
    InternalServiceClient authentication;

    @Override
    public void filter(ContainerRequestContext request) {
        String authorization = request.getHeaderString("Authorization");
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                || authorization.length() <= 7 || authorization.substring(7).contains(" ")) {
            abort(request);
            return;
        }

        try {
            AuthenticatedUser user = authentication.authenticate(authorization.substring(7));
            request.setSecurityContext(new AuthenticatedSecurityContext(request.getSecurityContext(), user));
        } catch (ApiException e) {
            if (e.getStatus() == 401 || e.getStatus() == 403) abort(request);
            else request.abortWith(Response.status(e.getStatus()).type(MediaType.APPLICATION_JSON).entity(new ErrorResponse(e.getCode(), e.getMessage())).build());
        }
    }

    private static void abort(ContainerRequestContext request) {
        request.abortWith(Response.status(Response.Status.UNAUTHORIZED)
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse("UNAUTHORIZED", "Invalid or expired access token"))
                .build());
    }

    private record AuthenticatedSecurityContext(SecurityContext delegate, AuthenticatedUser user)
            implements SecurityContext {
        @Override
        public Principal getUserPrincipal() {
            return user;
        }

        @Override
        public boolean isUserInRole(String role) {
            return user.role().equals(role);
        }

        @Override
        public boolean isSecure() {
            return delegate != null && delegate.isSecure();
        }

        @Override
        public String getAuthenticationScheme() {
            return "Bearer";
        }
    }
}
