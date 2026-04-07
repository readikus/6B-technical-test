package dev.sixbee.healthtech.repository;

import dev.sixbee.healthtech.entity.AuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

  List<AuditLog> findByAppointmentIdOrderByCreatedAtDesc(UUID appointmentId);
}
