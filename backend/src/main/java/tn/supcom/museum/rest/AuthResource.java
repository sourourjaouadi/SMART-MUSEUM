package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.model.LoginRequest;
import tn.supcom.museum.model.LoginResponse;
import tn.supcom.museum.security.UserAuthenticationService;

@Path("/auth")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {
    @Inject
    UserAuthenticationService authentication;

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    public LoginResponse login(LoginRequest request) {
        return authentication.login(request);
    }
}
