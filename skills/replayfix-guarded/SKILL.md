---
name: replayfix-guarded
description: Turn a public GitHub issue containing synthetic session-replay evidence into a reproduced, tested patch and an approval-gated draft pull request. Use when operating ReplayFix Guarded, demonstrating its TrueForge workflow, or evaluating an issue-to-PR run that must keep subagents read-only, execute in a sandbox, protect sensitive paths, and require separate approval for every GitHub write.
---

# Operate ReplayFix Guarded

Treat safety gates as part of the product. Do not bypass, combine, or pre-approve them.

## Accept the request

1. Require one public URL in the exact form `https://github.com/<owner>/<repo>/issues/<number>`.
2. Reject private, inaccessible, malformed, non-issue, cross-host, shortened, or token-bearing URLs.
3. Require the issue and replay fixture to contain synthetic data only. Stop if the evidence could contain production identifiers, cookies, credentials, personal data, or customer recordings.
4. Record the repository, issue number, default-branch commit SHA, run ID, and policy version before analysis.
5. Keep all subagents read-only. Allow them to inspect the issue, source, replay fixture, and command output, but never to edit files or call mutating tools.

## Work only in the sandbox

1. Clone the public repository at the recorded commit into an isolated TrueForge sandbox.
2. Install dependencies with the repository's documented, lockfile-respecting command. Do not update dependencies.
3. Reproduce the issue against the synthetic replay fixture and preserve the failing command and output.
4. Ask read-only analysis agents to produce diagnosis and patch guidance.
5. Have the orchestrator apply the smallest patch inside the disposable sandbox.
6. Refuse changes to protected paths:
   - `.git/**`, `.github/**`, `.env*`, and secret or credential files
   - dependency manifests and lockfiles
   - deployment, infrastructure, signing, release, or access-control configuration
   - generated assets, binaries, and vendored code
7. Run the focused regression test, the relevant test suite, lint, and type-check commands that the repository provides.
8. Stop on any failed required check. Do not perform any GitHub write until all required tests pass.
9. Prepare an evidence bundle containing the reproduction, diagnosis, exact diff, commands, results, base SHA, and file hashes.

## Gate every GitHub write

Request a new, explicit human approval at each stage. Show the exact action, destination repository, affected ref, evidence bundle, and consequences. Treat approval as single-use and bind it to the displayed payload. Invalidate it whenever the diff, base SHA, command results, destination, or payload changes.

1. **Gate 1 — create branch:** create only a `replayfix/<run-id>` branch from the recorded base SHA.
2. **Gate 2 — commit and push:** commit and push only the reviewed patch to that branch. Do not force-push.
3. **Gate 3 — open draft PR:** create a draft pull request with the issue link, synthetic-data statement, reproduction, tests, risk notes, and evidence summary.

Do not merge, enable auto-merge, mark ready for review, approve reviews, edit repository settings, or write to any other branch. If approval is denied or expires, stop safely and retain only the local audit record.

## Run the Qodo review loop

1. Install and configure Qodo before substantive project development.
2. Open development changes through feature branches and pull requests; do not push directly to `main`.
3. Request Qodo review on every substantive project PR.
4. Address applicable findings, document any declined finding with a reason, rerun tests, and request a follow-up Qodo review.
5. Preserve review links or screenshots for the submission evidence. Never describe a review as completed unless the public PR shows it.

## Report the result

Return the run ID, issue and base links, files changed, test evidence, approval decisions, branch link, and draft PR link. Label skipped or unavailable steps honestly. Emphasize that the system created a draft for human review and never merged code.
