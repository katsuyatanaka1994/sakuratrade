"""Utility to export selected Pydantic models as JSON Schema documents."""

from __future__ import annotations

import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModelTarget:
    module_path: Path
    symbol: str

    def load(self) -> type:
        spec = importlib.util.spec_from_file_location(self.symbol, self.module_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load module for {self.module_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)  # type: ignore[assignment]
        try:
            model = getattr(module, self.symbol)
        except AttributeError as exc:  # noqa: BLE001
            msg = f"{self.symbol} not found in {self.module_path}"
            raise ImportError(msg) from exc
        return model


BASE_DIR = Path(__file__).resolve().parent.parent

MODELS_TO_EXPORT: dict[str, ModelTarget] = {
    "TradeIn": ModelTarget(BASE_DIR / "app" / "schemas" / "trade.py", "TradeIn"),
    "TradeOut": ModelTarget(BASE_DIR / "app" / "schemas" / "trade.py", "TradeOut"),
}


def export_models(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    exported_files: list[Path] = []

    for name, target in MODELS_TO_EXPORT.items():
        model_cls = target.load()
        schema = model_cls.model_json_schema()  # type: ignore[attr-defined]
        target_path = output_dir / f"{name}.schema.json"
        target_path.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        exported_files.append(target_path)

    return exported_files


def main() -> None:
    output_dir = BASE_DIR / "docs" / "schema_exports"
    exported = export_models(output_dir)
    for path in exported:
        print(f"Exported {path.relative_to(BASE_DIR)}")


if __name__ == "__main__":
    main()
