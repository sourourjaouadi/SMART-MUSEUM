package tn.supcom.museum.iam.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.contracts.security.InternalServiceRequired;
import tn.supcom.museum.iam.model.*;
import tn.supcom.museum.iam.repository.UserRepository;
import tn.supcom.museum.iam.security.AccessTokenService;
import tn.supcom.museum.iam.security.UserAuthenticationService;
import tn.supcom.museum.iam.security.IamException;
import io.jsonwebtoken.Claims;
import java.util.List;

@Path("/internal/iam") @ApplicationScoped @InternalServiceRequired
@Consumes(MediaType.APPLICATION_JSON) @Produces(MediaType.APPLICATION_JSON)
public class InternalIamResource {
    @Inject UserAuthenticationService authentication;
    @Inject AccessTokenService tokens;
    @Inject UserRepository users;
    @POST @Path("/login") public LoginResponse login(LoginRequest request) { return authentication.login(request); }
    @POST @Path("/authenticate") public AuthenticatedUser authenticate(InternalAuthenticationRequest request) {
        if (request == null || request.accessToken == null || request.accessToken.isBlank()) throw IamException.unauthorized("Invalid or expired access token");
        try {
            Claims claims = tokens.validate(request.accessToken);
            var user = authentication.requireActiveUser(claims.getSubject());
            if (!user.role.equals(claims.get("role", String.class))) throw IamException.unauthorized("Invalid or expired access token");
            return new AuthenticatedUser(user.userId, user.role, user.zoneIds == null ? List.of() : List.copyOf(user.zoneIds));
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
            throw IamException.unauthorized("Invalid or expired access token");
        }
    }
    @POST @Path("/users") public UserAccount provision(ClientProvisionRequest request, @HeaderParam("Authorization") String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.regionMatches(true, 0, "Bearer ", 0, 7)) throw IamException.unauthorized("Invalid or expired access token");
        AuthenticatedUser actor = authenticate(new InternalAuthenticationRequest(authorizationHeader.substring(7)));
        if (!"ADMIN".equals(actor.role())) throw IamException.forbidden("ADMIN role required");
        var user = authentication.provision(request == null ? null : request.name, request == null ? null : request.email,
                request == null ? null : request.password, "CLIENT", request == null ? null : request.zoneIds);
        return UserRepository.toAccount(user);
    }
}
