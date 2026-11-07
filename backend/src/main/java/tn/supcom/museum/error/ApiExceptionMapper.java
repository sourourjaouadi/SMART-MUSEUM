
package tn.supcom.museum.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ApiExceptionMapper implements ExceptionMapper<ApiException> {
    @Override
    public Response toResponse(ApiException e) {
        return Response.status(e.getStatus())
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse(e.getCode(), e.getMessage()))
                .build();
    }
}
