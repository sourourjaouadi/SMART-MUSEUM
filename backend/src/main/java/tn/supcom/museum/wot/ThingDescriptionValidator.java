package tn.supcom.museum.wot;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Validation structurelle d'une W3C WoT Thing Description 1.1 (JSON-LD 1.1).
 * Verifie les termes obligatoires (@context, id, title, securityDefinitions, security)
 * et les affordances (properties, actions, events) avec leurs forms.
 * Classe sans dependance externe : la TD est recue sous forme de Map JSON-B.
 */
public final class ThingDescriptionValidator {

    public static final String TD_CONTEXT_V11 = "https://www.w3.org/2022/wot/td/v1.1";
    static final Set<String> AFFORDANCE_TYPES = Set.of("properties", "actions", "events");
    static final Set<String> DATA_TYPES = Set.of("boolean", "integer", "number", "string", "object", "array", "null");
    static final int MAX_AFFORDANCES = 100;

    private ThingDescriptionValidator() {
    }

    /**
     * @param td       la Thing Description
     * @param deviceId identifiant attendu : l'id de la TD doit se terminer par ":" + deviceId ou "/" + deviceId
     * @return la liste des erreurs (vide si la TD est valide)
     */
    public static List<String> validate(Map<String, Object> td, String deviceId) {
        List<String> errors = new ArrayList<>();
        if (td == null || td.isEmpty()) {
            errors.add("Thing Description absente");
            return errors;
        }
        checkContext(td.get("@context"), errors);
        checkId(td.get("id"), deviceId, errors);
        if (!nonBlankString(td.get("title"))) errors.add("title obligatoire");
        Set<String> schemes = checkSecurityDefinitions(td.get("securityDefinitions"), errors);
        checkSecurity(td.get("security"), schemes, errors);

        int total = 0;
        for (String kind : AFFORDANCE_TYPES) {
            Object section = td.get(kind);
            if (section == null) continue;
            if (!(section instanceof Map<?, ?> map)) {
                errors.add(kind + " doit etre un objet");
                continue;
            }
            total += map.size();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                checkAffordance(kind, String.valueOf(e.getKey()), e.getValue(), errors);
            }
        }
        if (total == 0) errors.add("La TD doit declarer au moins une affordance (properties, actions ou events)");
        if (total > MAX_AFFORDANCES) errors.add("Trop d'affordances (max " + MAX_AFFORDANCES + ")");
        return errors;
    }

    private static void checkContext(Object ctx, List<String> errors) {
        boolean ok;
        if (ctx instanceof String s) ok = TD_CONTEXT_V11.equals(s);
        else if (ctx instanceof List<?> l) ok = !l.isEmpty() && TD_CONTEXT_V11.equals(l.get(0));
        else ok = false;
        if (!ok) errors.add("@context doit etre (ou commencer par) " + TD_CONTEXT_V11);
    }

    private static void checkId(Object id, String deviceId, List<String> errors) {
        if (!(id instanceof String s) || s.isBlank()) {
            errors.add("id obligatoire (URI)");
            return;
        }
        if (!isAbsoluteUri(s)) {
            errors.add("id doit etre une URI absolue (ex. urn:museum:device:" + deviceId + ")");
            return;
        }
        if (deviceId != null && !(s.endsWith(":" + deviceId) || s.endsWith("/" + deviceId))) {
            errors.add("id de la TD incoherent avec deviceId " + deviceId);
        }
    }

    private static Set<String> checkSecurityDefinitions(Object defs, List<String> errors) {
        if (!(defs instanceof Map<?, ?> map) || map.isEmpty()) {
            errors.add("securityDefinitions obligatoire (objet non vide)");
            return Set.of();
        }
        for (Map.Entry<?, ?> e : map.entrySet()) {
            if (!(e.getValue() instanceof Map<?, ?> scheme) || !nonBlankString(scheme.get("scheme"))) {
                errors.add("securityDefinitions." + e.getKey() + ".scheme obligatoire");
            }
        }
        Set<String> names = new java.util.HashSet<>();
        map.keySet().forEach(k -> names.add(String.valueOf(k)));
        return names;
    }

    private static void checkSecurity(Object sec, Set<String> schemes, List<String> errors) {
        Collection<?> refs;
        if (sec instanceof String s) refs = List.of(s);
        else if (sec instanceof List<?> l && !l.isEmpty()) refs = l;
        else {
            errors.add("security obligatoire (chaine ou tableau non vide)");
            return;
        }
        for (Object r : refs) {
            if (!(r instanceof String s) || !schemes.contains(s)) {
                errors.add("security reference un schema non defini : " + r);
            }
        }
    }

    private static void checkAffordance(String kind, String name, Object value, List<String> errors) {
        String path = kind + "." + name;
        if (!(value instanceof Map<?, ?> aff)) {
            errors.add(path + " doit etre un objet");
            return;
        }
        if ("properties".equals(kind) && aff.get("type") != null
                && !(aff.get("type") instanceof String t && DATA_TYPES.contains(t))) {
            errors.add(path + ".type invalide");
        }
        Object forms = aff.get("forms");
        if (!(forms instanceof List<?> list) || list.isEmpty()) {
            errors.add(path + ".forms obligatoire (tableau non vide)");
            return;
        }
        for (int i = 0; i < list.size(); i++) {
            if (!(list.get(i) instanceof Map<?, ?> form) || !(form.get("href") instanceof String href)
                    || href.isBlank()) {
                errors.add(path + ".forms[" + i + "].href obligatoire");
            }
        }
    }

    private static boolean nonBlankString(Object o) {
        return o instanceof String s && !s.isBlank();
    }

    private static boolean isAbsoluteUri(String s) {
        try {
            return new URI(s).isAbsolute();
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /**
     * Proprietes declarees dans la TD avec leur unite (null si absente).
     * Sert a verifier qu'une mesure correspond a une affordance de l'objet.
     */
    public static Map<String, String> declaredProperties(Map<String, Object> td) {
        Map<String, String> out = new java.util.HashMap<>();
        if (td != null && td.get("properties") instanceof Map<?, ?> props) {
            for (Map.Entry<?, ?> e : props.entrySet()) {
                String unit = e.getValue() instanceof Map<?, ?> p && p.get("unit") instanceof String u ? u : null;
                out.put(String.valueOf(e.getKey()), unit);
            }
        }
        return out;
    }
}
