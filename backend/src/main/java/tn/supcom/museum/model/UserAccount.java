package tn.supcom.museum.model;

import java.util.List;

/** Safe account view; password hashes are deliberately excluded. */
public record UserAccount(String userId, String name, String email, String role,
                          String status, List<String> zoneIds) {
}
