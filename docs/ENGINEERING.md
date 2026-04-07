# Engineering Quality — Spring Boot Backend

This document lists every quality-enforcement tool wired into the
Spring Boot backend (`backend-spring/`), what each one catches, how
to run it, and how to interpret and fix its output.

All tools run under Java 21+ and Maven 3.9+. The Maven wrapper
(`./mvnw`) is checked in — no host install required.

---

## Summary

| Category | Tool | In default build? | Goal |
|---|---|---|---|
| [Static analysis](#erroprone) | ErrorProne | yes (compile) | Catch real bugs at compile time |
| [Formatting](#spotless) | Spotless + google-java-format | yes (verify) | Enforce consistent formatting |
| [Coverage](#jacoco) | JaCoCo | yes (verify) | HTML coverage report |
| [Build hygiene](#enforcer) | Maven Enforcer | yes (validate) | Dep convergence, required versions |
| [Architecture](#archunit) | ArchUnit | yes (test) | Layering rules as JUnit tests |
| [Security — deps](#owasp) | OWASP Dependency-Check | opt-in | CVE scan vs NVD |
| [Mutation testing](#pitest) | Pitest | opt-in | Verify tests catch real bugs |
| [Observability](#actuator) | Spring Boot Actuator | runtime | `/actuator/health`, `/actuator/info` |

**Default build** = `./mvnw verify` runs all the non-opt-in tools,
plus the full test suite (111 tests at time of writing).

---

## ErrorProne {#erroprone}

Google's compile-time bug pattern detection. Runs as a javac plugin
during `compile`. Catches real mistakes (null deref, broken
equality, mutable record fields, ignored return values) without
the noise of pure style checkers.

**Run:** automatic on `./mvnw compile`.

**Known-good status:** zero findings as of this pass.

**If it flags something:**

1. Read the diagnostic — ErrorProne links to a doc page
   explaining the pattern and the fix.
2. Most fixes are one-line. The diagnostic message includes a
   suggested replacement.
3. If you disagree with the rule, suppress it narrowly:
   `@SuppressWarnings("BugPatternName")` on the specific method
   or field. **Avoid class-level or package-level suppressions** —
   they silently hide future instances.

**Java 25 gotcha:** ErrorProne needs JDK internal exports to reach
into `com.sun.tools.javac.*`. Those exports are declared in
`backend-spring/.mvn/jvm.config` so the Maven JVM itself has them
open. Without that file you get `IllegalAccessError` on compile.
If you upgrade Java and compile breaks, check that file first.

---

## Spotless + google-java-format {#spotless}

Consistent formatting enforced by Spotless using Google Java Format
(2-space indent, sorted imports, no trailing whitespace, file ends
with newline). Fails the build if any file drifts from the
formatter's output.

**Check:** `./mvnw spotless:check` (also runs in `verify`).

**Auto-fix:** `./mvnw spotless:apply` — rewrites every file in
place to conform.

**Developer workflow:** run `spotless:apply` before committing.
IDE plugins exist for IntelliJ and VS Code that do this on save.

**Version pin:** `google-java-format.version=1.28.0` in `pom.xml`.
Older versions crash on Java 25 with a javac API mismatch. If
you bump Java further, bump the formatter too.

---

## JaCoCo {#jacoco}

Line and branch coverage reports. The agent is wired into Surefire
via `<argLine>@{surefireArgLine} ...</argLine>` in the Surefire
config, so coverage is always measured during test runs.

**Run:** `./mvnw verify` (the `report` goal is bound to `verify`).

**Report location:** `backend-spring/target/site/jacoco/index.html`.
Open it in a browser to see per-package, per-class, per-method
coverage with highlighted source.

**No minimum enforced.** Coverage thresholds are deliberately not
set so a failing coverage number doesn't block a legitimate commit.
If you want to enforce one, add a `check` execution:

```xml
<execution>
    <id>jacoco-check</id>
    <goals><goal>check</goal></goals>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit>
                        <counter>LINE</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.80</minimum>
                    </limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</execution>
```

---

## Maven Enforcer {#enforcer}

Fails the build at the `validate` phase if any of these are wrong:

- **`requireJavaVersion`** — Java 21 or later. Bump is a config
  one-liner in `pom.xml`.
- **`requireMavenVersion`** — Maven 3.9 or later (the wrapper
  ships 3.9.9 so this is satisfied automatically).
- **`dependencyConvergence`** — same artifact cannot appear at
  two different versions anywhere in the dep tree. Catches
  accidental major-version bumps via transitive deps.
- **`requireUpperBoundDeps`** — a direct dep cannot pull in an
  older transitive version of itself. Catches
  "library A requires foo 1.0, library B requires foo 2.0, and
  Maven silently picks 1.0".

**Run:** automatic on every Maven phase.

**If it fails:** the error message names the offending artifact
and the two versions. Options:

1. **Pin in `<dependencyManagement>`** — the canonical fix.
2. **Exclude the older version** from whichever dep pulls it in.
3. **Remove the offender** if it's accidental.

Never disable the rule without understanding which version wins
at runtime — that's the whole point of having the enforcer.

---

## ArchUnit {#archunit}

Architectural rules codified as JUnit 5 tests. Runs in the normal
test phase, so a violation fails the build with a test report.

**Run:** `./mvnw test` (as part of the normal test suite).

**Test class:** `src/test/java/dev/sixbee/healthtech/ArchitectureTest.java`.

**Rules currently enforced (9 tests):**

1. Controllers cannot be accessed from services, repositories,
   or entities (no reverse dependencies into the HTTP layer).
2. Entities cannot depend on services or controllers.
3. Repositories cannot depend on controllers or services.
4. Services cannot use `jakarta.servlet.*` types — request/
   response handling belongs in the controller.
5. `@RestController` classes must be named `…Controller`.
6. `@Service` classes must be named `…Service`.
7. Classes in `..repository..` must be named `…Repository`.
8. All top-level packages must be free of cyclic dependencies.
9. DTOs must not depend on the repository package.

**Adding a rule:** add a new `@Test` method using the ArchUnit
fluent API. Prefer `noClasses().that()…should()` for
negative/banning rules and `classes().that()…should()` for
positive/naming rules.

**If a rule breaks on a legitimate refactor:** update the rule,
don't suppress it. The rule file is the architectural spec.

---

## OWASP Dependency-Check {#owasp}

Scans the dependency tree against the National Vulnerability
Database (NVD) and fails the build if any dep has a CVE at CVSS
>= 7.0 (High/Critical).

**Run:** `./mvnw org.owasp:dependency-check-maven:check`

**Opt-in** because the first run downloads ~500MB of NVD data and
takes several minutes. Subsequent runs use a local cache and
take seconds.

**Scope:** test dependencies are excluded (`skipTestScope=true`)
because test-only vulnerabilities don't reach production.

**Report location:** `backend-spring/target/dependency-check-report.html`
(HTML) and `.json` (machine-readable, for CI gates).

**If a finding lands:**

1. Check the CVE description — is the vulnerable code path even
   reachable from this application?
2. **Bump the dep** if a patched version exists (the usual fix).
3. **Suppress with justification** if the CVE is a false positive
   or unreachable — use `<suppressionFiles>` in the plugin
   config pointing at `dependency-check-suppressions.xml`.

**CI integration:** in production CI, schedule this weekly rather
than on every commit. The NVD doesn't add CVEs that fast.

---

## Pitest — Mutation Testing {#pitest}

Mutates the production code (flips conditionals, replaces
constants, deletes method calls) and re-runs the tests for each
mutation. If a mutation survives, the test suite is not actually
verifying that behaviour even if line coverage looks green.

**Run:** `./mvnw org.pitest:pitest-maven:mutationCoverage`

**Opt-in** because it is slow — it runs the test suite once per
mutation, so a 10-second suite becomes a 5-minute mutation run.

**Scope:** `dev.sixbee.healthtech.service.*` and
`dev.sixbee.healthtech.security.*` — the two packages where
coverage matters most (business logic + auth). Entities, DTOs,
and configs are excluded — they have little to mutate.

**Report location:** `backend-spring/target/pit-reports/<timestamp>/index.html`.
Browse it to see per-class mutation scores and the exact
mutations that survived.

**Action for a surviving mutation:** either add a test that
catches it (the preferred fix) or review whether the mutated
behaviour is actually meaningful (sometimes not, e.g.
overflow guards that are never hit in practice).

**Target score:** >80% killed is a strong suite, >90% is very
strong. Below 60% suggests the tests are shallow.

---

## Spring Boot Actuator {#actuator}

Production-readiness endpoints exposed at `/api/actuator/*`.

**Exposed endpoints** (allowlisted in `application.yml`):

- **`GET /api/actuator/health`** — liveness + readiness. Returns
  `{"status":"UP"}` when DB and app are healthy. Used by
  orchestrators (Kubernetes liveness/readiness probes, ECS
  health checks, load balancer target groups).
  - Detail level is `never` so health responses do not leak
    internal component names or DB hostnames.
- **`GET /api/actuator/info`** — static app metadata. Can include
  git commit, build timestamp, version number once the
  `git-commit-id-plugin` is wired in.

**Deliberately NOT exposed:** `heapdump`, `env`, `beans`,
`loggers`, `configprops`, `threaddump`, `metrics`. Each of these
leaks information an attacker can use — application internals,
secrets, live log level manipulation, etc. Add them to the
`management.endpoints.web.exposure.include` list only with good
reason and behind auth.

**Security:** `/actuator/health` and `/actuator/info` are listed
as `permitAll()` in `SecurityConfig` so orchestrators can probe
without credentials. Any future endpoint you add will be gated
by `.anyRequest().authenticated()` automatically.

---

## Running everything

```bash
# Default build: compile (ErrorProne), test (JaCoCo, ArchUnit),
# format check (Spotless), enforce (Enforcer).
./mvnw verify

# Auto-fix formatting drift before commit
./mvnw spotless:apply

# Opt-in: CVE scan (slow first run)
./mvnw org.owasp:dependency-check-maven:check

# Opt-in: mutation testing (slow)
./mvnw org.pitest:pitest-maven:mutationCoverage

# Generate coverage report (already ran during verify)
open target/site/jacoco/index.html
```

---

## Why these and not others

A few tools that were considered but not added:

- **SpotBugs** — largely overlaps with ErrorProne. ErrorProne's
  bug patterns are more modern and better documented, and it runs
  at compile time rather than post-compile bytecode analysis.
- **Checkstyle / PMD** — pure style tooling, mostly redundant
  with Spotless. Adding them doubles the number of things that
  can flag a line without catching bugs.
- **NullAway** — promising for null-safety enforcement, but needs
  per-package annotation to opt-in and generates a lot of findings
  on existing code. Good for a greenfield project, heavy for a
  port like this one.
- **Checkerframework** — full-blown gradual type system, way out
  of proportion for this codebase.
