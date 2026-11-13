/*
 * Module  : ValidationHandler
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.core.validation;

import tn.supcom.museum.core.model.Measurement;

/** Patron Chain of Responsibility : schema -> identite -> plage/qualite -> confiance -> affordance WoT -> persistance. */
public abstract class ValidationHandler {

    public enum Outcome { ACCEPTED, DUPLICATE }

    private ValidationHandler next;

    public ValidationHandler linkWith(ValidationHandler n) {
        this.next = n;
        return n;
    }

    public abstract Outcome handle(Measurement m);

    protected Outcome forward(Measurement m) {
        return next == null ? Outcome.ACCEPTED : next.handle(m);
    }
}
