package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import tn.supcom.museum.model.AuthenticatedUser;
import tn.supcom.museum.model.ClientProvisionRequest;
import tn.supcom.museum.repository.UserRepository;
import tn.supcom.museum.security.AuthorizationService;
import tn.supcom.museum.security.UserAuthenticated;
import tn.supcom.museum.security.UserAuthenticationService;

import java.net.URI;

/** Minimal account provisioning endpoint; deliberately no general user-management CRUD. */
@Path("/users")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@UserAuthenticated
public class UserResource {
    @Inject
    UserAuthenticationService authentication;
    @Inject
    AuthorizationService authorization;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response provisionClient(ClientProvisionRequest request,
                                    @jakarta.ws.rs.core.Context SecurityContext security) {
        authorization.requireAdmin((AuthenticatedUser) security.getUserPrincipal());
        var account = authentication.provision(request == null ? null : request.name,
                request == null ? null : request.email,
                request == null ? null : request.password,
                "CLIENT", request == null ? null : request.zoneIds);
        return Response.status(Response.Status.CREATED)
                .entity(UserRepository.toAccount(account)).build();
    }
}
