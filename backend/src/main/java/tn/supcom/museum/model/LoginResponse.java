package tn.supcom.museum.model;

public record LoginResponse(String accessToken, String tokenType, long expiresIn,
                            UserAccount user) {
}
