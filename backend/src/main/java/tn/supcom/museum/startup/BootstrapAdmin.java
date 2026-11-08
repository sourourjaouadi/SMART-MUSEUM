package tn.supcom.museum.startup;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.Initialized;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import tn.supcom.museum.config.Env;
import tn.supcom.museum.error.ApiException;
import tn.supcom.museum.repository.UserRepository;
import tn.supcom.museum.security.UserAuthenticationService;

import java.util.List;
import java.util.logging.Logger;

/** Optional one-time bootstrap for the first administrator, configured only on the server. */
@ApplicationScoped
public class BootstrapAdmin {
    private static final Logger LOG = Logger.getLogger(BootstrapAdmin.class.getName());

    @Inject
    UserRepository users;
    @Inject
    UserAuthenticationService authentication;

    void onStart(@Observes @Initialized(ApplicationScoped.class) Object init) {
        String name = Env.get("BOOTSTRAP_ADMIN_NAME", "");
        String email = Env.get("BOOTSTRAP_ADMIN_EMAIL", "");
        String password = Env.get("BOOTSTRAP_ADMIN_PASSWORD", "");
        int configured = (name.isBlank() ? 0 : 1) + (email.isBlank() ? 0 : 1) + (password.isBlank() ? 0 : 1);
        if (configured == 0) return;
        if (configured != 3) {
            throw new IllegalStateException("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD together");
        }

        var existing = users.findByEmail(email);
        if (existing.isPresent()) {
            if (!"ADMIN".equals(existing.get().role) || !"active".equals(existing.get().status)) {
                throw new IllegalStateException("Bootstrap email already belongs to a non-active-admin account");
            }
            return;
        }
        try {
            authentication.provision(name, email, password, "ADMIN", List.of());
            LOG.info("Initial administrator account provisioned");
        } catch (ApiException e) {
            throw new IllegalStateException("Initial administrator provisioning failed: " + e.getMessage(), e);
        }
    }
}
