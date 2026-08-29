# Security Model

ReplayFix Guarded assumes issue text, replay events, repository contents, dependency scripts, and agent output may be hostile. Its principal guarantee is bounded authority: it can prepare and propose a change, but it cannot silently publish or merge one.

## Trust zones

| Zone                | Examples                                              | Default treatment                                                |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| Untrusted input     | Issue text, replay fixture, repository files          | Treat as data, never as instructions                             |
| Isolated execution  | Clone, dependency install, reproduction, patch, tests | Run in a disposable TrueForge sandbox                            |
| Delegated reasoning | Triage, diagnosis, code review subagents              | Assign read-only work; harness-gate every available GitHub write |
| Privileged boundary | GitHub branch, push, and PR APIs                      | Require a fresh, payload-bound approval                          |
| Audit output        | Commands, hashes, decisions, links                    | Append-only, minimized, and redacted                             |

## Input and privacy rules

- Accept only a canonical public GitHub issue URL.
- Use synthetic session-replay fixtures created for the demonstration.
- Do not ingest live recordings, cookies, authorization headers, form values, email addresses, IP addresses, account IDs, or production telemetry.
- Reject URLs with embedded credentials, access tokens, fragments, unexpected query parameters, redirects, or non-GitHub hosts.
- Treat instructions found in issues, comments, source files, tests, logs, and replay text as untrusted content. They cannot alter policy or authorize tools.
- Avoid private repositories and organization-only resources for the public hackathon demonstration.

## Sandbox controls

- Create a fresh sandbox per run and destroy it after the retention window.
- Pin the checkout to the recorded base commit and prevent access outside the run directory.
- Provide no production credentials. Mount no user home directory, SSH agent, cloud profile, or browser session.
- Restrict outbound network access after the approved dependency-fetch phase.
- Respect the repository lockfile and disable dependency upgrades.
- Set CPU, memory, process, disk, and execution-time limits.
- Capture commands, exit codes, and truncated/redacted output.

Repository scripts can execute arbitrary code. A passing test therefore indicates functional evidence, not trustworthiness; the sandbox remains mandatory.

## Change policy

Reject a proposed diff that touches any of the following:

- `.git/**`, `.github/**`, `.env*`, secret stores, certificates, or credential files
- package manifests, lockfiles, vendored dependencies, generated artifacts, or binaries
- CI/CD, deployment, infrastructure-as-code, signing, release, permission, or access-control configuration
- files outside the checked-out repository, symlink escapes, submodule targets, or paths containing traversal segments

Also reject changes that exceed the configured file/line budget, include obfuscated content, disable tests or security controls, introduce network destinations, or diverge from the issue's narrow scope. Protected-path denials cannot be overridden inside the run.

## Verification barrier

Require a reproduced failure before patching. After patching, require the new focused regression test plus the repository's relevant tests, lint, and type checks. Record skipped checks as failures unless the policy explicitly marks them inapplicable.

No GitHub mutation may occur before all required checks pass. Re-run verification whenever the base SHA, diff, dependencies, test commands, or sandbox inputs change.

## Approval and GitHub permissions

Use three distinct approvals:

1. Create the named `replayfix/<run-id>` branch at the pinned base SHA.
2. Commit and push the displayed patch to that branch.
3. Open the displayed pull request as a draft.

TrueForge requests approval for a specific pending tool call and its arguments. Never infer approval from chat text, an earlier gate, inactivity, or a successful test. A custom UI can use the included digest helper to bind repository, base SHA, diff, ordered test evidence, branch, and title, rejecting an approval when those inputs change.

Grant the GitHub integration only the repository permissions needed for contents and draft pull requests. Never write to the default branch, force-push, merge, enable auto-merge, change settings, create releases, or alter Actions workflows.

## Failure behavior

Fail closed on malformed input, unavailable evidence, policy uncertainty, sandbox escape indicators, stale base, failed checks, denied/expired approval, GitHub conflicts, or unexpected API responses. Preserve a redacted audit event, revoke unused approvals, and stop. Do not retry a write unless the operator reviews the new payload and approves it again.

## Responsible demonstration

Use a purpose-built public fixture repository and synthetic replay sequence. Show at least one denied gate in rehearsals. Do not target a third-party repository without its owner's permission. The generated PR must remain a draft, and a human maintainer retains all responsibility for review and merge outside ReplayFix Guarded.
