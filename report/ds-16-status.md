# DS-16 現状アセスメント（変更なし）

## サマリー（RAG）
| Workflow | on | Failure Handler | Success Unlabel | PR Permissions | Labels/Comment/Slack | PR限定? | 判定 |
|---|---|---|---|---|---|---|---|
| docs-index-validate.yml | workflow_dispatch, pull_request | No | No | No (contents:read/actions:write) | labels:[], comment:No, slack:No | No | 🔴 |
| nfr-xref.yml | pull_request, workflow_dispatch | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🔴 |
| security-permissions-lint.yml | pull_request, workflow_dispatch, push(main) | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🔴 |
| code-quality.yml | pull_request | No | No | No (default) | labels:[], comment:No, slack:No | Yes | 🔴 |
| backend-ci.yml | pull_request, push | No | No | No (default) | labels:[], comment:No, slack:No | No | 🔴 |
| docsync-aggregate.yml | workflow_run(docsync-check) | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🟡 |
| docsync-apply.yml | workflow_dispatch | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🟡 |
| docsync-check.yml | pull_request, push(main) | No | No | No (contents:read/actions:write) | labels:[], comment:No, slack:No | No | 🔴 |
| docsync-e2e.yml | workflow_run(docsync-check) | No (handled via script) | No (removes label inline) | Yes (pull-requests:write, issues:write) | labels:[docsync:needs-apply], comment:Yes, slack:No | Yes | 🟢 |
| docsync-orchestrate.yml | workflow_run(docsync-check) | No | No | Yes (pull-requests:write, issues:write) | labels:[], comment:Yes, slack:No | Yes | 🟡 |
| docsync-report-append.yml | workflow_run(docsync-check) | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🟡 |
| ensure-labels.yml | workflow_dispatch | No | No | No (issues:write only) | labels:[docs:invalid, docsync:needs-apply, codex:apply], comment:No, slack:No | No | 🟡 |
| gha-write-check.yml | workflow_dispatch | No | No | Yes (pull-requests:write, contents:write) | labels:[], comment:No, slack:No | No | 🟡 |
| guard-readme-assist.yml | pull_request | No (step-level only) | No | No (contents:read) | labels:[], comment:No, slack:No | Yes | 🔴 |
| node-poc.yml | workflow_dispatch | No | No | No (contents:read) | labels:[], comment:No, slack:No | No | 🟡 |
| oas-impl-details.yml | workflow_dispatch | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply], comment:No, slack:No | No | 🟡 |
| openapi-contract-diff.yml | pull_request | No | No | Yes (pull-requests:write, issues:write) | labels:[], comment:Yes, slack:No | Yes | 🟡 |
| openapi-validate.yml | pull_request, push(main) | No | No | No (contents:read) | labels:[], comment:No, slack:No | No | 🔴 |
| pr-draft-on-fail.yml | workflow_run(docs-index-validate/nfr-xref/security-permissions-lint) | No | No | Yes (pull-requests:write, issues:write) | labels:[], comment:Yes, slack:No | Yes | 🟡 |
| pr-label-guard.yml | workflow_run(docs-index-validate/nfr-xref/security-permissions-lint) | No (script adds) | No (script removes) | Yes (pull-requests:write, issues:write) | labels:[docs:invalid], comment:No, slack:No | Yes | 🟢 |
| release-notes.yml | pull_request:closed | No | No | Yes (pull-requests:write, contents:write) | labels:[docsync:needs-apply, area:docs, type:automation], comment:No, slack:No | Yes | 🟡 |
| soft-guard-alert.yml | pull_request:closed | No | No | No (pr:read/issues:write) | labels:[docs:invalid], comment:No, slack:Yes | Yes | 🟢 |
| ui-spec-manual.yml | workflow_dispatch | No | No | Yes (pull-requests:write, contents:write) | labels:[], comment:No, slack:No | No | 🟡 |
| update-symbols.yml | schedule, workflow_dispatch | No | No | No (contents:write only) | labels:[], comment:No, slack:No | No | 🟡 |

