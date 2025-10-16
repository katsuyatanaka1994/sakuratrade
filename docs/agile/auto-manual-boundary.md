# AUTO/MANUAL 境界（最小ルール）
- **AUTO**: ツールが再生成する範囲（人は直接編集しない）
  - docs/specs/openapi.yaml
  - docs/tests/**（雛形）
- **MANUAL**: 人が恒常的に編集する範囲
  - docs/agile/**
  - README.md
- **マーカー**
  - Markdown: <!-- AUTO-START --> ... <!-- AUTO-END -->
  - YAML:     # AUTO-START ... # AUTO-END
