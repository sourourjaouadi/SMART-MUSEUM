package tn.supcom.museum.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import tn.supcom.museum.config.Env;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@ApplicationScoped
public class AccessTokenService {
    private SecretKey key;
    private String issuer;
    private long expirationSeconds;

    @PostConstruct
    void initialize() {
        String encodedKey = Env.get("JWT_SIGNING_KEY_BASE64", "");
        if (encodedKey.isBlank()) {
            throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must be configured");
        }
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(encodedKey);
        } catch (RuntimeException e) {
            throw new IllegalStateException("JWT_SIGNING_KEY_BASE64 must contain valid Base64", e);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT signing key must contain at least 32 random bytes");
        }
        String configuredIssuer = Env.get("JWT_ISSUER", "smart-museum");
        long configuredExpiration;
        try {
            configuredExpiration = Long.parseLong(Env.get("JWT_ACCESS_TOKEN_SECONDS", "900"));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be an integer", e);
        }
        configure(keyBytes, configuredIssuer, configuredExpiration);
    }

    void configure(byte[] keyBytes, String configuredIssuer, long configuredExpiration) {
        if (keyBytes == null || keyBytes.length < 32) {
            throw new IllegalStateException("JWT signing key must contain at least 32 random bytes");
        }
        if (configuredIssuer == null || configuredIssuer.isBlank()) {
            throw new IllegalStateException("JWT_ISSUER must not be empty");
        }
        if (configuredExpiration < 60 || configuredExpiration > 3600) {
            throw new IllegalStateException("JWT_ACCESS_TOKEN_SECONDS must be between 60 and 3600");
        }
        key = Keys.hmacShaKeyFor(keyBytes.clone());
        issuer = configuredIssuer;
        expirationSeconds = configuredExpiration;
    }

    public IssuedToken issue(String userId, String role) {
        Instant now = Instant.now();
        Instant expires = now.plusSeconds(expirationSeconds);
        String token = Jwts.builder()
                .issuer(issuer)
                .subject(userId)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expires))
                .signWith(key)
                .compact();
        return new IssuedToken(token, expirationSeconds);
    }

    public Claims validate(String token) {
        Claims claims = Jwts.parser().verifyWith(key).requireIssuer(issuer).build()
                .parseSignedClaims(token).getPayload();
        Date issuedAt = claims.getIssuedAt();
        Date expiration = claims.getExpiration();
        if (claims.getSubject() == null || claims.getSubject().isBlank()
                || issuedAt == null || expiration == null
                || issuedAt.after(Date.from(Instant.now().plusSeconds(30)))
                || !expiration.after(issuedAt)
                || expiration.getTime() - issuedAt.getTime() > 3_600_000L) {
            throw new IllegalArgumentException("Invalid access token claims");
        }
        return claims;
    }

    public record IssuedToken(String value, long expiresIn) {
    }
}
