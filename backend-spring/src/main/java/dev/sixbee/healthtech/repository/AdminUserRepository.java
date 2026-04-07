package dev.sixbee.healthtech.repository;

import dev.sixbee.healthtech.entity.AdminUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminUserRepository extends JpaRepository<AdminUser, UUID> {

  Optional<AdminUser> findByEmail(String email);

  boolean existsByEmail(String email);
}
