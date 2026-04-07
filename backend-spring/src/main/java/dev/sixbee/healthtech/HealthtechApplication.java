package dev.sixbee.healthtech;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/**
 * Excludes {@link UserDetailsServiceAutoConfiguration} because we
 * use a custom JWT-cookie auth scheme via {@code JwtAuthenticationFilter}
 * and have no need for Spring Security's default in-memory user.
 * Without this exclusion, Spring Boot would log a startup warning:
 *
 *   "Using generated security password: <random uuid>"
 *
 * which is alarming in production logs and easy to mistake for a
 * real backdoor.
 */
@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
public class HealthtechApplication {

    public static void main(String[] args) {
        SpringApplication.run(HealthtechApplication.class, args);
    }
}
