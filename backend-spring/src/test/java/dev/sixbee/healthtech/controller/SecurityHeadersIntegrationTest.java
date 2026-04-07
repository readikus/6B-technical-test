package dev.sixbee.healthtech.controller;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Locks in the defence-in-depth HTTP headers the NestJS audit applied via Helmet (M5). Spring Boot
 * must emit the same CSP, Cross-Origin-Resource-Policy, and Referrer-Policy so a browser talking to
 * either backend gets the same security posture.
 *
 * <p>The API only ever serves JSON, so {@code default-src 'none'} is correct — it costs nothing and
 * provides a free second line of defence against reflected XSS.
 */
@SpringBootTest
@ActiveProfiles("test")
class SecurityHeadersIntegrationTest {

  @Autowired private WebApplicationContext context;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void emitsStrictContentSecurityPolicyOnPublicEndpoint() throws Exception {
    mockMvc
        .perform(get("/health"))
        .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
        .andExpect(header().string("Content-Security-Policy", containsString("base-uri 'none'")))
        .andExpect(
            header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")))
        .andExpect(
            header().string("Content-Security-Policy", containsString("form-action 'none'")));
  }

  @Test
  void emitsCrossOriginResourcePolicySameSite() throws Exception {
    mockMvc
        .perform(get("/health"))
        .andExpect(header().string("Cross-Origin-Resource-Policy", "same-site"));
  }

  @Test
  void emitsReferrerPolicyNoReferrer() throws Exception {
    mockMvc.perform(get("/health")).andExpect(header().string("Referrer-Policy", "no-referrer"));
  }

  @Test
  void emitsSpringSecurityDefaultHeaders() throws Exception {
    // Spring Security ships these by default. They match the
    // Helmet defaults that the NestJS security audit noted as
    // "good baseline headers (I1)" — no override needed, but
    // we still lock the contract to catch regressions if
    // someone disables them in a later config pass.
    mockMvc
        .perform(get("/health"))
        .andExpect(header().string("X-Content-Type-Options", "nosniff"))
        .andExpect(header().exists("X-Frame-Options"));
  }

  @Test
  void emitsCspOnAuthenticatedEndpoint() throws Exception {
    // Even on 401 responses the headers must be emitted — a
    // missing CSP on the login page is a defence-in-depth hole.
    mockMvc
        .perform(get("/appointments"))
        .andExpect(
            header().string("Content-Security-Policy", containsString("default-src 'none'")));
  }

  @Test
  void cspExactlyMatchesNestjsHelmetConfig() throws Exception {
    // Byte-level parity: the full policy string must match
    // what the NestJS backend/src/security-config.ts produces.
    // If either side changes, load-balanced browsers will see
    // different CSPs depending on which backend they hit.
    mockMvc
        .perform(get("/health"))
        .andExpect(
            header()
                .string(
                    "Content-Security-Policy",
                    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"));
  }
}
