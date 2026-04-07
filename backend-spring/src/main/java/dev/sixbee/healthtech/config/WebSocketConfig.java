package dev.sixbee.healthtech.config;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import dev.sixbee.healthtech.security.JwtCookieAuthListener;
import dev.sixbee.healthtech.service.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

/**
 * Configures the embedded netty-socketio server that provides
 * Socket.IO v4 wire-compatibility with the existing
 * {@code socket.io-client@4.8.3} frontend.
 *
 * <p>The server runs on its own port (default 3003) because
 * netty-socketio is its own netty-based HTTP/WebSocket server and
 * cannot share Tomcat's listening socket. The frontend is told
 * about this via {@code NEXT_PUBLIC_WEBSOCKET_URL} which defaults to
 * the API URL but can be pointed at the dedicated Socket.IO port
 * when running against Spring.
 *
 * <p>Authorisation happens at the handshake via
 * {@link JwtCookieAuthListener}, which mirrors the NestJS gateway
 * (backend/src/appointments/appointments.gateway.ts) and the C1 fix
 * from the security audit: connections without a valid admin_token
 * cookie are rejected before any broadcast can reach them.
 */
@org.springframework.context.annotation.Configuration
public class WebSocketConfig {

    @Bean
    public SocketIOServer socketIOServer(
            @Value("${app.websocket.host:0.0.0.0}") String host,
            @Value("${app.websocket.port:3003}") int port,
            @Value("${app.cors.origins}") String corsOrigins,
            JwtService jwtService) {

        Configuration config = new Configuration();
        config.setHostname(host);
        config.setPort(port);

        // netty-socketio's setOrigin takes a single string. The CORS
        // env var supports comma-separated values for the HTTP API,
        // but in dev there is realistically one origin. Take the
        // first entry — anything more elaborate would need a custom
        // origin matcher hooked into netty's CorsHandler.
        String firstOrigin = corsOrigins.split(",")[0].trim();
        config.setOrigin(firstOrigin);

        // Cookie auth at the WebSocket handshake — matches the
        // NestJS gateway's handleConnection check.
        config.setAuthorizationListener(new JwtCookieAuthListener(jwtService));

        return new SocketIOServer(config);
    }

    /**
     * SmartLifecycle hook that starts and stops the SocketIOServer
     * with the Spring context. Without this the server bean exists
     * but is never bound to a port, which silently breaks the
     * frontend connection without any error in the logs.
     *
     * <p>Gated on {@code app.websocket.enabled} (default true) so
     * tests that load multiple {@code @SpringBootTest} contexts in
     * the same JVM can disable the actual port-binding step.
     * Otherwise each cached context tries to bind the same port and
     * the second one fails with "Address already in use".
     */
    @Component
    @ConditionalOnProperty(
            name = "app.websocket.enabled",
            havingValue = "true",
            matchIfMissing = true
    )
    public static class SocketIOLifecycle implements SmartLifecycle {

        private static final Logger log = LoggerFactory.getLogger(SocketIOLifecycle.class);

        private final SocketIOServer server;
        private volatile boolean running = false;

        public SocketIOLifecycle(SocketIOServer server) {
            this.server = server;
        }

        @Override
        public void start() {
            if (running) return;
            server.start();
            running = true;
            log.info("Socket.IO server started on {}:{}",
                    server.getConfiguration().getHostname(),
                    server.getConfiguration().getPort());
        }

        @Override
        public void stop() {
            if (!running) return;
            server.stop();
            running = false;
            log.info("Socket.IO server stopped");
        }

        @Override
        public boolean isRunning() {
            return running;
        }

        /**
         * Run after the rest of the context is up so JwtService and
         * other deps are fully initialised. The default phase
         * (Integer.MAX_VALUE / 2) is fine.
         */
        @Override
        public int getPhase() {
            return SmartLifecycle.super.getPhase();
        }
    }
}
