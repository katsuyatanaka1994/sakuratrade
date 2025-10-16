# AUTO / MANUAL / CO-EDIT 境界（原本）

- **AUTO**（機械が再生成。人は直接編集しない）
  - docs/specs/openapi.yaml
  - docs/tests/**（雛形）
  - マーカー: <!-- AUTO-START --> ... <!-- AUTO-END --> / # AUTO-START ... # AUTO-END

- **MANUAL**（人が恒常的に編集。Codexは触らない）
  - docs/agile/**（※README-agile.md を除く）
  - README.md

- **CO-EDIT**（人主導＋ASSISTブロックのみCodexが自動）
  - docs/agile/README-agile.md
    - 許可範囲: <!-- ASSIST-START:* --> ... <!-- ASSIST-END:* -->

---
**関連**: [docs/agile/README-agile.md](./README-agile.md) （CO-EDIT方針と ASSIST ブロック定義）
