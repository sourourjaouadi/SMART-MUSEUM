package tn.supcom.museum.iam.model;

import java.util.List;

public class ClientProvisionRequest {
    public String name;
    public String email;
    public String password;
    public List<String> zoneIds;
    public ClientProvisionRequest() { }
}
