/*
 * Module  : ChainOrderTest
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import org.junit.jupiter.api.Test;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;

import static org.junit.jupiter.api.Assertions.*;

/** Verifie l'ordre de la chaine : schema avant plage, sans base de donnees. */
class ChainOrderTest {

    @Test
    void schemaErrorWinsOverRangeError() {
        SchemaHandler head = new SchemaHandler();
        head.linkWith(new RangeHandler());
        Measurement m = SchemaHandlerTest.valid();
        m.property = "inconnue";
        m.value = 9999.0;
        assertEquals(400, assertThrows(ApiException.class, () -> head.handle(m)).getStatus());
    }

    @Test
    void validMessageTraversesChain() {
        SchemaHandler head = new SchemaHandler();
        head.linkWith(new RangeHandler());
        assertEquals(ValidationHandler.Outcome.ACCEPTED, head.handle(SchemaHandlerTest.valid()));
    }
}
