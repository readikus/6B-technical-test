package dev.sixbee.healthtech.repository;

import dev.sixbee.healthtech.entity.Appointment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

  List<Appointment> findAllByOrderByCreatedAtDesc();
}
