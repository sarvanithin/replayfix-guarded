export interface GitHubIssueReference {
  owner: string;
  repository: string;
  issueNumber: number;
  canonicalUrl: string;
}

const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

/** Accepts only canonical, credential-free public GitHub issue URLs. */
export function parseGitHubIssueUrl(rawUrl: string): GitHubIssueReference {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TypeError("Issue URL must be a valid absolute URL");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      "Issue URL must be a credential-free https://github.com URL without a query or fragment",
    );
  }

  const match = /^\/([^/]+)\/([^/]+)\/issues\/([1-9]\d*)\/?$/.exec(
    url.pathname,
  );
  if (!match) {
    throw new TypeError(
      "Issue URL must match https://github.com/<owner>/<repository>/issues/<number>",
    );
  }

  const [, owner, repository, issueNumberText] = match;
  if (
    !owner ||
    !repository ||
    !issueNumberText ||
    !GITHUB_NAME.test(owner) ||
    !GITHUB_NAME.test(repository) ||
    repository.endsWith(".git")
  ) {
    throw new TypeError(
      "Issue URL contains an invalid owner or repository name",
    );
  }

  const issueNumber = Number(issueNumberText);
  if (!Number.isSafeInteger(issueNumber)) {
    throw new TypeError("Issue number is outside the supported range");
  }

  return {
    owner,
    repository,
    issueNumber,
    canonicalUrl: `https://github.com/${owner}/${repository}/issues/${String(issueNumber)}`,
  };
}

export function assertRepositoryAllowed(
  reference: GitHubIssueReference,
  allowedRepositories: readonly string[],
): void {
  const target = `${reference.owner}/${reference.repository}`.toLowerCase();
  const allowed = allowedRepositories.some(
    (repository) => repository.trim().toLowerCase() === target,
  );
  if (!allowed) {
    throw new TypeError(
      `Repository ${reference.owner}/${reference.repository} is not in REPLAYFIX_ALLOWED_REPOSITORIES`,
    );
  }
}
