# Workorder Weekly Report

**Period:** 2025-10-27 16:38 UTC+09:00 — 2025-11-03 16:38 UTC+09:00

| Metric | Value |
| --- | --- |
| Runs analysed | 24 (success 6 / failure 18 / cancelled 0) |
| No-Op rate | 0/24 (0.0%) |
| Limit hits | 6/24 (25.0%) |
| Avg lead time | 33s |
| Top failures | pr_sync_failed (12), guard_limit (4), fail_on_guard_failure (2) |

_Excluded runs (not enough data): missing_artifact: 666_

| Run | Trigger | Branch | Conclusion | Lead | No-Op | Guard | Failure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [19027143850](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19027143850) | workflow_run | main | failure | 23s | ➖ | ok | pr_sync_failed |
| [19027108749](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19027108749) | workflow_run | main | failure | 22s | ➖ | ok | pr_sync_failed |
| [19027078933](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19027078933) | workflow_run | main | failure | 27s | ➖ | ok | pr_sync_failed |
| [19027070592](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19027070592) | workflow_run | main | failure | 20s | ➖ | ok | pr_sync_failed |
| [19026057258](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19026057258) | workflow_run | main | success | 23s | ➖ | ok | - |
| [19026009576](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19026009576) | workflow_run | main | success | 20s | ➖ | ok | - |
| [19025764407](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19025764407) | workflow_run | main | success | 29s | ➖ | ok | - |
| [19025499909](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19025499909) | workflow_run | main | failure | 21s | ➖ | limit_exceeded | guard_limit |
| [19025271324](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19025271324) | workflow_dispatch | test/workorder-success | failure | 23s | ➖ | limit_exceeded | fail_on_guard_failure |
| [19025271324](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19025271324) | workflow_dispatch | test/workorder-success | failure | 23s | ➖ | limit_exceeded | fail_on_guard_failure |
