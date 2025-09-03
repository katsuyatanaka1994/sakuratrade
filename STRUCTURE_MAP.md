# 構造マップ（変更前提の合意文書）

## 1. 全体概要（1ページ要約）
- 技術スタック: Frontend=Vite+TypeScript+React+Tailwind、Backend=FastAPI+Pydantic+SQLAlchemy、DB=PostgreSQL（非同期: asyncpg, 同期: psycopg2）
- 実行/ビルド/テスト/Lint（抽出）
  - Frontend `frontend/package.json` scripts:
    - start: `npx react-scripts start`（CRA由来。Vite導入と混在のため注意）
    - build: `npx react-scripts build`
    - test: `npx react-scripts test`
    - lint: なし（ESLintは設定済みだが script 未定義）
  - Backend `README.md`/実行例:
    - 開発起動: `uvicorn app.main:app --reload`
  - Docker Compose（開発）: `docker-compose up`（ports: FE=3001→3000, BE=8000, DB=5432）
- デプロイ/ランタイム前提
  - ポート: Backend 8000, Frontend 3000（compose 3001:3000）、DB 5432
  - 環境変数キー名（値は記載しない）
    - ルート `.env`: DATABASE_URL, JWT_SECRET_KEY, DATABASE_URL_SYNC, OPENAI_API_KEY
    - Frontend `frontend/.env`: WDS_SOCKET_HOST, WDS_SOCKET_PORT, REACT_APP_WDS_SOCKET_PORT, CHOKIDAR_USEPOLLING, FAST_REFRESH, GENERATE_SOURCEMAP, WATCHPACK_POLLING
    - Backend利用（コードから参照）: OPENAI_API_KEY, DATABASE_URL, DATABASE_URL_SYNC

## 2. ディレクトリ構成ツリー（主要のみ）
```
./
├─ app/
│  ├─ main.py                # FastAPIエントリ
│  ├─ database.py            # 同期/非同期Session, engine
│  ├─ models.py              # SQLAlchemyモデル（Chat/ChatMessage等）
│  ├─ models/                # 追加モデル（TradeJournal）
│  │  └─ journal.py
│  ├─ routers/               # FastAPI ルーター群
│  │  ├─ advice.py, ai.py, analyze.py, images.py
│  │  ├─ chats.py, journal.py
│  │  └─ integrated_advice.py, exit_feedback.py
│  ├─ schemas/               # Pydantic スキーマ
│  │  ├─ chat_message.py, journal.py, indicators.py
│  │  └─ exit_feedback.py, indicator_facts.py など
│  └─ services/              # 業務ロジック
├─ alembic/
│  ├─ env.py, script.py.mako
│  └─ versions/
│     ├─ 075da8..._add_chat_and_chat_messages_tables.py
│     └─ 2f8dbe..._fix_trade_id_to_int_and_related_fks.py
├─ frontend/
│  ├─ package.json, tsconfig*.json, tailwind.config.js, eslint.config.js
│  └─ src/
│     ├─ main.tsx, App.tsx
│     ├─ components/
│     │  ├─ positions/RightPanePositions.tsx  # PositionCard を内包
│     │  ├─ EditEntryModal.tsx, PositionContextMenu.tsx
│     │  └─ UI/*, Dashboard.tsx, Trade.tsx 等
│     ├─ lib/ (api, telemetry, retry, aiRegeneration, botMessaging)
│     ├─ store/positions.ts  # ローカル状態/永続化
│     └─ utils/positionCalculations.ts
├─ docker-compose.yml
├─ README.md
└─ .env / frontend/.env
```

## 3. フロントエンド構造
### 3.1 ルーティング表
| パス | コンポーネント | レイアウト/ガード |
|---|---|---|
| `/` | `<Navigate to="/login"/>` | - |
| `/login` | `Login` | ヘッダー非表示（App.tsx内制御） |
| `/onboarding` | `Onboarding` | ヘッダー非表示 |
| `/dashboard` | `Dashboard` | ヘッダー表示 |
| `/trade` | `Trade` | ヘッダー表示、右ペインに`RightPanePositions` |
| `/settings` | `Settings` | ヘッダー表示 |
| `/support` | `Support` | ヘッダー表示 |
| `*` | `<Navigate to="/login"/>` | - |

