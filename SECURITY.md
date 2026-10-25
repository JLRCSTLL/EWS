# Security

TANOVIQ is an evaluation project. Do not use public issues, screenshots or build
logs to report credentials, real personnel locations, contact data or session
tokens. If GitHub's **Security → Report a vulnerability** option is available,
use it; otherwise contact the repository owner through a private channel already
known to you. No public support email has been designated for this thesis.

## Keep credentials out of the repository

- Use server environment variables for Postgres, Firebase service accounts,
  bootstrap keys, VAPID private keys and APNs signing keys. Never put secrets in
  `VITE_*`, client JavaScript, Android resources or the iPhone bundle.
- Keep `.local-data/`, environment files, signing keys and local Firebase config
  private. `.gitignore` protects new files, not previously committed files.
- Treat exports, database backups, logs and screenshots as potentially containing
  personal data. Use synthetic accounts for automated tests.
- Firebase client API keys identify an app/project and can be extracted from an
  APK. They are different from Firebase **service-account private keys**. Apply
  appropriate API/application restrictions; do not grant a public client key
  access to unrelated paid APIs. See [Firebase's guidance](https://firebase.google.com/docs/projects/api-keys).
- Distribution binaries belong in a deliberate release, not source history.
  Keep the pilot keystore private and reuse it for compatible Android updates.

## Repeat the scan

Install [Gitleaks](https://github.com/gitleaks/gitleaks) from its verified release,
fetch every repository branch/tag, and run:

```sh
git fetch origin --tags
gitleaks git . --log-opts="--all --full-history" --redact=100 --ignore-gitleaks-allow
gitleaks git . --pre-commit --staged --redact=100 --ignore-gitleaks-allow
```

The first command checks fetched history; the second checks staged changes.
For unpublished/untracked source, use a separate snapshot containing the files
reported by `git ls-files --cached --others --exclude-standard`, then run
`gitleaks dir` on that snapshot with `--redact=100`. Avoid scanning private local
databases into CI artifacts. Review findings without printing secret values.

The repository's Secret scan workflow runs Gitleaks on pushes and pull requests.
It uses a pinned scanner version/checksum, read-only GitHub permissions and
redacted output. GitHub secret scanning and push protection provide an additional
check; neither detects every possible secret or personal record.

## If a real credential is exposed

1. Revoke or rotate it at the provider immediately. Replacing a string in the
   latest commit does not invalidate a leaked credential.
2. Update the authorized server's secret configuration and verify service health.
3. Remove the secret from source and inspect provider access logs. Do not test a
   leaked credential by sending it to an unrelated service.
4. Coordinate any Git-history rewrite with the repository owner and collaborators.
   Existing clones, forks, caches and downloaded artifacts may retain old content.
5. Document the affected credential type and remediation without its value.

The scoped [25 October 2026 review](docs/security-review-2026-10-25.md) records the
latest repository check; it is not a penetration test or compliance certification.
