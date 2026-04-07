package dev.sixbee.healthtech.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sixbee.healthtech.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final ObjectMapper objectMapper;
    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, ObjectMapper objectMapper, CorsConfigurationSource corsConfigurationSource) {
        this.jwtFilter = jwtFilter;
        this.objectMapper = objectMapper;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                // CSRF is disabled because the app uses an httpOnly
                // cookie with SameSite=Strict, which by itself blocks
                // cross-origin form submissions. For a deployment that
                // moves to SameSite=Lax (e.g. multi-domain), this
                // should be re-enabled with a double-submit token.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public booking endpoint: patients create
                        // appointments without an account. Listing,
                        // fetching, updating, and deleting all
                        // require auth via .anyRequest() below.
                        //
                        // Paths are servlet-relative: the server.servlet
                        // .context-path=/api is stripped by the servlet
                        // container before Spring Security sees the
                        // request. The previous config had TWO bugs:
                        // (1) requestMatchers("POST", "/api/..") treats
                        //     BOTH args as URL patterns, neither of
                        //     which ever matches, silently falling
                        //     through to .anyRequest().authenticated().
                        // (2) The /api prefix would not match even
                        //     with the right overload, because by
                        //     then the context path has been stripped.
                        // Symptom: SecurityConfig appeared to do
                        // nothing, and GET /appointments (list all
                        // PII) was NOT actually protected in isolation
                        // — but every request also needed auth, so
                        // login itself broke. Both bugs are fixed
                        // here: use HttpMethod explicitly, and use
                        // servlet-relative paths.
                        .requestMatchers(HttpMethod.POST, "/appointments").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex.authenticationEntryPoint(nestjsStyleEntryPoint()))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private AuthenticationEntryPoint nestjsStyleEntryPoint() {
        return (HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            Map<String, Object> body = Map.of(
                    "statusCode", 401,
                    "message", List.of("Unauthorized"),
                    "error", "Unauthorized"
            );
            objectMapper.writeValue(response.getOutputStream(), body);
        };
    }
}
