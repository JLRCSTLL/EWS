package ph.eligtas.app;

final class LocationPolicy {
    static final long UPDATE_MS = 1000, MAX_FIX_AGE_MS = 10000;
    static boolean fresh(long elapsedNow, long elapsedFix) {
        return elapsedFix > 0 && elapsedFix <= elapsedNow && elapsedNow - elapsedFix <= MAX_FIX_AGE_MS;
    }
    static boolean shouldUpload(long now, long fix, long previousFix, long previousAttempt) {
        return fresh(now,fix) && fix > previousFix && (previousAttempt == 0 || now - previousAttempt >= UPDATE_MS);
    }
}
