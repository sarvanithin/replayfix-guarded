# Approval Evidence Contract

Interactive write approval requires a JSON evidence file produced from the current sandbox run. The CLI rejects files larger than 256 KiB and validates every field before it evaluates a pending GitHub mutation.

```json
{
  "repository": "sarvanithin/replayfix-guarded",
  "baseSha": "0123456789abcdef0123456789abcdef01234567",
  "baseBranch": "main",
  "tests": [
    {
      "command": "npm test",
      "status": "passed",
      "outputDigest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ]
}
```

The repository must exactly match the accepted issue. `baseSha` and every `outputDigest` use lowercase or uppercase hexadecimal; test order is significant, and every status must be `passed`. Generate each output digest from the complete, redacted command output in the sandbox:

```bash
sha256sum test-output.txt
```

For macOS outside the sandbox, use `shasum -a 256`. Never place credentials, raw production replay data, or personal information in the evidence file.

For each pending call, the CLI validates:

- owner and repository match the accepted issue;
- branch is `replayfix/issue-<number>-<slug>` and remains identical across writes;
- immediately before branch approval, GitHub's live base ref still resolves to the exact evidence `baseSha`;
- branch creation starts from the evidence base branch, must return a successful tool response, and its live topic ref must still equal `baseSha` before any later write can be approved;
- pushed text files pass protected-path, duplication, count, and byte limits; protected classes include dependency manifests and locks, ownership and security policy, authentication/authorization, deployment and infrastructure, generated and vendored output, and binary assets;
- patch publication must return a successful tool response on the approved branch before the PR gate opens;
- PR base matches the evidence base, head matches both the approved and successfully published branch, and `draft` is exactly `true`; and
- at least one ordered, passing test result is bound to the approval.

The displayed digest covers the actual normalized tool arguments plus the repository, base SHA, tests, branch, and title. The operator must type that complete digest to create a TrueForge `user.tool_approval` allow input. Any policy failure, stale base ref, missing successful branch response, or digest mismatch creates a deny input instead. A failed or incomplete TrueForge turn also terminates the CLI with a non-zero exit code.
