package tn.supcom.museum.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AccessTokenServiceTest {
    private final byte[] signingKey = new byte[32];
    private final AccessTokenService tokens = configured(signingKey);

    private static AccessTokenService configured(byte[] key) {
        AccessTokenService service = new AccessTokenService();
        service.configure(key, "smart-museum-test", 900);
        return service;
    }

    @Test
    void validatesIssuedTokenClaimsAndRejectsWrongSignature() {
        var issued = tokens.issue(UUID.randomUUID().toString(), "CLIENT");
        var claims = tokens.validate(issued.value());

        assertEquals("smart-museum-test", claims.getIssuer());
        assertEquals("CLIENT", claims.get("role", String.class));
        assertTrue(claims.getExpiration().after(new Date()));
        assertEquals(900, issued.expiresIn());
        assertThrows(RuntimeException.class,
                () -> configured(signingKey).validate(Jwts.builder().issuer("another-issuer")
                        .subject("user").issuedAt(new Date())
                        .expiration(Date.from(Instant.now().plusSeconds(300)))
                        .signWith(Keys.hmacShaKeyFor(signingKey)).compact()));
    }

    @Test
    void rejectsExpiredMalformedAndIncorrectlySignedTokens() {
        String expired = Jwts.builder().issuer("smart-museum-test").subject("user-1")
                .claim("role", "ADMIN").issuedAt(Date.from(Instant.now().minusSeconds(120)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(signingKey)).compact();
        byte[] otherKey = new byte[32];
        otherKey[0] = 1;
        String otherKeyToken = Jwts.builder().issuer("smart-museum-test").subject("user-1")
                .claim("role", "ADMIN").issuedAt(new Date())
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(otherKey)).compact();

        assertThrows(RuntimeException.class, () -> tokens.validate(expired));
        assertThrows(RuntimeException.class, () -> tokens.validate(otherKeyToken));
        assertThrows(RuntimeException.class, () -> tokens.validate("not.a.jwt"));
    }
}
