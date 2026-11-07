/*
 * Module  : DeviceResource
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-07
 * Version : 1.1
 */
package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.repository.DeviceRepository;
import tn.supcom.museum.security.AdminTokenRequired;
import tn.supcom.museum.validation.SchemaHandler;
import tn.supcom.museum.wot.DiscoveryService;

import java.util.List;
import java.util.Set;

/** TODO S3/S4 : proteger la lecture par authentification et RBAC (lecture ouverte en dev uniquement). */
@Path("/devices")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class DeviceResource {

    private static final Set<String> STATUSES =
            Set.of(Device.PENDING, Device.ACTIVE, Device.REJECTED, Device.OFFLINE);

    @Inject
    DeviceRepository devices;
    @Inject
    DiscoveryService discovery;

    /** Liste des appareils ; ?status=pending pour les appareils decouverts en attente d'approbation. */
    @GET
    public List<Device> list(@QueryParam("status") String status) {
        if (status != null && !STATUSES.contains(status))
            throw ApiException.badRequest("status doit valoir pending, active, rejected ou offline");
        return devices.findByStatus(status);
    }

    /** Detail d'un appareil, avec le lien RFC 8288 vers sa Thing Description. */
    @GET
    @Path("/{deviceId}")
    public Response get(@PathParam("deviceId") String deviceId, @Context UriInfo uri) {
        checkId(deviceId);
        Device d = devices.findById(deviceId)
                .orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + deviceId));
        Response.ResponseBuilder rb = Response.ok(d);
        if (d.thingId != null) rb.links(ThingResource.describedBy(ThingResource.tdUri(uri, deviceId)));
        return rb.build();
    }

    @POST
    @Path("/{deviceId}/approve")
    @AdminTokenRequired
    public Device approve(@PathParam("deviceId") String deviceId) {
        return discovery.approve(deviceId);
    }

    @POST
    @Path("/{deviceId}/reject")
    @AdminTokenRequired
    public Device reject(@PathParam("deviceId") String deviceId) {
        return discovery.reject(deviceId);
    }

    private static void checkId(String deviceId) {
        if (!SchemaHandler.ID.matcher(deviceId).matches())
            throw ApiException.badRequest("Identifiant invalide : deviceId");
    }
}
