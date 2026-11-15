package tn.supcom.museum.core.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import tn.supcom.museum.core.data.DeviceData;
import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.*;
import tn.supcom.museum.core.repository.*;
import tn.supcom.museum.core.validation.ValidationChain;
import tn.supcom.museum.core.validation.ValidationHandler;
import tn.supcom.museum.core.wot.DiscoveryService;
import tn.supcom.museum.contracts.security.InternalServiceRequired;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Path("/internal/core")
@ApplicationScoped
@InternalServiceRequired
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class InternalCoreResource {
    @Inject DeviceRepository devices;
    @Inject MeasurementRepository measurements;
    @Inject ThingRepository things;
    @Inject DiscoveryService discovery;
    @Inject ValidationChain validation;
    @Inject DeviceData deviceData;

    @GET @Path("/health")
    public Map<String, String> health() {
        try { deviceData.findById("__health__"); return Map.of("status", "UP", "mongo", "UP"); }
        catch (RuntimeException e) { return Map.of("status", "UP", "mongo", "DOWN"); }
    }
    @GET @Path("/devices") public List<Device> devices(@QueryParam("status") String status) { return devices.findByStatus(status); }
    @GET @Path("/devices/{id}") public Device device(@PathParam("id") String id) {
        return devices.findById(id).orElseThrow(() -> ApiException.notFound("Appareil inconnu : " + id));
    }
    @POST @Path("/devices/{id}/approve") public Device approve(@PathParam("id") String id) { return discovery.approve(id); }
    @POST @Path("/devices/{id}/reject") public Device reject(@PathParam("id") String id) { return discovery.reject(id); }
    @GET @Path("/measurements/latest") public List<Measurement> latest(@QueryParam("zoneId") String zoneId) { return measurements.findLatest(zoneId); }
    @GET @Path("/measurements/history") public List<Measurement> history(@QueryParam("deviceId") String deviceId,
            @QueryParam("property") String property, @QueryParam("from") String from, @QueryParam("to") String to,
            @QueryParam("limit") @DefaultValue("1000") int limit) {
        return measurements.findHistory(deviceId, property, instant(from), instant(to), limit);
    }
    @POST @Path("/things/announce") public DiscoveryResult announce(ThingAnnouncement announcement) {
        DiscoveryService.Result result = discovery.announce(announcement);
        return new DiscoveryResult(result.created(), result.device());
    }
    @GET @Path("/things") public String thingList() { return "[" + String.join(",", things.findAllJson()) + "]"; }
    @GET @Path("/things/{id}") @Produces("application/td+json") public Response thing(@PathParam("id") String id) {
        String td = things.findJson(id).orElseThrow(() -> ApiException.notFound("Aucune Thing Description pour " + id));
        return Response.ok(td, "application/td+json").build();
    }
    @POST @Path("/ingest") public IngestResult ingest(Measurement measurement) {
        ValidationHandler.Outcome result = validation.process(measurement);
        return new IngestResult(result == ValidationHandler.Outcome.DUPLICATE ? "duplicate" : "accepted");
    }
    private static Instant instant(String value) { return value == null || value.isBlank() ? null : Instant.parse(value); }
}
