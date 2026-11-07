
package tn.supcom.museum.error;

public class ErrorResponse {
    public String error;
    public String message;

    public ErrorResponse() {
    }

    public ErrorResponse(String error, String message) {
        this.error = error;
        this.message = message;
    }
}
