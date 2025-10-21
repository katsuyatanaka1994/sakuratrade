# DS-21 セキュリティ監査チェックリスト

## Workflow configuration checks
- [ ] Every workflow under `.github/workflows/` defines a top-level `permissions` block with the minimum scopes required per job.
- [ ] `permissions` are tightened per job when only a subset needs write access; no workflow relies on repository defaults.
- [ ] Steps never use `secrets: inherit`; forked pull requests receive only the secrets explicitly granted to them.
- [ ] Any workflow using `pull_request_target` limits its behavior to safe operations (lint, label, comment) and does not mutate repository state on untrusted code.
- [ ] Whenever `pull_request_target` runs `actions/checkout@*`, it pins the base revision via `ref: ${{ github.event.pull_request.base.sha }}` and sets `persist-credentials: false` unless the step must push.
- [ ] Reusable workflows called from forks are reviewed for implicit permission escalation or `secrets` forwarding.

## Periodic review cadence
- Weekly: run `scripts/workflow_permissions_lint.py` and address any new findings before merging external contributions.
- Release preparation: re-run the lint script, review repository-level **Workflow permissions** in Settings → Actions → General, and ensure documentation matches the intended defaults.
- After enabling new third-party actions: perform an ad-hoc audit using the checklist above and capture exceptions in `docs/agile/report.md`.

## Reporting
- Capture the lint outcome in `docs/agile/.sec-review-row` and append the result to `docs/agile/report.md` together with the triggering workflow run URL.
- File follow-up issues or pull requests for every `NG` finding, linking back to the offending workflow and the audit log entry.
