# Branch運用（1タスク=1ブランチ）
- 原則：1タスク=1ブランチ。作業前に必ず切る／作業後にPRをDraftで作る。
- 命名：<type>/<ds-番号>-<短い説明>
  - type = feat | fix | chore | docs | refactor
  - 例）feat/ds-3-cli, chore/ds-2-openapi-source
- 流れ：mainから切る → 作業 → こまめにPush → Draft PR → Readyでレビュー
- 禁則：直接mainにPushしない