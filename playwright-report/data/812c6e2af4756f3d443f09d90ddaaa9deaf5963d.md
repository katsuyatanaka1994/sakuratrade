# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e8]: SakuraTrade
        - navigation [ref=e9]:
          - button "ダッシュボード" [ref=e10] [cursor=pointer]
          - button "トレードチャット" [ref=e11] [cursor=pointer]
      - button [ref=e13] [cursor=pointer]:
        - img
  - main [ref=e14]:
    - generic [ref=e16]:
      - complementary [ref=e17]:
        - button "新規チャット 新規チャット" [ref=e19] [cursor=pointer]:
          - generic [ref=e20] [cursor=pointer]: 新規チャット
          - img "新規チャット" [ref=e21] [cursor=pointer]
        - heading "チャット一覧" [level=3] [ref=e24]
        - generic [ref=e27] [cursor=pointer]: 新規チャット 1
      - generic [ref=e36]:
        - textbox "AIに質問する..." [ref=e38]
        - generic [ref=e39]:
          - generic [ref=e40]:
            - button "建値" [ref=e41] [cursor=pointer]
            - button "決済" [ref=e42] [cursor=pointer]
          - generic [ref=e44] [cursor=pointer]:
            - img [ref=e45] [cursor=pointer]
            - generic [ref=e49] [cursor=pointer]: チャート画像をアップロード
          - button [disabled] [ref=e50]:
            - img [ref=e51]
      - generic [ref=e55]:
        - heading "オープンポジション" [level=2] [ref=e56]
        - generic [ref=e57]: ポジションはまだありません
```