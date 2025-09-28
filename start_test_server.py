#!/usr/bin/env python3
"""
テスト用FastAPIサーバーを起動
"""

import os
import subprocess
import sys


def start_server():
    """FastAPIサーバーを起動"""

    # 現在のディレクトリをappディレクトリに変更
    os.chdir("app")

    print("🚀 FastAPI統合分析サーバーを起動しています...")
    print("📍 URL: http://localhost:8000")
    print("📍 API Docs: http://localhost:8000/docs")
    print("📍 統合分析エンドポイント: http://localhost:8000/api/v1/integrated-analysis")
    print("📍 システム状態: http://localhost:8000/api/v1/analysis-status")

    try:
        # uvicornでサーバー起動
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], check=True
        )
    except KeyboardInterrupt:
        print("\n🛑 サーバーを停止しています...")
    except Exception as e:
        print(f"❌ サーバー起動エラー: {e}")
        return False

    return True


if __name__ == "__main__":
    start_server()
