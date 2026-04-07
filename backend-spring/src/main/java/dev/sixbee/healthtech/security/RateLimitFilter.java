package dev.sixbee.healthtech.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window, in-memory rate limiter. Ports the NestJS
 * {@code @nestjs/throttler} configuration from
 * backend/src/app.module.ts:
 *
 * <ul>
 *   <li>Global: 100 requests per IP per 60-second window</li>
 *   <li>Login: 5 requests per IP per 60-second window (applied to
 *       POST /auth/login instead of the global limit — not on top
 *       of it, so the two don't double-count)</li>
 * </ul>
 *
 * Limits are read from env vars so tests can override them. Mirrors
 * the NestJS env var names:
 * <ul>
 *   <li>{@code THROTTLE_LIMIT} / {@code THROTTLE_TTL_MS}</li>
 *   <li>{@code LOGIN_THROTTLE_LIMIT} / {@code LOGIN_THROTTLE_TTL_MS}</li>
 * </ul>
 *
 * Client IP is extracted from the X-Forwarded-For header (first
 * value) if present, otherwise from {@code request.getRemoteAddr()}.
 * This matches the NestJS {@code app.set('trust proxy', 1)} fix
 * that was applied in the security audit.
 *
 * <p><b>Limitations:</b> This is an in-memory limiter and so does not
 * coordinate across instances in a horizontally scaled deployment
 * (each instance has its own counter). The NestJS throttler has the
 * same limitation. For production, swap the storage for Redis or
 * another shared store; the API of this filter is deliberately
 * minimal so that swap is localised.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /**
     * Path suffix of the login endpoint. We use endsWith rather than
     * equals because the request URI may or may not carry the
     * {@code /api} context path depending on how the servlet
     * container is configured — production adds it, MockMvc strips
     * it. Matching on the suffix avoids that distinction.
     */
    private static final String LOGIN_PATH_SUFFIX = "/auth/login";

    private final int loginLimit;
    private final int globalLimit;
    private final long loginWindowMs;
    private final long globalWindowMs;
    private final ObjectMapper objectMapper;

    private final Map<String, Window> loginWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> globalWindows = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${app.throttle.login-limit:5}") int loginLimit,
            @Value("${app.throttle.global-limit:100}") int globalLimit,
            @Value("${app.throttle.login-window-ms:60000}") long loginWindowMs,
            @Value("${app.throttle.global-window-ms:60000}") long globalWindowMs,
            ObjectMapper objectMapper) {
        this.loginLimit = loginLimit;
        this.globalLimit = globalLimit;
        this.loginWindowMs = loginWindowMs;
        this.globalWindowMs = globalWindowMs;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String ip = extractClientIp(request);
        boolean isLogin = isLoginRequest(request);

        // The NestJS throttler applies the login limit INSTEAD of the
        // global limit on POST /auth/login (SkipThrottle default +
        // @Throttle login). We do the same so the two don't
        // double-count a single login attempt.
        Map<String, Window> store = isLogin ? loginWindows : globalWindows;
        int limit = isLogin ? loginLimit : globalLimit;
        long windowMs = isLogin ? loginWindowMs : globalWindowMs;

        Window window = store.computeIfAbsent(ip, k -> new Window());
        if (!window.tryAcquire(limit, windowMs)) {
            log.warn("Rate limit exceeded for IP {} on {} (limit {}/{}ms)",
                    ip, request.getRequestURI(), limit, windowMs);
            writeTooManyRequests(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isLoginRequest(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri != null && uri.endsWith(LOGIN_PATH_SUFFIX);
    }

    /**
     * Returns the real client IP, trusting one proxy hop. Matches
     * {@code app.set('trust proxy', 1)} in the NestJS main.ts.
     * If X-Forwarded-For has multiple values (comma-separated), we
     * take the first (leftmost, which is the original client).
     */
    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(429); // HTTP 429 Too Many Requests (not a constant in jakarta.servlet)
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = Map.of(
                "statusCode", 429,
                "message", List.of("ThrottlerException: Too Many Requests"),
                "error", "Too Many Requests"
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }

    /**
     * Exposed for tests — clears the in-memory counters so each test
     * can start from a clean state without having to wait for the
     * window to expire.
     */
    public void reset() {
        loginWindows.clear();
        globalWindows.clear();
    }

    /**
     * Fixed-window counter. Thread-safe via synchronized methods.
     * For a small (per-IP) set of counters this is cheaper than the
     * alternatives (AtomicLong pair with CAS loop, striped locks).
     */
    static final class Window {
        private long windowStart;
        private int count;

        synchronized boolean tryAcquire(int limit, long windowMs) {
            long now = System.currentTimeMillis();
            if (now - windowStart >= windowMs) {
                windowStart = now;
                count = 0;
            }
            if (count >= limit) {
                return false;
            }
            count++;
            return true;
        }
    }
}
