/*
 * Module  : JsonbExceptionMapper
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.error;

import jakarta.json.bind.JsonbException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

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
