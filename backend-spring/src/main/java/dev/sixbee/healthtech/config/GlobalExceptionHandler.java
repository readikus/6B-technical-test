package dev.sixbee.healthtech.config;

import dev.sixbee.healthtech.service.AuthService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    List<Map<String, String>> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> Map.of("field", fe.getField(), "message", fe.getDefaultMessage()))
            .toList();
    return ResponseEntity.badRequest()
        .body(Map.of("message", "Validation failed", "errors", errors));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
    HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "statusCode", status.value(),
                "message", ex.getReason() != null ? ex.getReason() : status.getReasonPhrase(),
                "error", status.getReasonPhrase()));
  }

  @ExceptionHandler(AuthService.UnauthorizedException.class)
  public ResponseEntity<Map<String, Object>> handleUnauthorized(
      AuthService.UnauthorizedException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("statusCode", 401, "message", ex.getMessage(), "error", "Unauthorized"));
  }
}
