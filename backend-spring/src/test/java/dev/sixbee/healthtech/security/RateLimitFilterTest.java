package dev.sixbee.healthtech.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link RateLimitFilter} at the servlet level. Uses
 * MockHttpServletRequest so we can test IP extraction and per-path
 * bucket selection deterministically without spinning the full
 * Spring context.
 */
class RateLimitFilterTest {

    private static final int LOGIN_LIMIT = 3;
    private static final int GLOBAL_LIMIT = 5;
    private static final long WINDOW_MS = 60_000;

    private RateLimitFilter filter;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        filter = new RateLimitFilter(LOGIN_LIMIT, GLOBAL_LIMIT, WINDOW_MS, WINDOW_MS, objectMapper);
    }

    // ── Happy paths ──────────────────────────────────────────────────

    @Test
    void allowsRequestsUnderGlobalLimit() throws Exception {
        for (int i = 0; i < GLOBAL_LIMIT; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);
            filter.doFilter(getRequest("/appointments", "10.0.0.1"), response, chain);
            verify(chain, times(1)).doFilter(any(), any());
            assertEquals(200, response.getStatus());
        }
    }

    @Test
    void allowsLoginRequestsUnderLoginLimit() throws Exception {
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"), response, chain);
            verify(chain, times(1)).doFilter(any(), any());
            assertEquals(200, response.getStatus());
        }
    }

    // ── Block paths ──────────────────────────────────────────────────

    @Test
    void blocksSixthLoginAttemptFromSameIp() throws Exception {
        // Use up the login budget
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        // Next attempt should be blocked with 429
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(postRequest("/auth/login", "10.0.0.1"), response, chain);

        assertEquals(429, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
        // Body should contain a NestJS-style error shape
        assertTrue(response.getContentAsString().contains("Too Many Requests"));
    }

    @Test
    void blocksRequestsOverGlobalLimitOnNonLoginEndpoint() throws Exception {
        for (int i = 0; i < GLOBAL_LIMIT; i++) {
            filter.doFilter(getRequest("/appointments", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(getRequest("/appointments", "10.0.0.1"), response, chain);

        assertEquals(429, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    // ── Bucket isolation ─────────────────────────────────────────────

    @Test
    void differentIpsHaveIndependentBuckets() throws Exception {
        // IP A uses up its login budget
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        // IP B should still be allowed
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(postRequest("/auth/login", "10.0.0.2"), response, chain);

        assertEquals(200, response.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    void loginAndGlobalBucketsAreIndependent() throws Exception {
        // Use up the login budget (smaller: 3)
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        // The global budget is still untouched — non-login requests
        // from the same IP should still pass.
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(getRequest("/appointments", "10.0.0.1"), response, chain);

        assertEquals(200, response.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    void loginBucketDoesNotDoubleCountAgainstGlobal() throws Exception {
        // Critical contract: hitting /auth/login 3 times must NOT
        // consume 3 slots from the global budget too.
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        // We should still have GLOBAL_LIMIT (=5) slots left on the
        // non-login bucket, not 5 - 3 = 2.
        Map<Integer, Integer> statuses = new HashMap<>();
        for (int i = 0; i < GLOBAL_LIMIT; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(getRequest("/appointments", "10.0.0.1"), response, mock(FilterChain.class));
            statuses.merge(response.getStatus(), 1, Integer::sum);
        }
        assertEquals((Integer) GLOBAL_LIMIT, statuses.get(200));
    }

    // ── IP extraction ────────────────────────────────────────────────

    @Test
    void xForwardedForTakesPrecedenceOverRemoteAddr() throws Exception {
        // Simulate a load balancer forwarding the real client IP.
        MockHttpServletRequest request = postRequest("/auth/login", "127.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.45");

        // Fill the limit for the ORIGINAL client IP, not the proxy IP
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            MockHttpServletRequest r = postRequest("/auth/login", "127.0.0.1");
            r.addHeader("X-Forwarded-For", "203.0.113.45");
            filter.doFilter(r, new MockHttpServletResponse(), mock(FilterChain.class));
        }

        // The same proxy + same X-Forwarded-For should now hit 429
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, mock(FilterChain.class));
        assertEquals(429, response.getStatus());

        // But a different X-Forwarded-For (different real client)
        // through the same proxy should still pass
        MockHttpServletRequest otherClient = postRequest("/auth/login", "127.0.0.1");
        otherClient.addHeader("X-Forwarded-For", "198.51.100.10");
        MockHttpServletResponse otherResponse = new MockHttpServletResponse();
        filter.doFilter(otherClient, otherResponse, mock(FilterChain.class));
        assertNotEquals(429, otherResponse.getStatus());
    }

    @Test
    void xForwardedForWithMultipleValuesUsesFirstEntry() throws Exception {
        MockHttpServletRequest request = postRequest("/auth/login", "127.0.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.45, 198.51.100.10, 192.0.2.1");

        // Fill the limit
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            MockHttpServletRequest r = postRequest("/auth/login", "127.0.0.1");
            r.addHeader("X-Forwarded-For", "203.0.113.45, 198.51.100.10, 192.0.2.1");
            filter.doFilter(r, new MockHttpServletResponse(), mock(FilterChain.class));
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, mock(FilterChain.class));
        assertEquals(429, response.getStatus());

        // If only the FIRST X-F-F is the bucket key, a request with
        // the same chain except a different leading IP should pass.
        MockHttpServletRequest other = postRequest("/auth/login", "127.0.0.1");
        other.addHeader("X-Forwarded-For", "198.51.100.10, 203.0.113.45");
        MockHttpServletResponse otherResponse = new MockHttpServletResponse();
        filter.doFilter(other, otherResponse, mock(FilterChain.class));
        assertNotEquals(429, otherResponse.getStatus());
    }

    // ── Reset ────────────────────────────────────────────────────────

    @Test
    void resetClearsAllCounters() throws Exception {
        // Use up both budgets
        for (int i = 0; i < LOGIN_LIMIT; i++) {
            filter.doFilter(postRequest("/auth/login", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }
        for (int i = 0; i < GLOBAL_LIMIT; i++) {
            filter.doFilter(getRequest("/appointments", "10.0.0.1"),
                    new MockHttpServletResponse(), mock(FilterChain.class));
        }

        filter.reset();

        // After reset, fresh budgets
        MockHttpServletResponse loginResponse = new MockHttpServletResponse();
        filter.doFilter(postRequest("/auth/login", "10.0.0.1"), loginResponse, mock(FilterChain.class));
        assertEquals(200, loginResponse.getStatus());

        MockHttpServletResponse globalResponse = new MockHttpServletResponse();
        filter.doFilter(getRequest("/appointments", "10.0.0.1"), globalResponse, mock(FilterChain.class));
        assertEquals(200, globalResponse.getStatus());
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private MockHttpServletRequest postRequest(String servletPath, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("POST");
        request.setServletPath(servletPath);
        request.setRequestURI(servletPath);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletRequest getRequest(String servletPath, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setServletPath(servletPath);
        request.setRequestURI(servletPath);
        request.setRemoteAddr(remoteAddr);
        return request;
    }
}
