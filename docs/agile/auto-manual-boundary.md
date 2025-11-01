# AUTO / MANUAL / CO-EDIT 境界（原本）

- **AUTO**（機械が再生成。人は直接編集しない）
  - docs/specs/openapi.yaml
  - docs/tests/**（雛形）
  - マーカー: <!-- AUTO:BEGIN ... --> ... <!-- AUTO:END --> / <!-- AUTO-START --> ... <!-- AUTO-END --> / # AUTO-START ... # AUTO-END

- **MANUAL**（人が恒常的に編集。Codexは触らない）
  - docs/agile/**（※次項のハイブリッド対象と README-agile.md を除く）
  - README.md

- **HYBRID**（本文はMANUAL、AUTOセクションはCodexが同期）
  - docs/agile/plan.md — AUTO: plan.meta / plan.inputs / plan.outputs / plan.tasks
  - docs/agile/workorder.md — AUTO: workorder.meta / workorder.limits / workorder.allowed_paths / workorder.blocked_paths / workorder.plan_links
  - docs/agile/review.md — AUTO: review.meta

- **CO-EDIT**（人主導＋ASSISTブロックのみCodexが自動）
  - docs/agile/README-agile.md
    - 許可範囲: <!-- ASSIST-START:* --> ... <!-- ASSIST-END:* -->

---
**関連**: [docs/agile/README-agile.md](./README-agile.md) （CO-EDIT方針と ASSIST ブロック定義）

命名規約: operationId=verbNoun（例: createTrade）, tags=複数形（trades）, summary=短い命令文。
