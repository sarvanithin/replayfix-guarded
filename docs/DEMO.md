# Three-Minute Demo

The demo should prove the safety contract in one continuous recording. Use a dedicated public fixture repository, a public issue, and synthetic replay data. Keep the draft PR open after recording; never merge it for the demo.

## Before recording

- Reset the fixture repository to the documented buggy base commit.
- Confirm the public issue URL loads in a signed-out browser window.
- Confirm the issue explicitly labels its replay payload as synthetic.
- Rehearse the commands and keep total runtime below three minutes.
- Ensure the TrueForge sandbox starts clean and contains no credentials.
- Prepare the GitHub integration with least-privilege access to the fixture repository.
- Close or redact notifications, tokens, email, private repository names, and unrelated browser tabs.
- Verify that Qodo review evidence is visible on the project development PRs.

## Recording script

### 0:00–0:20 — Problem and promise

Show the public issue and its synthetic replay event. Say:

> A session replay shows a user action failing, but an agent should not be trusted to publish code silently. ReplayFix Guarded reproduces the defect in TrueForge, verifies a minimal patch, and asks before every GitHub write.

Point out the canonical issue URL and synthetic-data notice.

### 0:20–0:50 — Read-only intake and reproduction

Paste the public issue URL into ReplayFix Guarded. Show the pinned repository and base SHA. Start the run and show the read-only tasks given to analysis agents. Display the sandbox reproduction command and the expected failing result.

State that issue text and repository content are treated as untrusted input.

### 0:50–1:20 — Patch and verification

Show the diagnosis, compact diff, and focused regression test. Then show the relevant suite, lint, and type-check results. Point to the evidence digest and protected-path check.

Say explicitly: no GitHub write is possible until these checks pass.

### 1:20–2:35 — Three independent gates

At each gate, keep the TrueForge pending call and guarded CLI summary visible long enough for the repository, action, ref, file hashes, test evidence, and approval digest to be legible.

1. Approve creation of `replayfix/<run-id>` at the pinned base SHA. Show the branch appearing.
2. Approve the displayed commit and push. Show the exact diff on the branch.
3. Approve creation of the displayed **draft** pull request. Show the draft badge, linked issue, test summary, synthetic-data statement, and AI disclosure.

Explain that every pending tool call has its own approval; the operator types the exact digest, and changed arguments produce a different digest requiring another decision.

### 2:35–2:50 — Safety proof

Show the terminal run state and the absent merge action in the product. Say:

> The workflow ends at a draft. ReplayFix Guarded cannot merge, enable auto-merge, or write to the default branch.

### 2:50–3:00 — Close

Show the architecture diagram or project page and finish with:

> From replay evidence to a tested proposal, with the sandbox doing the work and the human keeping authority.

## Capture checklist

- Public issue and synthetic fixture are readable.
- TrueForge sandbox identity is visible.
- Initial failure and passing verification are visible.
- Diff and protected-path result are visible.
- All three approvals appear as separate interactions.
- Final GitHub page visibly says **Draft**.
- No merge occurs.
- Video link permissions allow judges to view without requesting access.

If a step fails during recording, stop and restart from a clean run. Do not edit the video to imply an approval or test that did not occur.
