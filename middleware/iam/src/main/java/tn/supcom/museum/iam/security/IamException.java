package tn.supcom.museum.iam.security;

/** IAM-owned security/account error. API preserves its status and code at the public boundary. */
public class IamException extends RuntimeException {
    private final int status;
    private final String code;
    public IamException(int status, String code, String message) { super(message); this.status = status; this.code = code; }
    public int getStatus() { return status; }
    public String getCode() { return code; }
    public static IamException badRequest(String message) { return new IamException(400, "INVALID_SCHEMA", message); }
    public static IamException unauthorized(String message) { return new IamException(401, "UNAUTHORIZED", message); }
    public static IamException forbidden(String message) { return new IamException(403, "FORBIDDEN", message); }
    public static IamException conflict(String message) { return new IamException(409, "INVALID_STATE", message); }
}