出典: `frontend/src/App.tsx:L40-59`

### 3.2 主要コンポーネントの責務表
| ファイル | 役割 | 主要 props/状態 | 外部依存 |
|---|---|---|---|
| `components/positions/RightPanePositions.tsx` | 選択チャットのオープンポジション一覧・グルーピング表示 | props: `chatId?`; state: `groups` | `store/positions.getGroups/subscribe`, `useSymbolSuggest`, `formatLSHeader` |
| （同ファイル内）PositionCard | 単一ポジションのカード表示・編集UI | props: `p:Position`, `chatId?`, `findByCode`, `onPositionUpdate?`; state: `showContextMenu`, `contextMenuPosition`, `showEditModal`, `editModalLoading`, `positionMetrics`, `isUpdating` | `utils/positionCalculations`, `lib/botMessaging`, `lib/aiRegeneration`, `lib/retryLogic`, `lib/errorHandling`, `telemetryHelpers`, `EditEntryModal`, `PositionContextMenu` |
| `components/EditEntryModal.tsx` | 建値編集モーダル。PATCH保存（楽観ロック409対応）/再取得・トースト/テレメトリ | props: `initialData(positionId, version, ...)`, `onSave`, `onUpdateSuccess`; state: バナー/ローディング/競合モード | `lib/api/positions.updatePositionEntry/fetchPositionById`, `errorHandling`, `sentryIntegration`, `telemetryHelpers` |
| `store/positions.ts` | ポジションのローカル状態管理（Map+localStorage）、建玉・決済、ジャーナル送信 | API: `entry`, `settle`, `getGroups`, `submitJournalEntry` | `localStorage`, `fetch('/journal/close')` |
| `lib/botMessaging.ts` | Bot向け2件投稿（ユーザー更新/システムプラン）生成・送信 | `sendPositionUpdateMessages` | `fetch('/api/bot/message')`（バックエンド未実装の仮API） |
| `lib/aiRegeneration.ts` | 画像検索→AI再分析→直前AI置換（失敗時テレメトリ） | `fetch('/api/chat/...')`, `fetch('/api/ai/analyze')`（仮API） | - |

補足: PositionCardは`RightPanePositions.tsx:L32-136, L140-378, L380-859`に定義（内製コンポーネント）。

### 3.3 UIトークン/設計規約
- Tailwind 設定: `tailwind.config.js` は拡張なし（`theme.extend = {}`）。ユーティリティは標準スケール。
- カラー傾向: `gray-50/100/200/600/900`, `red-100/200/600/700`, `emerald-100/200/600`, `blue-500/700` を多用（PositionCardのラベル/ボタン/バナー）。
- 間隔/角丸: `rounded-xl`/`rounded-full`、`px-4 py-1.5` 等。カード影: `shadow-sm` + 手動 boxShadow。
- コンポーネント規約: Radix + 自作UI（`components/UI/*`）。フォームは `react-hook-form`+`zod` バリデーション。

### 3.4 状態管理
- ローカル状態: 各コンポーネントの`useState`/`useEffect`。
- グローバル（軽量）: `store/positions.ts` 内の `state`（Map, Array）+ `subscribe()` による購読。永続化は `localStorage` キー（positions/closed/tradeEntries/failed_journal_queue）。
- 外部ストア/Redux等: なし。

### 3.5 イベントフロー（PositionCardの編集→モーダル→API呼出→再描画）
1) ユーザー操作
- 右上の編集ボタン押下/ロングプレス → コンテキストメニュー表示 → 「編集」を選択（`handleEditClick`/`handleLongPressStart`）
- PositionCard → `EditEntryModal` を `isOpen=true` で開く（`handleEditModalOpen`）。

