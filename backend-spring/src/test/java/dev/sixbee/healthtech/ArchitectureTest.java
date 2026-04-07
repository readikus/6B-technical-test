package dev.sixbee.healthtech;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

/**
 * Architectural rules enforced as JUnit 5 tests via ArchUnit. These rules are intentionally
 * coarse-grained — they codify the layering that the current codebase follows, so future refactors
 * cannot silently regress it.
 *
 * <p>Layers (outer → inner):
 *
 * <ol>
 *   <li>controller — HTTP boundary
 *   <li>service — business logic
 *   <li>repository — database access (Spring Data JPA)
 *   <li>entity — JPA entities
 *   <li>dto — transport shapes
 * </ol>
 *
 * <p>The rules catch accidental reverse dependencies (e.g. an entity importing a controller), raw
 * HTTP usage in services, and cyclic package dependencies.
 */
class ArchitectureTest {

  private static final String BASE_PACKAGE = "dev.sixbee.healthtech";

  private static final JavaClasses PRODUCTION_CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .importPackages(BASE_PACKAGE);

  // ── Layering ─────────────────────────────────────────────────────

  @Test
  void controllersMustNotBeAccessedFromServicesOrRepositories() {
    ArchRule rule =
        noClasses()
            .that()
            .resideInAnyPackage("..service..", "..repository..", "..entity..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..controller..");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void entitiesMustNotDependOnServicesOrControllers() {
    ArchRule rule =
        noClasses()
            .that()
            .resideInAPackage("..entity..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("..service..", "..controller..");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void repositoriesMustNotDependOnControllersOrServices() {
    ArchRule rule =
        noClasses()
            .that()
            .resideInAPackage("..repository..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("..controller..", "..service..");
    rule.check(PRODUCTION_CLASSES);
  }

  @Test
  void servicesMustNotUseHttpServletTypes() {
    // Business logic should not reach into the servlet API directly.
    // Request/response handling belongs in the controller layer;
    // audit context flows through AuditContext records instead.
    ArchRule rule =
        noClasses()
            .that()
            .resideInAPackage("..service..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("jakarta.servlet..", "jakarta.servlet.http..");
    rule.check(PRODUCTION_CLASSES);
  }

  // ── Naming ───────────────────────────────────────────────────────

  @Test
  void controllerClassesMustBeNamedController() {
    classes()
        .that()
        .resideInAPackage("..controller..")
        .and()
        .areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
        .should()
        .haveSimpleNameEndingWith("Controller")
        .check(PRODUCTION_CLASSES);
  }

  @Test
  void serviceClassesMustBeNamedServiceOrEndWithKnownSuffix() {
    // @Service classes should have a descriptive suffix: Service,
    // Broadcaster, Runner, etc. This catches things like
    // @Service public class DoStuff — too generic for review.
    classes()
        .that()
        .resideInAPackage("..service..")
        .and()
        .areAnnotatedWith(org.springframework.stereotype.Service.class)
        .should()
        .haveSimpleNameEndingWith("Service")
        .check(PRODUCTION_CLASSES);
  }

  @Test
  void repositoryClassesMustBeNamedRepository() {
    classes()
        .that()
        .resideInAPackage("..repository..")
        .should()
        .haveSimpleNameEndingWith("Repository")
        .check(PRODUCTION_CLASSES);
  }

  // ── No cycles ────────────────────────────────────────────────────

  @Test
  void packagesMustBeFreeOfCycles() {
    slices().matching(BASE_PACKAGE + ".(*)..").should().beFreeOfCycles().check(PRODUCTION_CLASSES);
  }

  // ── No leaks ─────────────────────────────────────────────────────

  @Test
  void dtoPackageMustNotDependOnRepository() {
    // DTOs can hold static factory methods that convert from
    // entities (AppointmentResponse.from(Appointment)), but they
    // must never reach into the repository layer directly —
    // that would collapse the service-layer abstraction.
    ArchRule rule =
        noClasses()
            .that()
            .resideInAPackage("..dto..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..repository..");
    rule.check(PRODUCTION_CLASSES);
  }
}
