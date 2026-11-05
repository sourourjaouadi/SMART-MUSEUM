/*
 * Module  : ValidationHandler
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.validation;

import tn.supcom.museum.model.Measurement;

/** Patron Chain of Responsibility : schema -> identite -> plage/qualite -> confiance -> persistance. */
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
