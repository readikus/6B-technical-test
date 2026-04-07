package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.dto.LoginResponse;
import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    /**
     * Bcrypt cost factor. Matches the NestJS seed (L1 in the security
     * audit: bumped from 10 to 12). Because bcrypt hashes are
     * self-describing, existing hashes written at cost 10 still
     * verify correctly — the cost factor is only used for new writes.
     */
    private static final int BCRYPT_COST = 12;

    private final AdminUserRepository adminUserRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(AdminUserRepository adminUserRepository, JwtService jwtService) {
        this.adminUserRepository = adminUserRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = new BCryptPasswordEncoder(BCRYPT_COST);
    }

    public LoginResponse login(LoginRequest request) {
        AdminUser admin = adminUserRepository.findByEmail(request.email())
                .filter(a -> a.isActive() && passwordEncoder.matches(request.password(), a.getPassword()))
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        String token = jwtService.generateToken(admin.getId(), admin.getEmail());
        return new LoginResponse(token);
    }

    public static class UnauthorizedException extends RuntimeException {
        public UnauthorizedException(String message) {
            super(message);
        }
    }
}
