# 保有ポジション ライブ更新 ロールアウトメモ

## テスト観点（Vitest / RTL）

- ストア整合: `applyPositionsSnapshot → syncPositionsBatch → close` の順で呼び、最終的に `status=open` だけが残る。
- ソート: `updatedAt` を UTC で比較し降順を維持する（表示はローカルでも OK）。
- ライブ購読: `positions.upsert` / `positions.removed` を疑似的に投げ、1フレーム内で positionId 単位に集約されることを確認。
- 免疫: `source≠modal` のデータはストアにも UI にも反映されない。
- 接続状態 UI: 断線時に `role="status"` で再接続メッセージ、手動リトライで復帰する。

## WS 本番切替チェックリスト

### 切替前

- `VITE_WS_POSITIONS_URL` などエンドポイント／トークンを環境変数化。
- `VITE_WS_POSITIONS_TOKEN` を設定し、短寿命トークンを再発行できるようにする（`usePositionsLive` の `getAuthToken` でも差し替え可）。
- サーバーイベントの最小スキーマ: `type` / `positionId` / `emittedAt` / `payload.position`。
- `normaliseServerPosition` で数値文字列→number、未知フィールド破棄、modal source のみ許可。

### 切替後（ステージング）

- メトリクス監視: `ws_reconnects` / `snapshot_http_ms` / `event_queue_max`。
- `接続→スナップショット→差分` のフローが実トラフィックで成立するか確認。

## フィーチャーフラグ運用

- `featureFlags.livePositions` でライブ更新をオン／オフ。
- オフ時は従来の `positions-changed` ドメインイベントのみを使用。
- 新旧共存期間中は flag=on でも `positions-changed` を発火し、段階的に撤去する。

## 落とし穴メモ

- ソートは常に UTC の `updatedAt` で実施し、表示だけローカライズ。
- `syncPositionFromServer` は LWW（上書き安全）を前提。404 が来たら close 扱いして良い。
- 断線が続く場合はスナップショット強制取得で回復させる（指数バックオフ 1→2→4→… 最大30s）。
- モーダル以外からのデータは API 層と UI 層の二重フィルタで防弾にする。
