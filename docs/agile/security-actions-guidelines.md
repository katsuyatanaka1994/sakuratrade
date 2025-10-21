# DS-21 セキュリティ／権限運用ガイド

## Minimum permissions by default
- Declare a top-level `permissions` block in every workflow. Start from `permissions: {}` or granular read scopes, then add only the writes that each job truly needs.
- Avoid inheriting the repository default write-all setting. If a job must escalate (e.g. to push tags or comment on PRs), scope the escalation to the job and document the reason in the workflow file.
- Regularly review reusable workflows and called actions to ensure they do not require broader permissions than the caller actually needs.

## Handling `pull_request_target`
- Reserve `pull_request_target` for cases where the workflow must access repository secrets or write tokens while reacting to external pull requests.
- When triggered by forks, restrict the workflow to read-only operations or mediated responses (e.g. posting review comments via a bot). Never run build, deploy, or file-writing steps against forked code with repository-level credentials.
- For any checkout within `pull_request_target`, pin `actions/checkout` to `ref: ${{ github.event.pull_request.base.sha }}` so that untrusted fork commits are never executed with elevated privileges.

## Generated PR conventions
- Automation that publishes the result of a security review must push to a `docs-sync/*` branch (e.g. `docs-sync/sec-review-<run-id>`).
- Prefix generated PR titles with `[skip docsync]` to prevent recursive documentation workflows from firing.
- Ensure the PR body explains the originating workflow run and links to the security report for traceability.

## Repository settings: Actions → General
- Under **Workflow permissions**, set the default to "Read repository contents permission" and disable "Allow GitHub Actions to create and approve pull requests" unless a specific workflow requires it.
- When a workflow needs write access, elevate via its explicit `permissions` block rather than changing the repository-wide default.
- Audit these settings at least monthly or whenever adding third-party actions that expect broader permissions.
