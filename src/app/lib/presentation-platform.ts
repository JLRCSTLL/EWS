// The desktop WebContentsView retains Electron's default user agent. This also
// works in already-installed clients, without exposing an IPC bridge to the site.
// This is presentation gating, not an authorization or security boundary.
export function canUseWebDemo(userAgent: string) {
  return !/\bElectron\/|\bTANOVIQDesktop\//i.test(userAgent);
}
