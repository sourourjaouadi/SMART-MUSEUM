package tn.supcom.museum.error;

public class ApiException extends RuntimeException {

    private final int status;
    private final String code;

    public ApiException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static ApiException badRequest(String msg) {
        return new ApiException(400, "INVALID_SCHEMA", msg);
    }

    public static ApiException unauthorized(String msg) {
        return new ApiException(401, "UNAUTHORIZED", msg);
    }

    public static ApiException forbidden(String msg) {
        return new ApiException(403, "DEVICE_NOT_TRUSTED", msg);
    }

    public static ApiException accessDenied(String msg) {
        return new ApiException(403, "FORBIDDEN", msg);
    }

    public static ApiException unprocessable(String msg) {
        return new ApiException(422, "OUT_OF_RANGE", msg);
    }

    public static ApiException invalidThingDescription(String msg) {
        return new ApiException(400, "INVALID_TD", msg);
    }

    public static ApiException undeclaredProperty(String msg) {
        return new ApiException(422, "UNDECLARED_PROPERTY", msg);
    }

    public static ApiException notFound(String msg) {
        return new ApiException(404, "NOT_FOUND", msg);
    }

    public static ApiException conflict(String msg) {
        return new ApiException(409, "INVALID_STATE", msg);
    }
}
