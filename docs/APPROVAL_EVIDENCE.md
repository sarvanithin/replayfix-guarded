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
- branch creation starts from the evidence base branch;
- pushed text files pass protected-path, duplication, count, and byte limits;
- PR base matches the evidence base, head matches the approved branch, and `draft` is exactly `true`; and
- at least one ordered, passing test result is bound to the approval.

The displayed digest covers the actual normalized tool arguments plus the repository, base SHA, tests, branch, and title. The operator must type that complete digest to create a TrueForge `user.tool_approval` allow input. Any policy failure or digest mismatch creates a deny input instead.
