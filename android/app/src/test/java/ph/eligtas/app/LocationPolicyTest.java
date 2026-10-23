package ph.eligtas.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class LocationPolicyTest {
    @Test public void doesNotReplayCachedFixesAsLive() {
        assertFalse(LocationPolicy.fresh(100000,60000));
        assertFalse(LocationPolicy.fresh(100000,100001));
        assertFalse(LocationPolicy.shouldUpload(100000,99900,99900,90000));
    }
    @Test public void streamsFreshFixesEachSecondAndRetriesLatestFix() {
        assertTrue(LocationPolicy.shouldUpload(100000,99900,95000,99000));
        assertFalse(LocationPolicy.shouldUpload(100000,99900,95000,99500));
        assertTrue(LocationPolicy.shouldUpload(101000,99900,95000,100000));
        assertFalse(LocationPolicy.shouldUpload(140000,99900,95000,100000));
    }
}
