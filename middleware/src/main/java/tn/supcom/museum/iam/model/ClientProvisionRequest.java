package tn.supcom.museum.iam.model;

import java.util.List;

/** Request for an ADMIN to provision a CLIENT account; no account-management CRUD is exposed. */
public class ClientProvisionRequest {
    public String name;
    public String email;
    public String password;
    public List<String> zoneIds;

    public ClientProvisionRequest() {
    }
}
