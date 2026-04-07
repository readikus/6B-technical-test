package dev.sixbee.healthtech.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.security.AuthCookie;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end integration test for the cookie-auth flow. Boots the full Spring context (SeedRunner,
 * SecurityFilterChain, JwtAuthenticationFilter, AuthController, AuthService) against H2 so the real
 * filter chain is exercised.
 *
 * <p>Covers the parity contract with NestJS:
 *
 * <ul>
 *   <li>POST /auth/login returns HTTP 200 with {ok:true}
 *   <li>Login sets Set-Cookie: admin_token=...; HttpOnly; SameSite=Strict
 *   <li>GET /auth/me returns {id,email} when cookie is sent
 *   <li>GET /auth/me returns 401 without cookie
 *   <li>GET /appointments (list-all) returns 401 without cookie — this would have silently passed
 *       before the SecurityConfig matcher fix
 *   <li>POST /auth/logout returns 200 and clears the cookie
 *   <li>POST /auth/logout returns 401 without auth
 *   <li>Logout cookie overwrites with Max-Age=0
 * </ul>
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthControllerIntegrationTest {

  // Must match application-test.yml
  private static final String ADMIN_EMAIL = "admin@test.com";
  private static final String ADMIN_PASSWORD = "T3st!Password123";

  @Autowired private WebApplicationContext context;

  @Autowired private ObjectMapper objectMapper;

  private MockMvc mockMvc;

  @org.junit.jupiter.api.BeforeEach
  void setUp() {
    // apply(springSecurity()) installs the real SecurityFilterChain
    // so @SpringBootTest MockMvc exercises JwtAuthenticationFilter
    // and SecurityConfig — not just the controller in isolation.
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  private Cookie loginAndGetCookie() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsBytes(
                            new LoginRequest(ADMIN_EMAIL, ADMIN_PASSWORD))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andExpect(cookie().exists(AuthCookie.COOKIE_NAME))
            .andExpect(cookie().httpOnly(AuthCookie.COOKIE_NAME, true))
            .andReturn();
    Cookie cookie = result.getResponse().getCookie(AuthCookie.COOKIE_NAME);
    assertNotNull(cookie);
    return cookie;
  }

  @Test
  void loginReturns200WithOkBodyAndSetsAdminTokenCookie() throws Exception {
    Cookie cookie = loginAndGetCookie();
    assertEquals("admin_token", cookie.getName());
    assertNotNull(cookie.getValue());
    assertFalse(cookie.getValue().isEmpty());
    // 3 JWT segments separated by dots
    assertEquals(3, cookie.getValue().split("\\.").length);
  }

  @Test
  void loginSetCookieHeaderContainsSameSiteStrict() throws Exception {
    // MockMvc's cookie matchers don't know about SameSite — it's
    // an HTTP/1.1 attribute not in the old Cookie spec. We verify
    // it from the raw Set-Cookie header.
    mockMvc
        .perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsBytes(new LoginRequest(ADMIN_EMAIL, ADMIN_PASSWORD))))
        .andExpect(status().isOk())
        .andExpect(
            header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=Strict")))
        .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly")))
        .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Path=/")))
        .andExpect(
            header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=28800")));
  }

  @Test
  void loginWithWrongPasswordReturns401AndNoCookie() throws Exception {
    mockMvc
        .perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    objectMapper.writeValueAsBytes(
                        new LoginRequest(ADMIN_EMAIL, "wrong-password"))))
        .andExpect(status().isUnauthorized())
        .andExpect(cookie().doesNotExist(AuthCookie.COOKIE_NAME));
  }

  @Test
  void meReturnsPrincipalWhenAuthenticatedViaCookie() throws Exception {
    Cookie cookie = loginAndGetCookie();
    mockMvc
        .perform(get("/auth/me").cookie(cookie))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(ADMIN_EMAIL))
        .andExpect(jsonPath("$.id").exists());
  }

  @Test
  void meReturns401WithoutAnyAuth() throws Exception {
    mockMvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void listAppointmentsReturns401WithoutAuth() throws Exception {
    // Regression test for the SecurityConfig matcher bug: before
    // the fix, .requestMatchers("POST", "/appointments")
    // exposed GET /appointments (the list-all PII endpoint)
    // to unauthenticated users. This MUST 401 now.
    mockMvc.perform(get("/appointments")).andExpect(status().isUnauthorized());
  }

  @Test
  void publicBookingEndpointStillWorksWithoutAuth() throws Exception {
    // Posting a new appointment as a patient is still public —
    // this is the single intentional anonymous endpoint.
    // We don't care about the response body here (validation may
    // reject the empty body); we care that the auth layer lets
    // it through. 400 is fine, 401 would be a regression.
    int status =
        mockMvc
            .perform(post("/appointments").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andReturn()
            .getResponse()
            .getStatus();
    assertTrue(
        status != 401 && status != 403,
        "POST /appointments should not require auth but got " + status);
  }

  @Test
  void logoutRequiresAuthentication() throws Exception {
    // M3: logout must require auth. Anonymous logout used to
    // succeed in the NestJS backend before the audit.
    mockMvc.perform(post("/auth/logout")).andExpect(status().isUnauthorized());
  }

  @Test
  void logoutClearsCookieAndReturnsOk() throws Exception {
    Cookie loginCookie = loginAndGetCookie();

    MvcResult result =
        mockMvc
            .perform(post("/auth/logout").cookie(loginCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andReturn();

    Cookie cleared = result.getResponse().getCookie(AuthCookie.COOKIE_NAME);
    assertNotNull(cleared);
    assertEquals("", cleared.getValue());
    assertEquals(0, cleared.getMaxAge(), "Clear cookie must have Max-Age=0");
  }

  @Test
  void logoutSetCookieHeaderPreservesSecurityAttributes() throws Exception {
    Cookie loginCookie = loginAndGetCookie();
    mockMvc
        .perform(post("/auth/logout").cookie(loginCookie))
        .andExpect(status().isOk())
        .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly")))
        .andExpect(
            header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=Strict")))
        .andExpect(
            header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
  }

  @Test
  void loginThenListAppointmentsWithCookieSucceeds() throws Exception {
    Cookie cookie = loginAndGetCookie();
    mockMvc.perform(get("/appointments").cookie(cookie)).andExpect(status().isOk());
  }
}