2) モーダル保存
- `EditEntryModal` で `PATCH /positions/{id}/entry` を実行（楽観ロック: `version` 必須）。409時は`fetchPositionById`で最新version再取得→バナー表示（`entry-edit-conflict`）→再送可。
- 成功時 `onUpdateSuccess(updatedPosition)` を発火 → PositionCardの`handlePositionUpdateSuccess`へ。

3) 成功後の副作用（PositionCard内）
- 再計算: `calculatePositionMetrics(updatedPosition)` で損益/目標更新→state反映。
- Bot投稿2件: `sendPositionUpdateMessages(chatId, position, updateDiff, metrics)` を順序保証で送信（ユーザー更新→システムプラン）。失敗時 `classifyError`→`showRetryToast(..., 'bot_messages')`。
- AI再分析: `regeneratePositionAnalysis(chatId, updatedPosition)` 実行。画像なしや失敗時は `classifyError`→`showRetryToast(..., 'ai_regeneration')`。
- テレメトリ: `gtag('entry_edit_saved')` 送信。

4) 画面更新
- PositionCard内 state 更新と親への `onPositionUpdate` 通知。必要に応じ `store/positions` 側（別経路）でも永続化。

注意: Bot/AI/API は一部モックURL（未実装）を参照（後述の仮説/差分参照）。

## 4. バックエンド構造
### 4.1 API一覧表
| メソッド | パス | エンドポイント関数 | リクエスト/レスポンス概要 |
|---|---|---|---|
| GET | `/health` | `main.health` | 200 `{status:"ok"}` |
| GET | `/images` | `routers.images.list_images` | 画像メタ一覧（現在は空配列） |
| POST | `/images` | `routers.images.create_image` | ImageスキーマEcho+ID/日時補完 |
| POST | `/images/upload` | `routers.images.upload_image` | 画像保存→`/static/uploaded_images/...` を返却 |
| POST | `/analyze/chart` | `routers.analyze.analyze_chart_image` | OpenAI VisionでJSON様分析を返却（文字列） |
| POST | `/advice` | `routers.advice.advice` | 価格/テキスト/画像入力で助言生成。チャット履歴更新 |
| POST | `/ai/reply` | `routers.ai.generate_ai_reply` | モックのAI返信生成、ChatMessageへINSERT |
| POST | `/chats/` | `routers.chats.create_chat` | Chat作成（id発行） |
| DELETE | `/chats/{chat_id}` | `routers.chats.delete_chat` | ソフトデリート（deleted_at設定） |
| GET | `/chats/` | `routers.chats.list_chats` | チャット一覧（更新順） |
| POST | `/chats/{chat_id}/restore` | `routers.chats.restore_chat` | ソフトデリート復元 |
| POST | `/chats/{chat_id}/messages` | `routers.chats.create_message` | TEXT/ENTRY/EXIT の作成（payload可） |
| PATCH | `/chats/messages/{message_id}` | `routers.chats.update_message` | メッセージ編集（ENTRY決済済は将来禁止） |
| GET | `/chats/{chat_id}/messages` | `routers.chats.get_messages` | メッセージ一覧（limit/offset） |
| POST | `/api/v1/integrated-analysis` | `routers.integrated_advice.integrated_analysis` | 画像+文脈入力→統合分析（rule+GPT）返却 |
| POST | `/api/v1/quick-analysis` | `routers.integrated_advice.quick_analysis` | GPTのみ軽量解析 |
| GET | `/api/v1/analysis-status` | `routers.integrated_advice.analysis_status` | 各サブシステム稼働状況 |
| POST | `/api/v1/test-integration` | `routers.integrated_advice.test_integration` | 統合経路の自己テスト |
| POST | `/api/v1/feedback/exit` | `routers.exit_feedback.generate_exit_feedback` | 決済情報→フィードバックHTML/構造化返却 |
| GET | `/api/v1/feedback/status` | `routers.exit_feedback.feedback_status` | 稼働状況 |

組込: `app/main.py:L23-41` で各router登録。`/api/v1` は integrated_advice / exit_feedback に付与。

