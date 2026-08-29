# Provenance and AI Disclosure

## Project origin

ReplayFix Guarded is a new hackathon project built from scratch for an approval-gated, sandboxed issue-to-draft-PR workflow. An earlier personal project named **ReplayFix** inspired the broad problem choice: using session-replay evidence to help locate and explain a user-facing defect.

No source code, tests, prompts, assets, commit history, or documentation from the earlier ReplayFix repository are included here. ReplayFix Guarded has its own implementation, security model, repository history, and submission artifacts. The distinguishing work is not a rename or wrapper: it centers on TrueForge sandbox execution, read-only subagent assignments, synthetic-data enforcement, a verification barrier, three independent human approvals, and a draft-only GitHub outcome.

If future contributors import any third-party or prior-project material, they must record the source URL, commit or version, license, files affected, and nature of the modification in this document before merging it.

## AI-assisted development disclosure

AI coding tools may assist with planning, implementation, tests, documentation, and review. Human contributors remain responsible for requirements, architecture, security decisions, verification, licenses, and every merged change.

For each substantive pull request:

- identify the AI tools used in the PR description;
- describe which artifacts they helped produce;
- review the generated output line by line;
- run and report the relevant tests;
- request Qodo review, address applicable findings, and request a follow-up review;
- retain the public PR discussion as development evidence.

AI assistance does not constitute approval for a GitHub mutation performed by the product. Runtime branch creation, commit/push, and draft-PR creation each require a separate human decision.

## Current material register

| Material                                   | Origin                                     | Use                                           |
| ------------------------------------------ | ------------------------------------------ | --------------------------------------------- |
| ReplayFix Guarded source and documentation | Created in this repository                 | Hackathon project                             |
| ReplayFix concept                          | Earlier personal project; inspiration only | Problem-space background, no copied artifacts |
| TrueForge                                  | External platform                          | Isolated runtime and approval workflow        |
| GitHub integration                         | External service/API                       | Public source reads and gated writes          |
| Qodo                                       | External review tool                       | Pull-request review evidence                  |

Product names and trademarks belong to their respective owners. Their mention does not imply endorsement.
