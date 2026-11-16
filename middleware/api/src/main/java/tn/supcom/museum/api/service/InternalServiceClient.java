package tn.supcom.museum.api.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import tn.supcom.museum.api.error.ApiException;
import tn.supcom.museum.core.error.ErrorResponse;
import tn.supcom.museum.core.model.*;
import tn.supcom.museum.iam.model.*;

import java.util.List;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class InternalServiceClient {
    public List<Device> devices(String status) {
        try (Client c = client()) {
            var target = c.target(base("CORE_SERVICE_URL")).path("internal/core/devices");
            if (status != null) target = target.queryParam("status", status);
            return readList(invoke(target, MediaType.APPLICATION_JSON_TYPE), new GenericType<List<Device>>() { });
        }
    }
    public Device device(String id) { return core("internal/core/devices/" + segment(id), Device.class); }
    public Device approve(String id) { return coreAction("internal/core/devices/" + segment(id) + "/approve", Device.class); }
    public Device reject(String id) { return coreAction("internal/core/devices/" + segment(id) + "/reject", Device.class); }
    public Device assignLocation(String id, Location location) {
        return coreWrite("PUT", "internal/core/devices/" + segment(id) + "/location", location, Device.class);
    }
    public Device clearLocation(String id) {
        return coreWrite("DELETE", "internal/core/devices/" + segment(id) + "/location", null, Device.class);
    }
    public List<Zone> zones() {
        try (Client c = client()) {
            return readList(invoke(c.target(base("CORE_SERVICE_URL")).path("internal/core/zones"), MediaType.APPLICATION_JSON_TYPE),
                    new GenericType<List<Zone>>() { });
        }
    }
    public Zone zone(String id) { return core("internal/core/zones/" + segment(id), Zone.class); }
    public Zone saveZone(String id, Zone zone) { return coreWrite("PUT", "internal/core/zones/" + segment(id), zone, Zone.class); }
    public List<Measurement> latest(String zone) { return coreList("internal/core/measurements/latest", "zoneId", zone); }
    public List<Measurement> history(String device, String property, String from, String to, int limit) {
        try (Client c = client()) {
            return readList(invoke(c.target(base("CORE_SERVICE_URL")).path("internal/core/measurements/history")
                    .queryParam("deviceId", device).queryParam("property", property).queryParam("from", from)
                    .queryParam("to", to).queryParam("limit", limit), MediaType.APPLICATION_JSON_TYPE),
                    new GenericType<List<Measurement>>() { });
        }
    }
    public DiscoveryResult announce(ThingAnnouncement a) { return corePost("internal/core/things/announce", a, DiscoveryResult.class); }
    public String things() { return coreString("internal/core/things"); }
    public String thing(String id) {
        try (Client c = client()) { return read(invoke(c.target(base("CORE_SERVICE_URL")).path("internal/core/things/" + segment(id)), MediaType.valueOf("application/td+json")), String.class); }
    }
    public IngestResult ingest(Measurement m) { return corePost("internal/core/ingest", m, IngestResult.class); }
    public MapHealth health() {
        try (Client c = client()) { return read(invoke(c.target(base("CORE_SERVICE_URL")).path("internal/core/health"), MediaType.APPLICATION_JSON_TYPE), MapHealth.class); }
    }
    public LoginResponse login(LoginRequest request) { return iamPost("internal/iam/login", request, LoginResponse.class); }
    public AuthenticatedUser authenticate(String token) { return iamPost("internal/iam/authenticate", new InternalAuthenticationRequest(token), AuthenticatedUser.class); }
    public UserAccount provision(ClientProvisionRequest request, String bearer) {
        try (Client c = client()) {
            Response response = c.target(base("IAM_SERVICE_URL")).path("internal/iam/users")
                    .request(MediaType.APPLICATION_JSON_TYPE).header("X-Internal-Service-Token", internalToken())
                    .header("Authorization", bearer).post(jakarta.ws.rs.client.Entity.json(request));
            return read(response, UserAccount.class);
        }
    }

    private <T> T core(String path, Class<T> type, String... query) {
        try (Client c = client()) {
            var target = c.target(base("CORE_SERVICE_URL")).path(path);
            if (query.length == 2) target = target.queryParam(query[0], query[1]);
            return read(invoke(target, MediaType.APPLICATION_JSON_TYPE), type);
        }
    }
    private <T> T coreAction(String path, Class<T> type) {
        try (Client c = client()) {
            Response response = c.target(base("CORE_SERVICE_URL")).path(path)
                    .request(MediaType.APPLICATION_JSON_TYPE)
                    .header("X-Internal-Service-Token", internalToken())
                    .method("POST");
            return read(response, type);
        }
    }
    private <T> T coreWrite(String method, String path, Object entity, Class<T> type) {
        try (Client c = client()) {
            var request = c.target(base("CORE_SERVICE_URL")).path(path).request(MediaType.APPLICATION_JSON_TYPE)
                    .header("X-Internal-Service-Token", internalToken());
            Response response = entity == null ? request.method(method)
                    : request.method(method, jakarta.ws.rs.client.Entity.json(entity));
            return read(response, type);
        }
    }
    private List<Measurement> coreList(String path, String key, String value) {
        try (Client c = client()) { return readList(invoke(c.target(base("CORE_SERVICE_URL")).path(path).queryParam(key, value), MediaType.APPLICATION_JSON_TYPE), new GenericType<List<Measurement>>() { }); }
    }
    private <T> T corePost(String path, Object entity, Class<T> type) { return post("CORE_SERVICE_URL", path, entity, type); }
    private <T> T iamPost(String path, Object entity, Class<T> type) { return post("IAM_SERVICE_URL", path, entity, type); }
    private <T> T post(String service, String path, Object entity, Class<T> type) {
        try (Client c = client()) { Response r = c.target(base(service)).path(path).request(MediaType.APPLICATION_JSON_TYPE)
                .header("X-Internal-Service-Token", internalToken()).post(jakarta.ws.rs.client.Entity.json(entity)); return read(r, type); }
    }
    private String coreString(String path) {
        try (Client c = client()) { return read(invoke(c.target(base("CORE_SERVICE_URL")).path(path), MediaType.APPLICATION_JSON_TYPE), String.class); }
    }
    private static Response invoke(jakarta.ws.rs.client.WebTarget target, MediaType type) {
        return target.request(type).header("X-Internal-Service-Token", internalToken()).get();
    }
    private static <T> T read(Response response, Class<T> type) {
        try {
            if (response.getStatusInfo().getFamily() == Response.Status.Family.SUCCESSFUL) return response.readEntity(type);
            ErrorResponse error = response.hasEntity() ? response.readEntity(ErrorResponse.class) : null;
            throw new ApiException(response.getStatus(), error == null || error.error == null ? "SERVICE_ERROR" : error.error,
                    error == null || error.message == null ? "Internal service request failed" : error.message);
        } finally { response.close(); }
    }
    private static <T> T readList(Response response, GenericType<T> type) {
        try {
            if (response.getStatusInfo().getFamily() == Response.Status.Family.SUCCESSFUL) return response.readEntity(type);
            ErrorResponse error = response.hasEntity() ? response.readEntity(ErrorResponse.class) : null;
            throw new ApiException(response.getStatus(), error == null || error.error == null ? "SERVICE_ERROR" : error.error,
                    error == null || error.message == null ? "Internal service request failed" : error.message);
        } finally { response.close(); }
    }
    private static Client client() { return ClientBuilder.newBuilder().connectTimeout(5, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS).build(); }
    private static String base(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new ApiException(503, "SERVICE_UNAVAILABLE", name + " is not configured");
        return value.endsWith("/") ? value : value + "/";
    }
    private static String internalToken() {
        String value = System.getenv("INTER_SERVICE_TOKEN");
        if (value == null || value.length() < 32) throw new ApiException(503, "SERVICE_UNAVAILABLE", "Internal service authentication is not configured");
        return value;
    }
    private static String segment(String value) { return value.replace("%", "%25").replace("/", "%2F").replace("?", "%3F"); }
    public static class MapHealth {
        public String status;
        public String mongo;
        public MapHealth() { }
    }
}
