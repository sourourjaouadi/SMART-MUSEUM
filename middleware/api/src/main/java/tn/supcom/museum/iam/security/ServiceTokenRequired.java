/*
 * Module  : ServiceTokenRequired
 * Auteur  : P2 (Middleware)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.iam.security;

import jakarta.ws.rs.NameBinding;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@NameBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface ServiceTokenRequired {
}
