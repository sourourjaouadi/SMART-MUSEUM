package tn.supcom.museum.iam.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.HttpHeaders;
import tn.supcom.museum.iam.model.AuthenticatedUser;
import tn.supcom.museum.iam.model.ClientProvisionRequest;
import tn.supcom.museum.iam.security.UserAuthenticated;
import tn.supcom.museum.api.service.ApiAuthorizationService;
import tn.supcom.museum.api.service.InternalServiceClient;

/** Minimal account provisioning endpoint; deliberately no general user-management CRUD. */
@Path("/users")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@UserAuthenticated
public class UserResource {
    @Inject
    InternalServiceClient authentication;
    @Inject ApiAuthorizationService authorization;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response provisionClient(ClientProvisionRequest request,
                                    @jakarta.ws.rs.core.Context SecurityContext security,
                                    @jakarta.ws.rs.core.Context HttpHeaders headers) {
        authorization.requireAdmin((AuthenticatedUser) security.getUserPrincipal());
        authorization.requireAdmin((AuthenticatedUser) security.getUserPrincipal());
        String bearer = headers.getHeaderString("Authorization");
        // Forward the original user token; IAM performs its own ADMIN check at its trust boundary.
        var account = authentication.provision(request, bearer);
        return Response.status(Response.Status.CREATED)
                .entity(account).build();
    }
}
