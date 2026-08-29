# Submission Checklist

Use this as a release gate. Leave an item unchecked when evidence is unavailable; do not substitute assertions for public proof.

## Eligibility and repository

- [ ] The submission repository is public and accessible while signed out.
- [ ] The repository was created for this hackathon and has an understandable commit history.
- [ ] Development occurred on feature branches through pull requests, not direct pushes to `main`.
- [ ] The license, setup instructions, architecture, security model, provenance, and AI disclosure are present.
- [ ] The earlier ReplayFix project is credited only as inspiration; no prior code or assets were reused.
- [ ] Every third-party dependency and asset has a compatible license and recorded source.
- [ ] No secrets, tokens, private URLs, personal data, or production replay data appear in commits, logs, issues, screenshots, or video.

## Product behavior

- [ ] Input is a canonical public GitHub issue URL.
- [ ] The demonstration issue uses an explicitly labeled synthetic replay fixture.
- [ ] The repository is pinned to a base commit before analysis.
- [ ] Subagents are visibly assigned read-only tasks, and any attempted GitHub mutation still pauses at the harness gate.
- [ ] Reproduction, patching, and tests run inside a clean TrueForge sandbox.
- [ ] The original defect is reproduced before a patch is proposed.
- [ ] The patch is minimal and protected-path enforcement passes.
- [ ] Focused regression, relevant suite, lint, and type checks pass.
- [ ] GitHub writes remain unavailable until verification passes.
- [ ] Branch creation requires its own explicit approval.
- [ ] Commit and push require a second explicit approval.
- [ ] Opening the draft PR requires a third explicit approval.
- [ ] Each approval card shows one exact pending tool call; changed arguments require a new approval.
- [ ] The product opens only a draft PR and provides no merge or auto-merge action.
- [ ] Denial and failure paths stop closed and leave a redacted audit event.

## Qodo evidence

- [ ] Qodo was installed before substantive development.
- [ ] Every substantive project change has a public pull request.
- [ ] Each substantive PR shows a Qodo review.
- [ ] Applicable Qodo findings were resolved; declined findings include a rationale.
- [ ] Tests were rerun after review changes.
- [ ] Follow-up Qodo reviews are visible.
- [ ] Stable links or screenshots of the Qodo review trail are included in submission evidence.

## Demo and judging evidence

- [ ] The recording is approximately three minutes and follows `docs/DEMO.md`.
- [ ] The video shows the public issue, synthetic data label, and pinned base SHA.
- [ ] The video visibly shows sandbox reproduction, the patch, and passing checks.
- [ ] The video shows three distinct approval interactions and their effects.
- [ ] The final GitHub page visibly identifies the pull request as a draft.
- [ ] The video states that ReplayFix Guarded never merges code.
- [ ] Captions or clear narration explain TrueForge, GitHub/MCP, the safety boundary, and the user value.
- [ ] The video URL works in a private or signed-out browser session.

## Final submission form

- [ ] Project name and one-sentence description are consistent across the form, repository, and video.
- [ ] Public repository URL is correct.
- [ ] Public demo video URL is correct.
- [ ] The write-up names the target track and explains why the TrueForge sandbox and approvals are essential.
- [ ] The write-up discloses AI tools and identifies ReplayFix as inspiration only.
- [ ] The write-up links to architecture, security, provenance, and Qodo evidence.
- [ ] Team members, contact details, and required event fields are complete.
- [ ] Submission rules and deadline have been rechecked on the official event page.
- [ ] A final signed-out review confirms that every judge-facing link resolves.
- [ ] Submission confirmation is saved.

## Post-submission

- [ ] Keep the repository and demo links public through the judging period.
- [ ] Do not merge the demonstration PR.
- [ ] Preserve the fixture issue, pinned base commit, audit evidence, and Qodo review trail.
- [ ] Record any material post-deadline edits transparently.
