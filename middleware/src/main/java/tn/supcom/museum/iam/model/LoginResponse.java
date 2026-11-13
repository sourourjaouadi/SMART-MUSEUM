package tn.supcom.museum.iam.model;

public record LoginResponse(String accessToken, String tokenType, long expiresIn,
                            UserAccount user) {
}
