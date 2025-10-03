# Test stubs

テストで重くなりがちな共通依存を差し替えるための純スタブ群です。すべて同期ファクトリで定義しているため、`vi.importActual` に頼ることなく `vi.mock()` から利用できます。

- `router.tsx` – `react-router-dom` のスタブ。`resetRouterDomStub()` / `setMockLocation()` で状態操作が可能です。
- `positions.ts` – ポジションストアの軽量実装。実際の API 面をざっくり再現しつつ、`__resetPositionsStub()` で初期化できます。
- `toast.tsx` – `ToastProvider`/`useToast` のスタブ。`toastSpies.showToast` で発火回数を検証できます。
- `lucide-react.tsx` – Lucide アイコンの遅延生成スタブ。任意のアイコン名をリクエストするとダミーの SVG を返します。

使用例:

```ts
import { routerDomStub } from '@/test-utils/stubs/router';

vi.mock('react-router-dom', () => routerDomStub);
```

共通のリセットは `setupTests.ts` で呼び出すので、テスト側では必要に応じて `setMockLocation` などを使ってください。
