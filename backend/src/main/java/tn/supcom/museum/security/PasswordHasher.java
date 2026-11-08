package tn.supcom.museum.security;

import org.mindrot.jbcrypt.BCrypt;
import jakarta.enterprise.context.ApplicationScoped;

/** BCrypt password hashing; only encoded hashes are persisted. */
@ApplicationScoped
public class PasswordHasher {
    private static final int COST = 12;

    public String hash(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt(COST));
    }

    public boolean verify(String password, String hash) {
        if (password == null || hash == null || !hash.matches("^\\$2[aby]\\$\\d\\d\\$[./A-Za-z0-9]{53}$")) {
            return false;
        }
        try {
            return BCrypt.checkpw(password, hash);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }
}
