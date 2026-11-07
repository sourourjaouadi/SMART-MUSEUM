
package tn.supcom.museum.error;

import jakarta.json.bind.JsonbException;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/**
 * RESTEasy enveloppe les erreurs de lecture JSON dans une ProcessingException.
 * Cause JSON-B -> 400 propre ; autre cause -> 500 generique sans details internes.
 */
@Provider
public class ProcessingExceptionMapper implements ExceptionMapper<ProcessingException> {

    @Override
    public Response toResponse(ProcessingException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof JsonbException) {
                return Response.status(400).type(MediaType.APPLICATION_JSON)
                        .entity(new ErrorResponse("INVALID_SCHEMA", "JSON invalide")).build();
            }
        }
        return Response.status(500).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse("INTERNAL_ERROR", "Erreur interne")).build();
    }
}
