package tn.supcom.museum.iam.rest;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.core.error.ErrorResponse;
import tn.supcom.museum.iam.security.IamException;
@Provider public class ApiExceptionMapper implements ExceptionMapper<IamException> {
 public Response toResponse(IamException e) { return Response.status(e.getStatus()).type(MediaType.APPLICATION_JSON).entity(new ErrorResponse(e.getCode(), e.getMessage())).build(); }
}
