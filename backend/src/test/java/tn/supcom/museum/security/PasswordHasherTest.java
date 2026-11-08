package tn.supcom.museum.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordHasherTest {
    private final PasswordHasher hasher = new PasswordHasher();

    @Test
    void hashesAndVerifiesPasswordsWithoutStoringPlaintext() {
        String password = "museum-admin-passphrase";
        String hash = hasher.hash(password);

        assertNotEquals(password, hash);
        assertTrue(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$"));
        assertTrue(hasher.verify(password, hash));
        assertFalse(hasher.verify("incorrect-passphrase", hash));
    }

    @Test
    void rejectsMalformedHashes() {
        assertFalse(hasher.verify("password", "not-a-bcrypt-hash"));
        assertFalse(hasher.verify("password", null));
    }
}
