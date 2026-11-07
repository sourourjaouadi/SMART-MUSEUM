package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Link;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.ThingAnnouncement;
import tn.supcom.museum.repository.ThingRepository;
import tn.supcom.museum.security.ServiceTokenRequired;
import tn.supcom.museum.validation.SchemaHandler;
import tn.supcom.museum.wot.DiscoveryService;

import java.net.URI;
import java.util.Map;

/**
 * Thing Descriptions W3C WoT 1.1 (JSON-LD 1.1, type de media application/td+json).
 * POST : annonce de decouverte relayee par Node-RED (jeton de service).
 * GET  : consultation des TD (lecture ouverte en dev ; RBAC en S3/S4).
 */
@Path("/things")
@ApplicationScoped
public class ThingResource {

    public static final String TD_MEDIA_TYPE = "application/td+json";

    @Inject
    DiscoveryService discovery;
    @Inject
    ThingRepository things;

    @POST
    @ServiceTokenRequired
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response announce(ThingAnnouncement a, @Context UriInfo uri) {
        DiscoveryService.Result r = discovery.announce(a);
        URI td = tdUri(uri, r.device().deviceId);
        Response.ResponseBuilder rb = r.created() ? Response.created(td) : Response.ok();
        return rb.links(describedBy(td))
                .entity(Map.of("status", r.created() ? "registered" : "updated",
                        "deviceId", r.device().deviceId,
                        "deviceStatus", r.device().status))
                .build();
    }

    @GET
    @Produces({TD_MEDIA_TYPE, MediaType.APPLICATION_JSON})
    public Response list() {
        String body = "[" + String.join(",", things.findAllJson()) + "]";
        return Response.ok(body, MediaType.APPLICATION_JSON).build();
    }

    @GET
    @Path("/{deviceId}")
    @Produces({TD_MEDIA_TYPE, MediaType.APPLICATION_JSON})
    public Response get(@PathParam("deviceId") String deviceId, @Context UriInfo uri) {
        if (!SchemaHandler.ID.matcher(deviceId).matches()) throw ApiException.badRequest("Identifiant invalide : deviceId");
        String td = things.findJson(deviceId)
                .orElseThrow(() -> ApiException.notFound("Aucune Thing Description pour " + deviceId));
        URI device = uri.getBaseUriBuilder().path("devices").path(deviceId).build();
        return Response.ok(td, TD_MEDIA_TYPE)
                .links(Link.fromUri(device).rel("describes").type(MediaType.APPLICATION_JSON).build())
                .build();
    }

    static URI tdUri(UriInfo uri, String deviceId) {
        return uri.getBaseUriBuilder().path("things").path(deviceId).build();
    }

    /** Lien RFC 8288 vers la TD : Link: <.../api/things/{id}>; rel="describedby"; type="application/td+json". */
    static Link describedBy(URI td) {
        return Link.fromUri(td).rel("describedby").type(TD_MEDIA_TYPE).build();
    }
}
