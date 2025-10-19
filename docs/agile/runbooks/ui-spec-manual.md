# UI仕様同期（DS-11 / ui-spec-manual）運用メモ

> 迷ったらこのチェックだけ。**手でUI仕様を書いたら→1回だけ回す**。

## いつ回す？（チェックリスト）
- [ ] **UI仕様（MANUAL）を main にマージした直後**
- [ ] **新しい画面体験を追加した直後**（ページ/モーダル/ドロワーの追加や大改修）
- [ ] **UIイベント or 連携APIが変わる変更をマージした直後**
- [ ] **スプリント締めの棚卸し**（任意・1回）

**回さない**
- UIテキストの微修正だけ（操作/APIに変化がない）
- 手動PRがまだ *未マージ* のとき（競合防止。必ず main 反映後に回す）

## 具体手順（GitHub Web）
1. **Actions → ui-spec-manual → Run workflow**
2. Branch: `main`（通常）
3. Inputs:
   - `screen`（必須）：例 `Positions Page` / `Entry Modal`
   - `summary`（任意）：一行サマリ
   - `notes`（任意）：補足
4. 実行すると **PR** が自動作成されます

## 合格ライン（DoD）
- **変更は `docs/agile/ui-specification.md` の `<!-- ASSIST-START:ui-spec --> … <!-- ASSIST-END:ui-spec -->` 内だけ**
- 内容が意図どおり（画面名/更新時刻/概要/主要操作/状態・バリデーション/＆ UI→API が入っている）
- 再実行すると **同じブロックが上書き**（追記ではない）

## 失敗時の切り分け（最短）
- **PRが作られない** → Settings → Actions → General → *Workflow permissions* を **Read and write**、および *Allow GitHub Actions to create and approve pull requests* を ON
- **マーカー不足** → スクリプトが `<!-- ASSIST-START:ui-spec -->` を自動補完（無い場合は追記される）
- **他チェックへの影響** → READMEガード/OAS系は対象外なので通常は無関係（Checksが0でも正常）

---
このメモは **docs/agile/ui-specification.md（MANUAL）→ ASSIST同期（自動）→ Codex参照** の起点を忘れないための運用メモです。
