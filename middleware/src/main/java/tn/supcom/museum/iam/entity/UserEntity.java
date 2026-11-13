package tn.supcom.museum.iam.entity;

import jakarta.nosql.Column;
import jakarta.nosql.Entity;
import jakarta.nosql.Id;

import java.util.ArrayList;
import java.util.List;

/** Middleware-managed account in MongoDB's users collection. */
@Entity("users")
public class UserEntity {
    // Canonical email as Mongo _id makes login identifiers unique at the storage layer.
    @Id
    public String emailKey;

    @Column
    public String userId;

    @Column
    public String name;

    @Column
    public String email;

    @Column
    public String passwordHash;

    @Column
    public String role;

    @Column
    public String status;

    @Column
    public List<String> zoneIds = new ArrayList<>();

    public UserEntity() {
    }
}
