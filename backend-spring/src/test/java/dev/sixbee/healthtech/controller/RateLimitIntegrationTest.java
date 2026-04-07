package dev.sixbee.healthtech.controller;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.security.RateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Exercises the real filter chain with tight rate limits to verify H2: login endpoint rate
 * limiting, global fallback, and that the 429 response shape matches the NestJS throttler output.
 *
 * <p>Overrides the test-default throttle limits via @TestPropertySource so this file can hit the
 * 429 behaviour without affecting the other integration tests, which rely on the generous default
 * in application-test.yml.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(
    properties = {
      "app.throttle.login-limit=5",
      "app.throttle.global-limit=10",
      "app.throttle.login-window-ms=60000",
      "app.throttle.global-window-ms=60000"
    })
class RateLimitIntegrationTest {

  private static final String ADMIN_EMAIL = "admin@test.com";
  private static final String ADMIN_PASSWORD = "T3st!Password123";

  @Autowired private WebApplicationContext context;

  @Autowired private ObjectMapper objectMapper;

  @Autowired private RateLimitFilter rateLimitFilter;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    // Clean slate for every test — otherwise tests would leak
    // counters into each other and fail in random order.
    rateLimitFilter.reset();
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void loginThrottlesAfterFiveAttemptsReturns429() throws Exception {
    // First 5 login attempts should pass through the filter (and
    // likely fail with 401 because we'll deliberately use a bad
    // password — but we're only checking the throttle here, so
    // the important thing is they're NOT 429).
    byte[] badPayload =
        objectMapper.writeValueAsBytes(new LoginRequest(ADMIN_EMAIL, "wrong-password"));
    for (int i = 1; i <= 5; i++) {
      int status =
          mockMvc
              .perform(
                  post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(badPayload))
              .andReturn()
              .getResponse()
              .getStatus();
      if (status == 429) {
        throw new AssertionError("Request " + i + " should not be throttled (limit is 5)");
      }
    }

    // 6th attempt hits the login limit
    mockMvc
        .perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(badPayload))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.statusCode").value(429))
        .andExpect(jsonPath("$.error").value("Too Many Requests"));
  }

  @Test
  void successfulLoginStillCountsAgainstTheLimit() throws Exception {
    // A correct password should pass auth — but the rate limit
    // ticks *before* auth, so the 6th attempt is still blocked
    // regardless of whether the first 5 succeeded.
    byte[] goodPayload =
        objectMapper.writeValueAsBytes(new LoginRequest(ADMIN_EMAIL, ADMIN_PASSWORD));
    for (int i = 0; i < 5; i++) {
      mockMvc
          .perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(goodPayload))
          .andExpect(status().isOk());
    }

    mockMvc
        .perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(goodPayload))
        .andExpect(status().isTooManyRequests());
  }

  @Test
  void throttleReturnsNestjsCompatibleErrorBody() throws Exception {
    byte[] badPayload = objectMapper.writeValueAsBytes(new LoginRequest(ADMIN_EMAIL, "x"));
    for (int i = 0; i < 5; i++) {
      mockMvc.perform(
          post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(badPayload));
    }

    mockMvc
        .perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(badPayload))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.statusCode").value(429))
        .andExpect(jsonPath("$.message[0]").exists())
        .andExpect(jsonPath("$.error").value("Too Many Requests"));
  }

  @Test
  void loginThrottleDoesNotBlockUnrelatedEndpoints() throws Exception {
    // Burn the login budget
    byte[] badPayload = objectMapper.writeValueAsBytes(new LoginRequest(ADMIN_EMAIL, "x"));
    for (int i = 0; i < 6; i++) {
      mockMvc.perform(
          post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(badPayload));
    }

    // The public booking endpoint and health check should still
    // be reachable — they use the global limit (10), which we
    // haven't consumed.
    int status = mockMvc.perform(get("/health")).andReturn().getResponse().getStatus();
    if (status == 429) {
      throw new AssertionError("GET /health should not be throttled by the login bucket");
    }
  }
}
