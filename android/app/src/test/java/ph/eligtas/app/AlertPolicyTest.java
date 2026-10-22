package ph.eligtas.app;

import org.junit.Test;
import java.util.Set;
import java.time.Instant;
import static org.junit.Assert.*;

public class AlertPolicyTest {
    private final String id = "10000000-0000-4000-8000-000000000001";
    private final long now = Instant.parse("2026-10-22T08:00:00Z").toEpochMilli();
    @Test public void acceptsFreshAlertForSignedInResident() { assertTrue(AlertPolicy.eligible(id,"resident-a","resident-a","2026-10-22T07:59:59Z",now,Set.of())); }
    @Test public void rejectsAccountSwitchLogoutAndDuplicate() {
        assertFalse(AlertPolicy.eligible(id,"resident-a","resident-b","2026-10-22T08:00:00Z",now,Set.of()));
        assertFalse(AlertPolicy.eligible(id,"resident-a","","2026-10-22T08:00:00Z",now,Set.of()));
        assertFalse(AlertPolicy.eligible(id,"resident-a","resident-a","2026-10-22T08:00:00Z",now,Set.of(id)));
    }
    @Test public void delayedOrMalformedPushCannotTriggerAnAlarm() {
        assertFalse(AlertPolicy.eligible(id,"a","a","2026-10-22T07:54:59Z",now,Set.of()));
        assertFalse(AlertPolicy.eligible(id,"a","a","2026-10-23T08:00:00Z",now,Set.of()));
        assertFalse(AlertPolicy.eligible(id,"a","a","invalid",now,Set.of()));
    }
    @Test public void announcementsDoNotRequestUrgentBackgroundAlarm() { assertFalse(AlertPolicy.urgent("normal")); assertTrue(AlertPolicy.urgent("high")); assertTrue(AlertPolicy.urgent("critical")); }
    @Test public void aRoutineUpdateCannotInterruptAnEmergencyAlarm() { assertFalse(AlertPolicy.mayInterrupt("normal","critical")); assertFalse(AlertPolicy.mayInterrupt("high","critical")); assertTrue(AlertPolicy.mayInterrupt("critical","high")); assertTrue(AlertPolicy.mayInterrupt("normal","")); }
}
