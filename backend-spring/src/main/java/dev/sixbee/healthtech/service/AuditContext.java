package dev.sixbee.healthtech.service;

import java.util.UUID;

/**
 * Per-request context passed from the controller layer into the
 * audit log. Carries the identity (admin user), origin (IP), and
 * device (user agent) of whoever triggered the audited action.
 *
 * Mirrors the NestJS {@code AuditContext} interface in
 * backend/src/audit/audit.events.ts. All fields are optional
 * because:
 * <ul>
 *   <li>adminUserId is null for the public booking endpoint
 *       (POST /appointments with no auth)</li>
 *   <li>ipAddress and userAgent can be null in headless test
 *       scenarios, and we don't want tests to fail hard if
 *       HttpServletRequest returns null for either</li>
 * </ul>
 */
public record AuditContext(
        UUID adminUserId,
        String ipAddress,
        String userAgent
) {
    /** Empty context — used when no request information is available. */
    public static final AuditContext EMPTY = new AuditContext(null, null, null);

    /** Convenience for anonymous callers (e.g. public booking). */
    public static AuditContext anonymous(String ipAddress, String userAgent) {
        return new AuditContext(null, ipAddress, userAgent);
    }
}
