package tn.supcom.museum.iam.model;

public class InternalAuthenticationRequest {
    public String accessToken;
    public InternalAuthenticationRequest() { }
    public InternalAuthenticationRequest(String accessToken) { this.accessToken = accessToken; }
}