## 詳細メモ
- .github/workflows/docs-index-validate.yml:3 は pull_request/dispatch 両対応だが jobs セクションに `if: ${{ failure() }}` で分岐する後続ジョブがなく、失敗時に `docs:invalid` を直接付与できない（pr-label-guard 任せ）ため一次対応が欠如。
- .github/workflows/nfr-xref.yml:29 も同様で `xref` ジョブ失敗時のフォローがなく、PR書き込み権限はあるがラベル付与・コメントが発火しない。
- .github/workflows/security-permissions-lint.yml:19 では pull_request イベントが `noop-pr` で終了し、本体 `run-on-main` が push/main 専用のため PR 失敗を直接検知できず、派生ワークフローに依存している点がリスク。
- .github/workflows/code-quality.yml:6 は CI 本体のみでフォローアップが存在せず、ラベル除去も未実装のため PR の可視化が弱い。
- .github/workflows/pr-label-guard.yml:1 は 3 つの重点WFの workflow_run を集約し、`docs:invalid` を付与/除去しているが、元ワークフロー側にフォールバックがないため二段構えになっていない。
- .github/workflows/pr-draft-on-fail.yml:1 は失敗時に PR を Draft 化しコメントするが、ラベル処理は行わないため docs:invalid の整合は pr-label-guard/soft-guard-alert 依存。
- .github/workflows/docsync-e2e.yml:1 は `docsync:needs-apply` の加除とガイドコメントを完結させており、DocSync 系の中では最もセルフ完結したハンドリング。
- .github/workflows/soft-guard-alert.yml:24 で `SLACK_WEBHOOK_URL` を参照し、マージされた PR に `docs:invalid` が残存した場合に Issue 発行と Slack 通知を行うフォールバックが存在。

