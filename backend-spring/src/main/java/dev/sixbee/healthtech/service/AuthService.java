package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.dto.LoginResponse;
import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AdminUserRepository adminUserRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(AdminUserRepository adminUserRepository, JwtService jwtService) {
        this.adminUserRepository = adminUserRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = new BCryptPasswordEncoder(10);
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
