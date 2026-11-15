package tn.supcom.museum.api.error;

/** API-owned request/authorization error and translation of downstream HTTP errors. */
public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    public ApiException(int status, String code, String message) { super(message); this.status = status; this.code = code; }
    public int getStatus() { return status; }
    public String getCode() { return code; }
    public static ApiException badRequest(String msg) { return new ApiException(400, "INVALID_SCHEMA", msg); }
    public static ApiException unauthorized(String msg) { return new ApiException(401, "UNAUTHORIZED", msg); }
    public static ApiException forbidden(String msg) { return new ApiException(403, "FORBIDDEN", msg); }
    public static ApiException accessDenied(String msg) { return new ApiException(403, "FORBIDDEN", msg); }
    public static ApiException notFound(String msg) { return new ApiException(404, "NOT_FOUND", msg); }
}
