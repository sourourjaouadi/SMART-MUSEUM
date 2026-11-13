package tn.supcom.museum.iam.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
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
import tn.supcom.museum.iam.entity.UserEntity;
import tn.supcom.museum.iam.model.AuthenticatedUser;

import java.security.Principal;
import java.util.List;

@Provider
@UserAuthenticated
@Priority(Priorities.AUTHENTICATION)
public class UserAuthenticationFilter implements ContainerRequestFilter {
    @Inject
    AccessTokenService tokens;
    @Inject
    UserAuthenticationService authentication;

    @Override
    public void filter(ContainerRequestContext request) {
        String authorization = request.getHeaderString("Authorization");
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                || authorization.length() <= 7 || authorization.substring(7).contains(" ")) {
            abort(request);
            return;
        }

        try {
            Claims claims = tokens.validate(authorization.substring(7));
            String subject = claims.getSubject();
            String tokenRole = claims.get("role", String.class);
            if (subject == null || subject.isBlank()
                    || !("ADMIN".equals(tokenRole) || "CLIENT".equals(tokenRole))) {
                abort(request);
                return;
            }
            UserEntity stored = authentication.requireActiveUser(subject);
            if (!tokenRole.equals(stored.role)) {
                abort(request);
                return;
            }
            AuthenticatedUser user = new AuthenticatedUser(stored.userId, stored.role,
                    stored.zoneIds == null ? List.of() : List.copyOf(stored.zoneIds));
            request.setSecurityContext(new AuthenticatedSecurityContext(request.getSecurityContext(), user));
        } catch (JwtException | IllegalArgumentException e) {
            abort(request);
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