### 4.2 モデル/スキーマ対応表
| SQLAlchemyモデル | 主キー/外部キー | 対応Pydantic | 用途 |
|---|---|---|---|
| `models.Chat` | PK:`id` | -（直接返却は現状なし） | チャットメタ（ソフトデリート対応） |
| `models.ChatMessage` | PK:`id`, FK:`chat_id→chats.id` | `schemas.chat_message.ChatMessageCreate/Update/Response` | メッセージ保存（TEXT/ENTRY/EXIT）。更新時409相当はアプリ側で判定予定 |
| `models.TradeJournal`（app/models.py） | PK:`trade_id` | `schemas.journal.*` | 取引クローズ時のジャーナル（feedback/analysis含む） |
| `app/models/journal.TradeJournal` | 同上（定義重複。片方へ統合推奨） | 同 | 同 |

補足: `alembic/versions/075da8...` にて `chats`/`chat_messages` 作成・index付与。

### 4.3 例外/バリデーション/依存
- 依存注入: `Depends(get_async_db)` により `AsyncSession` をルータへ供給（`app/database.py:L20-37`）。
- バリデーション: Pydantic v2系。`schemas.chat_message` の `Union` 型でENTRY/EXIT payloadを厳格化。
- 例外方針: 業務上の見つからない/権限などは `HTTPException(status_code=404/409/500)` を適宜送出。
- メッセージ編集の特殊ルール: ENTRYの「決済済み禁止」判定は未実装スタブ（`routers.chats._is_entry_settled`）。

## 5. FE↔BE データ契約マップ
| 画面/イベント | 呼び出すAPI | 使用スキーマ/型 | 入出力フィールド型（抜粋） |
|---|---|---|---|
| 画像アップロード（Trade） | POST `/images/upload` | req: `multipart file` | in: file(binary); out: `{filename:string, url:string}` |
| チャート画像解析（軽量） | POST `/analyze/chart` | - | in: `image`; out: `{analysis:string}`（AIのテキスト） |
| アドバイス生成（テキスト/画像） | POST `/advice` | `schemas.indicator_facts.IndicatorFacts`（一部） | in: `message:string`, `file:image` 等; out: `{message:string, ...}` |
| チャット作成/一覧/復元/削除 | `/chats` 系 | `models.Chat`相当 | in/out: `id:string`, `name:string`, `timestamps` |
| メッセージ作成 | POST `/chats/{id}/messages` | `schemas.chat_message.ChatMessageCreate` | in: `type: 'TEXT'|'ENTRY'|'EXIT'`, `text?`, `payload?`; out: `ChatMessageResponse` |
| メッセージ更新（編集） | PATCH `/chats/messages/{message_id}` | `schemas.chat_message.ChatMessageUpdate` | in: `type`, `text?`, `payload?`; out: `ChatMessageResponse` |
| 統合分析（画像+ルール+GPT） | POST `/api/v1/integrated-analysis` | `schemas.indicators.AnalysisResponse` | in: `file`, `symbol?`, `entry_price?`, `position_type?`; out: `success:boolean, analysis:TradingAnalysis?` |
| 決済フィードバック | POST `/api/v1/feedback/exit` | `schemas.exit_feedback.ExitFeedbackRequest/Response` | in: `symbol, entry_price:number, exit_price:number, position_type:enum, quantity:int, file?`; out: `feedback_html:string` 等 |
| 取引クローズ（自動ジャーナル） | POST `/journal/close` | `schemas.journal.JournalClosePayload` | in: `trade_id, side:'LONG'|'SHORT', avg_entry:number, ...`★versionなし |

注意/差分（要整合）
- FEが参照する未実装API（モックURL）: `/api/bot/message`, `/api/chat/{id}/images/recent`, `/api/chat/{id}/messages/recent`, `/api/ai/analyze`, `/api/positions/*`。破壊的変更/統合時の衝突リスクが高い。★
- Position編集の正式APIは現BEに未実装。FEは`PATCH /positions/{id}/entry`（楽観ロック`version`）を前提。★

