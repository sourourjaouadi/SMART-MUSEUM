package tn.supcom.museum.security;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.rest.DeviceResource;
import tn.supcom.museum.rest.HealthResource;
import tn.supcom.museum.rest.IngestResource;
import tn.supcom.museum.rest.MeasurementResource;
import tn.supcom.museum.rest.ThingResource;
import tn.supcom.museum.rest.UserResource;

import static org.junit.jupiter.api.Assertions.*;

class SecurityBindingTest {
    @Test
    void userResourcesAreProtectedWhileHealthAndServiceEndpointsRemainSeparate() throws Exception {
        assertNotNull(DeviceResource.class.getAnnotation(UserAuthenticated.class));
        assertNotNull(MeasurementResource.class.getAnnotation(UserAuthenticated.class));
        assertNotNull(UserResource.class.getAnnotation(UserAuthenticated.class));
        assertNull(HealthResource.class.getAnnotation(UserAuthenticated.class));

        assertNotNull(IngestResource.class.getMethod("ingest", tn.supcom.museum.model.Measurement.class)
                .getAnnotation(ServiceTokenRequired.class));
        assertNotNull(ThingResource.class.getMethod("announce", tn.supcom.museum.model.ThingAnnouncement.class,
                jakarta.ws.rs.core.UriInfo.class).getAnnotation(ServiceTokenRequired.class));
        assertNotNull(ThingResource.class.getMethod("list", jakarta.ws.rs.core.SecurityContext.class)
                .getAnnotation(UserAuthenticated.class));
        assertNull(IngestResource.class.getMethod("ingest", tn.supcom.museum.model.Measurement.class)
                .getAnnotation(UserAuthenticated.class));
    }
}
