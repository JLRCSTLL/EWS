# Repository credential review — 25 October 2026

**Result: no credential leaks detected in the scanned Git history or source
snapshot. GitHub reported no open secret-scanning alerts.**

## Scope and evidence

- Repository: `JLRCSTLL/EWS` (public).
- Fetched all three remote branches and tags before checking; the clone was not
  shallow. Gitleaks 8.30.1 scanned all 25 reachable commits, including
  `main`, `ui/map-command-center` and `build/tanoviq-ios`.
- The reviewed production/base commit was
  `d02592c5179fd5b1b53fbab4a5268bdb4e8b8eb3`. The fetched iPhone branch ended at
  `775f44689635ef60eb35c2d9d836f54e9cc0dce4`.
- Separately scanned a 261-file snapshot of tracked and non-ignored unpublished
  files, including the current Windows, Android, iPhone and API work. The scan
  used the scanner's default rules, recursive decoding, archive traversal to
  depth two, and full redaction. No secret allowlist or baseline hid findings.
- Checked historical sensitive filenames. Only `.env.example` matched the
  credential/config inventory; its database string is a placeholder and private
  credential fields are empty/commented.
- Verified that `.local-data/` (including the local Firebase server credential,
  QA account records and owner key) and `android/app/google-services.json` are
  ignored. No values from these files were printed or copied into this report.
- GitHub's API confirmed secret scanning and push protection **enabled**, with
  **zero open alerts**. The repository had no GitHub Releases at review time.
- A second scan of the final 258-file publication snapshot also found no leaks.
  The expanded ignore rules excluded local IDE files and the old untracked APK
  from that snapshot; documentation and prevention files were included.

## Changes made

- Expanded Git exclusions for environment variants, private key formats,
  service-account filenames, IDE files, scan reports and native installers.
- Added `.vercelignore` to keep local credentials/data, native build trees and
  installers out of frontend uploads.
- Added a GitHub Secret scan workflow with a pinned, checksum-verified Gitleaks
  binary, read-only permissions and redacted output.
- Updated README and SECURITY.md with setup, current app versions, secret storage,
  personal-data handling, deployment order and scan/rotation instructions.

No credential was revoked and no Git history was rewritten: the scan did not
identify an exposed credential requiring either action.

## Interpretation and limits

Public hostnames, package IDs, Firebase project identifiers and VAPID public
keys are configuration, not backend secrets. A Firebase client API key is
extractable from the installed app and must have appropriate restrictions;
its presence is different from leaking an FCM service-account private key.
See [Firebase API-key guidance](https://firebase.google.com/docs/projects/api-keys).
Cloud API-key restrictions were not changed or certified by this review.

The app handles personal data, including preferred names and duty locations.
Masked contacts are not anonymization. Source tests exercise access controls and
contact consent, but a secret scanner does not establish legal compliance or
prove that every personal record has been excluded.

The review covers fetched Git history and the local source snapshot. It does not
audit other repositories, forks, deleted/unreachable commits, all issue/PR text,
historical CI artifacts, production database contents, hosting environment values
or provider access logs. A clean scan is evidence within that scope, not a
guarantee of complete security. See [SECURITY.md](../SECURITY.md).