## 不足点と最小パッチ案（適用禁止・提案のみ）
- docs-index-validate.yml に失敗/成功時の最小ハンドラを追加
```diff
--- a/.github/workflows/docs-index-validate.yml
+++ b/.github/workflows/docs-index-validate.yml
@@
   validate:
     runs-on: ubuntu-latest
     permissions:
       contents: read
       actions: write
@@
       - uses: actions/upload-artifact@v4
         if: ${{ always() && !(github.event_name == 'pull_request' && startsWith(github.head_ref, 'docs-sync/')) && !(github.event_name != 'pull_request' && startsWith(github.ref_name, 'docs-sync/')) && !(github.event_name == 'pull_request' && contains(github.event.pull_request.title, '[skip docsync]')) }}
         with:
           name: ds14-report
           path: docs_index_report.json
+
+  report-failure:
+    needs: [validate]
+    if: ${{ failure() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            await github.rest.issues.addLabels({ owner, repo, issue_number, labels: ['docs:invalid'] });
+            await github.rest.issues.createComment({
+              owner,
+              repo,
+              issue_number,
+              body: `❌ docs-index-validate failed. Run: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
+            });
+
+  report-success:
+    needs: [validate]
+    if: ${{ success() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            for (const name of ['docs:invalid']) {
+              try {
+                await github.rest.issues.removeLabel({ owner, repo, issue_number, name });
+              } catch (error) {
+                core.info(`label ${name} already absent`);
+              }
+            }
```

- nfr-xref.yml に対する最小フォローアップ（失敗で docs:invalid 付与、成功で除去）
```diff
--- a/.github/workflows/nfr-xref.yml
+++ b/.github/workflows/nfr-xref.yml
@@
   xref:
     runs-on: ubuntu-latest
     permissions:
       contents: write
       pull-requests: write
@@
       - name: Create docs-sync PR ([skip docsync])
         if: ${{ !(github.event_name == 'pull_request' && startsWith(github.head_ref, 'docs-sync/')) && !(github.event_name != 'pull_request' && startsWith(github.ref_name, 'docs-sync/')) && !(github.event_name == 'pull_request' && contains(github.event.pull_request.title, '[skip docsync]')) && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}
         uses: peter-evans/create-pull-request@v6
         with:
           branch: docs-sync/nfr-xref
           base: main
@@
           labels: "docsync:needs-apply"
           delete-branch: true
+
+  report-failure:
+    needs: [xref]
+    if: ${{ failure() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            await github.rest.issues.addLabels({ owner, repo, issue_number, labels: ['docs:invalid'] });
+            await github.rest.issues.createComment({
+              owner,
+              repo,
+              issue_number,
+              body: `❌ nfr-xref failed. Run: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
+            });
+
+  report-success:
+    needs: [xref]
+    if: ${{ success() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            for (const name of ['docs:invalid']) {
+              try {
+                await github.rest.issues.removeLabel({ owner, repo, issue_number, name });
+              } catch (error) {
+                core.info(`label ${name} already absent`);
+              }
+            }
```

- security-permissions-lint.yml に push/dispatch 失敗時の記録と成功時のクリーンアップを追加
```diff
--- a/.github/workflows/security-permissions-lint.yml
+++ b/.github/workflows/security-permissions-lint.yml
@@
   run-on-main:
     # push(main) もしくは workflow_dispatch(main) のときだけ本処理を実行
     if: ${{ (github.event_name == 'push' && github.ref_name == 'main') || (github.event_name == 'workflow_dispatch' && github.ref_name == 'main') }}
     runs-on: ubuntu-latest
     timeout-minutes: 15
     permissions:
       contents: write
       pull-requests: write
+      issues: write
@@
       - name: Create docs-sync pull request
         uses: peter-evans/create-pull-request@v6
         with:
           branch: docs-sync/sec-review
           base: ${{ github.ref_name }}
           title: "[skip docsync] chore(docs): append DS-21 sec-review result"
           commit-message: "docs(report): append DS-21 sec-review row"
           add-paths: docs/agile/report.md
           labels: "docsync:needs-apply"
           delete-branch: true
+
+  report-failure:
+    needs: [run-on-main]
+    if: ${{ failure() }}
+    runs-on: ubuntu-latest
+    permissions:
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const title = `security-permissions-lint failed on ${process.env.GITHUB_REF_NAME}`;
+            const body = `Run: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
+            const { data: issues } = await github.rest.issues.listForRepo({ owner, repo, state: 'open', labels: 'triage:urgent', per_page: 100 });
+            if (!issues.some(i => i.title === title)) {
+              await github.rest.issues.create({ owner, repo, title, body, labels: ['triage:urgent'] });
+            }
+
+  report-success:
+    needs: [run-on-main]
+    if: ${{ success() }}
+    runs-on: ubuntu-latest
+    permissions:
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const title = `security-permissions-lint failed on ${process.env.GITHUB_REF_NAME}`;
+            const { data: issues } = await github.rest.issues.listForRepo({ owner, repo, state: 'open', labels: 'triage:urgent', per_page: 100 });
+            for (const issue of issues.filter(i => i.title === title)) {
+              await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed' });
+            }
```

- code-quality.yml に失敗/成功時の PR ラベル管理を追加
```diff
--- a/.github/workflows/code-quality.yml
+++ b/.github/workflows/code-quality.yml
@@
   fe-quality:
     if: ${{ !(github.event_name == 'pull_request' && startsWith(github.head_ref, 'docs-sync/')) && !(github.event_name != 'pull_request' && startsWith(github.ref_name, 'docs-sync/')) && !(github.event_name == 'pull_request' && contains(github.event.pull_request.title, '[skip docsync]')) }}
     defaults:
       run:
         working-directory: frontend
@@
       - run: npx tsc --noEmit
       - run: npx eslint '.'
       - run: npm test --silent
+
+  report-failure:
+    needs: [py-quality, fe-quality]
+    if: ${{ failure() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            await github.rest.issues.addLabels({ owner, repo, issue_number, labels: ['docs:invalid'] });
+            await github.rest.issues.createComment({
+              owner,
+              repo,
+              issue_number,
+              body: `❌ code-quality failed. Run: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
+            });
+
+  report-success:
+    needs: [py-quality, fe-quality]
+    if: ${{ success() && github.event_name == 'pull_request' }}
+    runs-on: ubuntu-latest
+    permissions:
+      contents: read
+      pull-requests: write
+      issues: write
+    steps:
+      - uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            for (const name of ['docs:invalid']) {
+              try {
+                await github.rest.issues.removeLabel({ owner, repo, issue_number, name });
+              } catch (error) {
+                core.info(`label ${name} already absent`);
+              }
+            }
```

## 再現手順
1. 対象ワークフローが失敗するように PR を用意し、チェックが赤になるまで待機する。
2. 失敗時に `docs:invalid` ラベル付与／コメント通知（または triage:urgent Issue／Slack）が想定通り行われるか確認する。
3. 不具合を修正して再実行し、成功時にラベル除去・Issue クローズなどのクリーンアップが行われることを確認する。
