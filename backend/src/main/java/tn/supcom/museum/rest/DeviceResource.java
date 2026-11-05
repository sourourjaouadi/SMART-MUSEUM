/*
 * Module  : DeviceResource
 * Auteur  : P2 (Backend)
 * Date    : 2026-11-02
 * Version : 1.0
 */
package tn.supcom.museum.rest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.model.Device;
import tn.supcom.museum.repository.DeviceRepository;

import java.util.List;

/** TODO S3/S4 : proteger par authentification et RBAC (lecture ouverte en dev uniquement). */
@Path("/devices")
@ApplicationScoped
public class DeviceResource {

    @Inject
    DeviceRepository devices;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<Device> list() {
        return devices.findAll();
    }
}
