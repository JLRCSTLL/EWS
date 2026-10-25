# TANOVIQ Command Center for Windows

An installable Windows 10/11 x64 command-center client. It opens the existing
TANOVIQ web application at `https://ews-kappa.vercel.app/` in a dedicated,
sandboxed desktop window. The website uses the same shared API and database as
the Android app. This is an online client; it does not install a second server or
database and does not provide offline broadcasts.

## Install and use

1. Run `TANOVIQ-Command-Center-Setup-1.1.0-x64.exe`. The assisted installer installs
   for your Windows user and offers Start menu and desktop shortcuts.
2. Open **TANOVIQ Command Center**. The logo screen remains visible while the
   command interface loads. A connection failure shows a retry screen and retries
   every 15 seconds.
3. Select **Personnel**, then sign in with your existing TANOVIQ account.
   New registrations still require operator/administrator approval. Installing
   this client does not grant command-center privileges.
4. Select **Live data** for connected operations. On-duty Android personnel with
   a successfully uploaded fix appear in the shared locations view. Use the
   existing geofence/group broadcast and recipient-review workflow.
5. Sign out from **Personnel** when leaving a shared workstation. Closing the
   window preserves the session until it expires or is revoked. The session is
   separate from your regular browser's session.

The **Portable** executable runs without an installer. Both editions store the
workstation profile under `%APPDATA%\TANOVIQ Command Center`; portable means
installation-free, not that credentials travel beside the executable.

The release is **not code-signed**, so Windows may show an unknown-publisher or
SmartScreen warning. No signing certificate is bundled. A production distributor
should sign future releases with its own certificate.

## Desktop controls

| Control | Action |
| --- | --- |
| F11 / toolbar corners icon | Enter or leave full screen |
| Escape | Leave desktop full screen |
| Ctrl+R / F5 / toolbar refresh | Reload the command center |
| Ctrl+Plus / Ctrl+Minus / Ctrl+0 | Interface zoom / reset |
| Alt | Reveal the native menu |
| View → Keep display awake | Opt in to preventing display sleep until app exit |
| Connection indicator | Recheck shared-service reachability |

Mouse-wheel and touchpad map zoom remain the web application's controls.
"Service connected" means the health endpoint is reachable; it is not evidence
of operator authorization, fresh GPS, alert receipt, or physical alarm playback.
The app does not remain running in the notification area after it is closed.
Phone background alarms still depend on the existing Android/FCM setup.

## Development and packaging

From the repository root, use Node.js 22.12+ (24 recommended):

```powershell
npm run desktop:install
npm run desktop:test
npm run desktop
npm run desktop:package
```

Outputs are in `desktop/release/`. The installer and portable build use Electron
45.0.0 and electron-builder 26.18.0 pinned in the desktop lockfile. Dependencies
are isolated from the web/server package. Electron's binary installation runs
explicitly during the desktop postinstall step.

To test a local server without touching production data:

```powershell
npm --prefix desktop start -- --dev-url http://127.0.0.1:5173
```

Start the existing API and web development servers separately. Only an unpackaged
source build accepts `--dev-url`, and only loopback HTTP addresses are allowed.
Installed executables always connect to the official HTTPS service.

The web interface updates through its normal deployment and reload process.
Electron/native changes require rebuilding and distributing a new desktop
installer; there is no automatic desktop updater in this release.

## Desktop security boundary

- The website is in a `WebContentsView` with sandbox and context isolation on,
  Node integration off, web security on, and **no preload or native bridge**.
- The local toolbar/splash uses an allowlisted custom protocol, restrictive CSP,
  and a small IPC command list. Main-process handlers verify the exact local
  shell and main frame before accepting commands.
- Remote navigation is limited to the command-center origin and route. Personnel
  links and other HTTPS links require confirmation before opening in the default
  browser. File, script, and OS-protocol links cannot launch through the app.
- Camera, microphone, geolocation, clipboard-read, screen capture, and device
  permissions are denied. Only notifications from the configured origin are
  eligible. Unsolicited downloads and popup windows are blocked.
- No database password, Firebase credential, bootstrap token, or operator
  credential is included in the package. Authorization remains on the server.

See [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security)
and the [NSIS installer documentation](https://www.electron.build/nsis/).

## Logo and splash

`assets/tanoviq-dark.png` is a dark-interface adaptation of the user-provided
**TANOVIQ Geospatial Radar Logo.png**, generated using the built-in image tool.
The source upload is unchanged. The final prompt asked for the same logo geometry
and TANOVIQ wordmark, a charcoal background, silver outlines and letters, and
preserved teal/orange accents, with clean edges and no extra symbols or text.
The Windows ICO contains scaled copies of this artwork. The splash animation is
CSS, supports reduced-motion preferences, and never shows an invented loading
percentage. It appears on startup, reload, and connection recovery.
