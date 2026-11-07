/*
 * Module  : RangeHandler
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.model.Measurement;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** Maillon 3 : plage de valeurs, qualite, date non future (422). */
public class RangeHandler extends ValidationHandler {

    private static final Map<String, double[]> LIMITS = Map.of(
            "temperature", new double[]{-40, 85},
            "humidity", new double[]{0, 100},
            "pressure", new double[]{300, 1100},
            "illuminance", new double[]{0, 100000});

    @Override
    public Outcome handle(Measurement m) {
        double[] r = LIMITS.get(m.property);
        if (r == null) throw ApiException.badRequest("property inconnue : " + m.property);
        if (m.value < r[0] || m.value > r[1])
            throw ApiException.unprocessable(m.property + " hors plage [" + r[0] + ", " + r[1] + "]");
        if ("bad".equals(m.quality))
            throw ApiException.unprocessable("Mesure de qualite 'bad' refusee");
        if (Instant.parse(m.observedAt).isAfter(Instant.now().plus(Duration.ofMinutes(5))))
            throw ApiException.unprocessable("observedAt dans le futur");
        return forward(m);
    }
}
