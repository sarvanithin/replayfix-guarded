# Security policy

ReplayFix Guarded is a hackathon prototype, not a production autonomous-code system. Use only public repositories and synthetic session-replay data in the demo.

## Supported version

Only the latest commit on `main` is supported during the hackathon.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Contact the repository owner through the private contact method on their GitHub profile and include reproduction steps without credentials, personal data, or production repository contents.

## Security boundaries

- Model and GitHub credentials remain in TrueForge and never enter the sandbox.
- GitHub write tools are explicitly approval-gated in the saved TrueForge agent spec.
- No merge or deletion tool is exposed. Instructions prohibit default-branch writes, and every available write displays its exact branch and arguments for human approval.
- Generated changes run only in the configured TrueForge sandbox.
- The included patch-policy library rejects protected paths, traversal, absolute paths, and secret-file patterns; agent instructions additionally refuse those changes before requesting a write.
- A denial, failed test, stale approval, or interrupted run must leave GitHub unchanged.

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model and verification checklist.
