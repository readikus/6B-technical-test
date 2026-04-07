package dev.sixbee.healthtech.security;

import dev.sixbee.healthtech.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Exercises the token-extraction precedence rules of
 * {@link JwtAuthenticationFilter}, the core of the cookie-auth
 * migration. Cookie must take precedence over header so the
 * NestJS-equivalent guard behaviour is preserved exactly.
 */
class JwtAuthenticationFilterTest {

    private static final String VALID_SECRET = "test-jwt-secret-that-is-long-enough-for-hmac";

    private JwtService jwtService;
    private JwtAuthenticationFilter filter;
    private String validTokenA;
    private String validTokenB;
    private UUID idA;
    private UUID idB;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(VALID_SECRET, 28800000);
        filter = new JwtAuthenticationFilter(jwtService);
        idA = UUID.randomUUID();
        idB = UUID.randomUUID();
        validTokenA = jwtService.generateToken(idA, "a@test.com");
        validTokenB = jwtService.generateToken(idB, "b@test.com");
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesFromCookieOnly() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AuthCookie.COOKIE_NAME, validTokenA));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        JwtPrincipal principal = assertInstanceOf(JwtPrincipal.class, auth.getPrincipal());
        assertEquals(idA.toString(), principal.id());
        assertEquals("a@test.com", principal.email());
    }

    @Test
    void authenticatesFromAuthorizationHeaderOnly() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + validTokenA);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(idA.toString(),
                ((JwtPrincipal) auth.getPrincipal()).id());
    }

    @Test
    void cookieTakesPrecedenceOverHeader() throws Exception {
        // Critical contract: if both are present, cookie wins. This
        // mirrors backend/src/auth/jwt-auth.guard.ts:
        //   const token = cookieToken ?? headerToken;
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AuthCookie.COOKIE_NAME, validTokenA));
        request.addHeader("Authorization", "Bearer " + validTokenB);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        assertEquals(idA.toString(), principal.id(), "Cookie token A should have won over header token B");
    }

    @Test
    void doesNothingWhenNoTokenPresent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void doesNothingWhenTokenIsInvalid() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AuthCookie.COOKIE_NAME, "not-a-real-jwt"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void ignoresEmptyCookieAndFallsBackToHeader() throws Exception {
        // A cleared cookie (logout) has empty value. The filter must
        // ignore it and fall through to the header so API-direct
        // clients without cookies still work.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AuthCookie.COOKIE_NAME, ""));
        request.addHeader("Authorization", "Bearer " + validTokenB);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(idB.toString(), ((JwtPrincipal) auth.getPrincipal()).id());
    }

    @Test
    void ignoresOtherCookies() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(
                new Cookie("unrelated", "whatever"),
                new Cookie(AuthCookie.COOKIE_NAME, validTokenA),
                new Cookie("another", "ignored")
        );
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertEquals(idA.toString(), ((JwtPrincipal) auth.getPrincipal()).id());
    }
}
