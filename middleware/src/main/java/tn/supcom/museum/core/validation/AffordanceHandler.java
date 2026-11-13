package tn.supcom.museum.core.validation;

import tn.supcom.museum.core.error.ApiException;
import tn.supcom.museum.core.model.Measurement;

import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Maillon 5 : la mesure doit correspondre a une propriete declaree dans la Thing Description
 * de l'appareil (affordance W3C WoT), avec la meme unite si la TD en precise une (422).
 * Un appareil sans TD enregistree (ancien appareil seme) n'est pas controle.
 */
public class AffordanceHandler extends ValidationHandler {

    private final Function<String, Optional<Map<String, String>>> declaredProperties;

    /** @param declaredProperties deviceId -> proprietes declarees (nom -> unite), vide si pas de TD */
    public AffordanceHandler(Function<String, Optional<Map<String, String>>> declaredProperties) {
        this.declaredProperties = declaredProperties;
    }

    @Override
    public Outcome handle(Measurement m) {
        Optional<Map<String, String>> declared = declaredProperties.apply(m.deviceId);
        if (declared.isPresent()) {
            Map<String, String> props = declared.get();
            if (!props.containsKey(m.property))
                throw ApiException.undeclaredProperty("Propriete " + m.property
                        + " non declaree dans la Thing Description de " + m.deviceId);
            String unit = props.get(m.property);
            if (unit != null && !unit.equals(m.unit))
                throw ApiException.undeclaredProperty("Unite " + m.unit + " differente de celle de la TD ("
                        + unit + ") pour " + m.property);
        }
        return forward(m);
    }
}
