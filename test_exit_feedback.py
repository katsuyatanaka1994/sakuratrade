#!/usr/bin/env python3
"""
決済フィードバック機能のテスト
"""

import base64
import os

import pytest
import requests


def test_exit_feedback_endpoint():
    """決済フィードバックエンドポイントのテスト"""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set; skipping exit feedback test")
    try:
        # テスト用データ準備
        image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        image_bytes = base64.b64decode(image_b64)

        files = {"file": ("test_chart.png", image_bytes, "image/png")}

        data = {
            "trade_id": "test_trade_001",
            "symbol": "7203.T",  # トヨタ自動車
            "entry_price": 2000.0,
            "exit_price": 2100.0,
            "position_type": "long",
            "quantity": 100,
            "entry_date": "2024-01-15T09:00:00Z",
            "exit_date": "2024-01-15T15:00:00Z",
        }

        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        endpoint = f"{base_url}/api/v1/feedback/exit"

        print("🧪 決済フィードバックエンドポイントテスト開始...")
        response = requests.post(endpoint, files=files, data=data, timeout=30)

        # ここからは assert で検証（値は返さない）
        assert response.status_code == 200, f"API呼び出し失敗: {response.status_code} {response.text[:200]}"
        result = response.json()
        assert result.get("success") is True, f"フィードバック生成失敗: {result.get('error_message', 'unknown')}"

        # HTMLフィードバックの内容確認（存在時のみ軽く検証）
        feedback_html = result.get("feedback_html", "")
        if feedback_html:
            assert "トレードの振り返りポイント" in feedback_html
            assert "indicator-table" in feedback_html
            assert "feedback-section" in feedback_html

        # 追加の基本検証
        assert isinstance(result.get("trade_summary", ""), str)
        assert isinstance(result.get("profit_loss", 0), (int, float))
        assert isinstance(result.get("profit_loss_rate", 0), (int, float))
        assert isinstance(result.get("reflection_items", []), list)

    except Exception as e:
        pytest.fail(f"決済フィードバックテストエラー: {e}")


def test_feedback_status_endpoint():
    """フィードバックシステム状態テスト"""
    try:
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        endpoint = f"{base_url}/api/v1/feedback/status"
        response = requests.get(endpoint, timeout=10)
        assert response.status_code == 200, f"状態取得エラー: {response.status_code}"
        result = response.json()

        # 必須キーの存在と型をチェック
        assert "overall_status" in result
        assert isinstance(result.get("details", {}), dict)

    except Exception as e:
        pytest.fail(f"状態テストエラー: {e}")


def main():
    """メインテスト実行"""
    print("🎯 決済フィードバックシステム テスト")
    print("=" * 60)

    results = []

    # テスト1: システム状態確認
    print("\n1. システム状態確認")
    print("-" * 30)
    status_ok = test_feedback_status_endpoint()
    results.append(("システム状態", status_ok))

    # テスト2: 決済フィードバックAPI
    print("\n2. 決済フィードバックAPIテスト")
    print("-" * 30)
    feedback_ok = test_exit_feedback_endpoint()
    results.append(("決済フィードバックAPI", feedback_ok))

    # 結果まとめ
    print("\n" + "=" * 60)
    print("🏁 テスト結果")
    print("=" * 60)

    all_passed = True
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} {test_name}")
        if not success:
            all_passed = False

    if all_passed:
        print("\n🎉 全テストPASS！")
        print("✅ 決済フィードバックシステム実装完了")
        print("\n📱 使用方法:")
        print("   1. トレード画面で建値入力（画像アップロード）")
        print("   2. 決済入力時に画像アップロード")
        print("   3. 決済完了後、自動的に構造化フィードバックが生成される")
        print("   4. チャット欄に振り返りテーブルと改善点が表示される")
    else:
        print("\n⚠️  一部のテストが失敗しました")

    return all_passed


if __name__ == "__main__":
    main()
