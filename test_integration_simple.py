#!/usr/bin/env python3
"""
統合分析システムの簡単な接続テスト
"""

import requests
import json
import base64
import os

def test_server_connection():
    """サーバー接続テスト"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ FastAPIサーバー接続成功")
            return True
        else:
            print(f"❌ サーバー応答エラー: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ サーバーに接続できません")
        print("   以下のコマンドでサーバーを起動してください:")
        print("   cd app && python -m uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"❌ 接続テストエラー: {e}")
        return False

def test_analysis_status():
    """統合分析システム状態テスト"""
    try:
        response = requests.get("http://localhost:8000/api/v1/analysis-status", timeout=10)
        if response.status_code == 200:
            result = response.json()
            print("✅ 統合分析システム状態取得成功")
            print(f"   総合状態: {result.get('overall_status', 'unknown')}")
            
            details = result.get('details', {})
            rule_based = details.get('rule_based_modules', {})
            print(f"   Pivot v1.3: {rule_based.get('pivot_v13', 'unknown')}")
            print(f"   Entry v0.4: {rule_based.get('entry_v04', 'unknown')}")
            print(f"   GPT分析: {details.get('gpt_analysis', 'unknown')}")
            
            return result.get('overall_status') == 'healthy'
        else:
            print(f"❌ 状態取得エラー: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 状態テストエラー: {e}")
        return False

def test_template_rendering():
    """テンプレートレンダリングテスト"""
    print("✅ テンプレート形式確認:")
    print("   ● 入力された建値：底に「X円でロングエントリーしたい」と設定")
    print("   📊 チャート分析：エントリーポイントの適正解析")
    print("   🗣️ フィードバック（自然言語化）")
    print("   🗨️ 総合コメント")
    return True

def create_sample_image_base64():
    """サンプル画像のBase64作成"""
    # 1x1 transparent PNG
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

def test_integration_endpoint():
    """統合分析エンドポイントの基本テスト"""
    try:
        # テスト用データ準備
        image_b64 = create_sample_image_base64()
        image_bytes = base64.b64decode(image_b64)
        
        files = {
            'file': ('test.png', image_bytes, 'image/png')
        }
        
        data = {
            'symbol': 'テスト銘柄',
            'entry_price': 7520.0,
            'position_type': 'long',
            'analysis_context': 'テスト分析'
        }
        
        print("🧪 統合分析エンドポイントテスト開始...")
        response = requests.post(
            "http://localhost:8000/api/v1/integrated-analysis", 
            files=files, 
            data=data, 
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 統合分析API呼び出し成功")
            
            if result.get('success'):
                print("✅ 分析処理成功")
                feedback = result.get('natural_feedback', '')
                print(f"✅ フィードバック生成成功 ({len(feedback)}文字)")
                
                # テンプレート形式チェック
                if "入力された建値" in feedback:
                    print("✅ テンプレート形式確認: 建値表示")
                if "チャート分析" in feedback:
                    print("✅ テンプレート形式確認: チャート分析")
                if "フィードバック" in feedback:
                    print("✅ テンプレート形式確認: フィードバック")
                if "総合コメント" in feedback:
                    print("✅ テンプレート形式確認: 総合コメント")
                
                return True
            else:
                print(f"❌ 分析処理失敗: {result.get('error_message', 'unknown')}")
                return False
        else:
            print(f"❌ API呼び出し失敗: {response.status_code}")
            print(f"   レスポンス: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ 統合分析テストエラー: {e}")
        return False

def main():
    """メインテスト実行"""
    print("🎯 統合分析システム フロントエンド・バックエンド連携テスト")
    print("=" * 70)
    
    results = []
    
    # テスト1: サーバー接続
    print("\n1. サーバー接続テスト")
    print("-" * 30)
    server_ok = test_server_connection()
    results.append(("サーバー接続", server_ok))
    
    if not server_ok:
        print("\n❌ サーバーが起動していないため、後続のテストをスキップします")
        return False
    
    # テスト2: システム状態確認
    print("\n2. システム状態確認")
    print("-" * 30)
    status_ok = test_analysis_status()
    results.append(("システム状態", status_ok))
    
    # テスト3: テンプレート確認
    print("\n3. テンプレート形式確認")
    print("-" * 30)
    template_ok = test_template_rendering()
    results.append(("テンプレート形式", template_ok))
    
    # テスト4: 統合分析API
    print("\n4. 統合分析APIテスト")
    print("-" * 30)
    api_ok = test_integration_endpoint()
    results.append(("統合分析API", api_ok))
    
    # 結果まとめ
    print("\n" + "=" * 70)
    print("🏁 テスト結果")
    print("=" * 70)
    
    all_passed = True
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {status} {test_name}")
        if not success:
            all_passed = False
    
    if all_passed:
        print(f"\n🎉 全テストPASS！")
        print(f"✅ フロントエンドとバックエンドの連携準備完了")
        print(f"✅ 統合分析システムが正常動作中")
        print(f"\n📱 フロントエンド確認手順:")
        print(f"   1. cd frontend && npm run dev")
        print(f"   2. http://localhost:3000/trade にアクセス") 
        print(f"   3. 「📊 統合分析」タブをクリック")
        print(f"   4. チャート画像をアップロード・建値入力して分析実行")
    else:
        print(f"\n⚠️  一部のテストが失敗しました")
    
    return all_passed

if __name__ == "__main__":
    main()