## 6. ビルド・テスト・品質管理
- npm scripts（FE）: start/build/test は CRA 用。Vite プラグイン/設定は存在（`vite`/`@vitejs/plugin-react`/`vitest`）だが scripts 未連携。
- 型チェック: TypeScript strict 強め（`frontend/tsconfig.app.json`: `strict`, `noUnused*`, `noUncheckedSideEffectImports` など）。
- ESLint: `eslint.config.js` で `@eslint/js`/`typescript-eslint`/`react-hooks`/`react-refresh` 推奨構成。
- テスト: 
  - FE: `frontend/src/components/__tests__/*`, `frontend/src/lib/__tests__/*`（UI/ロジック単体）
  - BE: ルートに pytest 系 `test_*` が複数（統合/API/exit_feedback 等）
- カバレッジ観点（相対的）
  - 薄い: BEの`/advice`周辺の外部API失敗時分岐、`/chats`の権限/整合性、画像/AIモックAPI群との連携部。
  - 厚め: FEの位置計算/トースト・編集フローの単体テスト。

## 7. 変更時のガードレール
- 壊れやすい箇所 Best 5
  1) FEのPosition編集API契約（PATCH /positions）★: 現BE未実装。導入時は409/version/差分レスポンスのI/Fを固定化すること。
  2) Bot/AIモックAPI群★: `/api/bot/message`, `/api/ai/analyze`, `/api/chat/...` をBEで提供しないと、PositionCard成功フロー後の再試行/トースト整合が崩れる。
  3) ChatMessage編集の業務制約: ENTRYの「決済済み編集禁止」ロジックは未実装スタブ。導入時の判定仕様を先に合意すること。
  4) 二重定義`TradeJournal`（models.py と models/journal.py）: マイグレーション・CRUDの不整合リスク。どちらかへ統合。
  5) FEビルド体制（CRA/Vite混在）: scripts の整合をとる。Vite での dev/build/test へ移行計画を定義。
- 変更提案時の鉄則
  - 命名/責務分離: Position編集は`/positions`系ルータ新設、DTO（Pydantic）を`schemas/positions.py`へ分離。
  - 例外処理: 409/422/5xx のメッセージを FE の `classifyError` マップに合わせる（コード/フィールドを含む詳細）。
  - UIトークン: Tailwind色/間隔の既存スケール準拠。独自拡張は`tailwind.config.js`経由に限定。
  - テレメトリ: 既存の `gtag` イベント名を活かす（`plan_bot_sent`, `entry_edit_*`）。

## 8. 既知の未確定/仮説
- 仮説: Position編集APIは未実装
  - 根拠: FEが `PATCH /positions/{id}/entry` を呼ぶ（`frontend/src/lib/api/positions.ts:L33-82`）が、BEに`routers/positions.py`等が存在しない。
- 仮説: Bot/AI関連エンドポイントは未実装
  - 根拠: `lib/botMessaging.ts` が `/api/bot/message` をPOST（`frontend/src/lib/botMessaging.ts:L88-121`）、`lib/aiRegeneration.ts` が `/api/chat/...` と `/api/ai/analyze` を参照（`frontend/src/lib/aiRegeneration.ts:L36-79, L99-139, L174-214`）が、該当BEルートが見当たらない。
- 仮説: TradeJournalモデルの二重定義
  - 根拠: `app/models.py:L77-123` と `app/models/journal.py:L1-39` に同名テーブル定義が併存。
- 仮説: FEビルドはVite想定だがscriptsはCRA
  - 根拠: `frontend/package.json` に `vite`/`vitest` 依存ありつつ scripts が `react-scripts`（`frontend/package.json:L5-13`）。
- 仮説: 画像解析APIの安定化未完了
  - 根拠: `/analyze/chart` の返却がAI応答テキスト（JSON風文字列）で型が流動的（`app/routers/analyze.py:L34-70`）。

以上。上記は現状構造の写像であり、変更合意の起点とする。
