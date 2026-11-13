package tn.supcom.museum.api.rest;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.iam.rest.UserResource;
import tn.supcom.museum.iam.security.ServiceTokenRequired;
import tn.supcom.museum.iam.security.UserAuthenticated;

import static org.junit.jupiter.api.Assertions.*;

class SecurityBindingTest {
    @Test
    void userResourcesAreProtectedWhileHealthAndServiceEndpointsRemainSeparate() throws Exception {
        assertNotNull(DeviceResource.class.getAnnotation(UserAuthenticated.class));
        assertNotNull(MeasurementResource.class.getAnnotation(UserAuthenticated.class));
        assertNotNull(UserResource.class.getAnnotation(UserAuthenticated.class));
        assertNull(HealthResource.class.getAnnotation(UserAuthenticated.class));

        assertNotNull(IngestResource.class.getMethod("ingest", tn.supcom.museum.core.model.Measurement.class)
                .getAnnotation(ServiceTokenRequired.class));
        assertNotNull(ThingResource.class.getMethod("announce", tn.supcom.museum.core.model.ThingAnnouncement.class,
                jakarta.ws.rs.core.UriInfo.class).getAnnotation(ServiceTokenRequired.class));
        assertNotNull(ThingResource.class.getMethod("list", jakarta.ws.rs.core.SecurityContext.class)
                .getAnnotation(UserAuthenticated.class));
        assertNull(IngestResource.class.getMethod("ingest", tn.supcom.museum.core.model.Measurement.class)
                .getAnnotation(UserAuthenticated.class));
    }
}
