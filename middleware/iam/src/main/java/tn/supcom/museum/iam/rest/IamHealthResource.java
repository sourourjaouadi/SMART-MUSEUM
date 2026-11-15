package tn.supcom.museum.iam.rest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import tn.supcom.museum.iam.data.UserData;
import java.util.Map;
@Path("/health") @ApplicationScoped
public class IamHealthResource {
 @Inject UserData users;
 @GET @Produces(MediaType.APPLICATION_JSON)
 public Map<String,String> health() {
  try { users.findById("__health__"); return Map.of("status","UP","mongo","UP"); }
  catch (RuntimeException e) { return Map.of("status","UP","mongo","DOWN"); }
 }
}
