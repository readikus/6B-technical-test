package dev.sixbee.healthtech.config;

import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final AdminUserRepository adminUserRepository;
    private final String adminEmail;
    private final String adminPassword;

    public SeedRunner(
            AdminUserRepository adminUserRepository,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password}") String adminPassword) {
        this.adminUserRepository = adminUserRepository;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(String... args) {
        if (adminUserRepository.existsByEmail(adminEmail)) {
            log.info("Admin user already exists: {}", adminEmail);
            return;
        }

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
        AdminUser admin = new AdminUser();
        admin.setEmail(adminEmail);
        admin.setPassword(encoder.encode(adminPassword));
        adminUserRepository.save(admin);
        log.info("Admin user seeded: {}", adminEmail);
    }
}
