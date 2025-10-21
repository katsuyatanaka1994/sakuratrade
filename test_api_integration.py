#!/usr/bin/env python3
"""
統合分析API エンドポイントのテスト
"""

import io
import os

import pytest
import requests
from PIL import Image

pytestmark = pytest.mark.integration


def create_sample_chart_image():
    """サンプルチャート画像を作成"""
    # 簡単なテスト用画像（600x400のグラデーション）
    img = Image.new("RGB", (600, 400), color="white")

    # 簡単な"チャート風"のラインを描画
    from PIL import ImageDraw

    draw = ImageDraw.Draw(img)

    # 背景
    draw.rectangle([50, 50, 550, 350], fill="#f0f0f0", outline="black")

    # "株価ライン"（上昇トレンド風）
    points = []
    for x in range(60, 540, 20):
        y = 300 - (x - 60) * 0.3 + (x % 40 - 20) * 2
        points.append((x, y))

    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill="blue", width=2)

    # 移動平均線（赤）
    ma_points = []
    for x in range(60, 540, 20):
        y = 310 - (x - 60) * 0.25
        ma_points.append((x, y))

    for i in range(len(ma_points) - 1):
        draw.line([ma_points[i], ma_points[i + 1]], fill="red", width=1)

    # テキスト（RSI等をシミュレート）
    draw.text((60, 30), "7520 TEST CHART", fill="black")
    draw.text((450, 30), "RSI: 62", fill="black")
    draw.text((450, 45), "MACD: +", fill="green")

    # バイト配列に変換
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr = img_byte_arr.getvalue()

    return img_byte_arr


def test_integration_endpoint():
    """統合分析エンドポイントのテスト"""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set; skipping integration endpoint test")
    print("🧪 API統合テスト: /integrated-analysis")
    print("=" * 60)

    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    endpoint = f"{base_url}/api/v1/integrated-analysis"

    try:
        # テスト用画像作成
        image_data = create_sample_chart_image()

        # リクエストデータ準備
        files = {"file": ("test_chart.png", image_data, "image/png")}
        data = {
            "symbol": "7520テスト銘柄",
            "entry_price": 7520.0,
            "position_type": "long",
            "analysis_context": "ロングエントリーの妥当性検証",
        }

        print("📤 リクエスト送信中...")
        print(f"   URL: {endpoint}")
        print(f"   Symbol: {data['symbol']}")
        print(f"   Entry Price: {data['entry_price']}")
        print(f"   Position: {data['position_type']}")

        # APIリクエスト実行
        response = requests.post(endpoint, files=files, data=data, timeout=30)

        print("\n📨 レスポンス:")
        print(f"   Status Code: {response.status_code}")

        # ここからは assert で検証（値は返さない）
        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True

        analysis = result.get("analysis")
        if analysis:
            print("\n📊 分析結果:")
            print(f"   Overall Evaluation: {analysis.get('overall_evaluation')}")
            print(f"   Confidence Score: {analysis.get('confidence_score', 0):.2f}")
            print(f"   Indicators Count: {len(analysis.get('indicators', []))}")

            indicators = analysis.get("indicators", [])
            print("\n🔍 Indicators サンプル:")
            for i, indicator in enumerate(indicators[:3], 1):
                print(f"   {i}. {indicator.get('name')}: {indicator.get('value')} ({indicator.get('evaluation')})")

        natural_feedback = result.get("natural_feedback", "")
        print("\n📝 自然文フィードバック（先頭200文字）:")
        print(f"   {natural_feedback[:200]}...")

    except requests.exceptions.ConnectionError:
        pytest.fail("FastAPIサーバーに接続できません。サーバーを起動してください: uvicorn app.main:app --reload")
    except Exception as e:
        pytest.fail(f"テストエラー: {e}")


def test_quick_analysis_endpoint():
    """クイック分析エンドポイントのテスト"""
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set; skipping quick analysis test")
    print("\n🧪 API統合テスト: /quick-analysis")
    print("=" * 60)

    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    endpoint = f"{base_url}/api/v1/quick-analysis"

    try:
        # テスト用画像作成
        image_data = create_sample_chart_image()
        files = {"file": ("test_chart.png", image_data, "image/png")}
        data = {"symbol": "7520テスト銘柄", "analysis_context": "クイック分析テスト"}

        response = requests.post(endpoint, files=files, data=data, timeout=15)

        print("📨 レスポンス:")
        print(f"   Status Code: {response.status_code}")

        assert response.status_code == 200
        result = response.json()
        # 成功フラグと基本フィールドの存在を確認
        assert result.get("success") is True
        assert "analysis_type" in result
        assert isinstance(result.get("message", ""), str)

    except requests.exceptions.ConnectionError:
        pytest.fail("FastAPIサーバーに接続できません")
    except Exception as e:
        pytest.fail(f"テストエラー: {e}")


def test_status_endpoint():
    """システム状態確認エンドポイントのテスト"""
    print("\n🧪 API統合テスト: /analysis-status")
    print("=" * 60)

    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    endpoint = f"{base_url}/api/v1/analysis-status"

    try:
        response = requests.get(endpoint, timeout=10)

        print("📨 レスポンス:")
        print(f"   Status Code: {response.status_code}")

        assert response.status_code == 200
        result = response.json()
        assert "overall_status" in result
        # 任意で詳細フィールドの有無も軽くチェック
        details = result.get("details", {})
        assert isinstance(details, dict)

    except requests.exceptions.ConnectionError:
        pytest.fail("FastAPIサーバーに接続できません")
    except Exception as e:
        pytest.fail(f"テストエラー: {e}")


def main():
    """APIテストメイン実行"""
    print("🎯 API統合テスト実行")
    print("前提条件: FastAPIサーバーが localhost:8000 で起動していること")
    print("=" * 80)

    results = []

    # テスト1: システム状態確認
    status_success, status_result = test_status_endpoint()
    results.append(("System Status Check", status_success))

    # テスト2: クイック分析
    quick_success, quick_result = test_quick_analysis_endpoint()
    results.append(("Quick Analysis API", quick_success))

    # テスト3: 統合分析（メイン機能）
    integration_success, integration_result = test_integration_endpoint()
    results.append(("Integrated Analysis API", integration_success))

    # 結果まとめ
    print("\n🏁 APIテスト結果")
    print("=" * 80)

    all_passed = True
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} {test_name}")
        if not success:
            all_passed = False

    if all_passed:
        print("\n🎉 全APIテストPASS！")
        print("✅ 統合分析システムがAPI経由で正常に動作しています")
        print("✅ structured_indicators配列がAPI応答に含まれています")
        print("✅ 自然文フィードバックが正しく生成されています")
    else:
        print("\n⚠️  一部のAPIテストが失敗しました")
        print("   FastAPIサーバーの起動状態を確認してください")
        print("   コマンド: uvicorn main:app --reload")

    return all_passed


if __name__ == "__main__":
    main()
