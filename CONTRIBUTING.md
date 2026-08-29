# Contributing

## Development workflow

1. Open or reference a GitHub issue.
2. Create a focused branch from `main`.
3. Run `npm ci` and `npm run check`.
4. Open a pull request using the repository template.
5. Wait for Qodo and CI. Address every valid high-severity finding and explain any dismissal in the review thread.
6. Rerun Qodo after changes, then merge manually only after the final revision is reviewed.

Direct substantive pushes to `main` are not accepted. Never include API keys, replay data from real users, private source code, or generated files containing secrets.

## Commit format

Use `<type>(<scope>): <description>`, for example `feat(policy): bind approvals to the tested diff`.

AI-assisted contributions must be disclosed in the pull request and reviewed by a contributor who understands the resulting code.
