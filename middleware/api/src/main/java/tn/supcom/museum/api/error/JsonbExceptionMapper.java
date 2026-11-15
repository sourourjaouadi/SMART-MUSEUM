
package tn.supcom.museum.api.error;

import jakarta.json.bind.JsonbException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import tn.supcom.museum.core.error.ErrorResponse;

/** JSON malforme : 400 propre au lieu d'une erreur serveur. */
@Provider
public class JsonbExceptionMapper implements ExceptionMapper<JsonbException> {
    @Override
    public Response toResponse(JsonbException e) {
        return Response.status(400).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse("INVALID_SCHEMA", "JSON invalide"))
                .build();
    }
}
