package ph.eligtas.app;

import java.time.Instant;
import java.util.Set;

/** Shared checks for foreground inbox arrivals and FCM delivery. */
final class AlertPolicy {
    static boolean urgent(String priority) { return "high".equals(priority) || "critical".equals(priority); }
    static boolean eligible(String id, String recipient, String boundUser, String createdAt, long now, Set<String> seen) {
        if (id == null || !id.matches("[0-9a-fA-F-]{36}") || boundUser.isEmpty() || !boundUser.equals(recipient) || seen.contains(id)) return false;
        try { long age = now - Instant.parse(createdAt).toEpochMilli(); return age >= -60000 && age <= 300000; }
        catch (RuntimeException invalid) { return false; }
    }
}
