#!/usr/bin/env python3
"""
決済フィードバック機能のテスト
"""

import requests
import json
import base64
import os

def test_exit_feedback_endpoint():
    """決済フィードバックエンドポイントのテスト"""
    try:
        # テスト用データ準備
        image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        image_bytes = base64.b64decode(image_b64)
        
        files = {
            'file': ('test_chart.png', image_bytes, 'image/png')
        }
        
        data = {
            'trade_id': 'test_trade_001',
            'symbol': '7203.T',  # トヨタ自動車
            'entry_price': 2000.0,
            'exit_price': 2100.0,
            'position_type': 'long',
            'quantity': 100,
            'entry_date': '2024-01-15T09:00:00Z',
            'exit_date': '2024-01-15T15:00:00Z'
        }
        
        print("🧪 決済フィードバックエンドポイントテスト開始...")
        response = requests.post(
            "http://localhost:8000/api/v1/feedback/exit", 
            files=files, 
            data=data, 
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 決済フィードバックAPI呼び出し成功")
            
            if result.get('success'):
                print("✅ フィードバック生成成功")
                print(f"✅ トレード概要: {result.get('trade_summary', '')}")
                print(f"✅ 損益: {result.get('profit_loss', 0):+.0f}円")
                print(f"✅ 損益率: {result.get('profit_loss_rate', 0):+.1f}%")
                print(f"✅ 振り返り項目数: {len(result.get('reflection_items', []))}")
                print(f"✅ フィードバックHTML生成: {'あり' if result.get('feedback_html') else 'なし'}")
                
                # HTMLフィードバックの内容確認
                feedback_html = result.get('feedback_html', '')
                if feedback_html:
                    if 'トレードの振り返りポイント' in feedback_html:
                        print("✅ HTMLテンプレート: タイトル確認")
                    if 'indicator-table' in feedback_html:
                        print("✅ HTMLテンプレート: テーブル構造確認")
                    if 'feedback-section' in feedback_html:
                        print("✅ HTMLテンプレート: CSSクラス確認")
                
                return True
            else:
                print(f"❌ フィードバック生成失敗: {result.get('error_message', 'unknown')}")
                return False
        else:
            print(f"❌ API呼び出し失敗: {response.status_code}")
            print(f"   レスポンス: {response.text[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ 決済フィードバックテストエラー: {e}")
        return False

def test_feedback_status_endpoint():
    """フィードバックシステム状態テスト"""
    try:
        response = requests.get("http://localhost:8000/api/v1/feedback/status", timeout=10)
        if response.status_code == 200:
            result = response.json()
            print("✅ フィードバックシステム状態取得成功")
            print(f"   総合状態: {result.get('overall_status', 'unknown')}")
            
            details = result.get('details', {})
            print(f"   決済フィードバック: {details.get('exit_feedback', 'unknown')}")
            print(f"   GPT分析: {details.get('gpt_analysis', 'unknown')}")
            print(f"   テンプレートシステム: {details.get('template_system', 'unknown')}")
            
            return result.get('overall_status') == 'healthy'
        else:
            print(f"❌ 状態取得エラー: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 状態テストエラー: {e}")
        return False

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
        print(f"\n🎉 全テストPASS！")
        print(f"✅ 決済フィードバックシステム実装完了")
        print(f"\n📱 使用方法:")
        print(f"   1. トレード画面で建値入力（画像アップロード）")
        print(f"   2. 決済入力時に画像アップロード")
        print(f"   3. 決済完了後、自動的に構造化フィードバックが生成される")
        print(f"   4. チャット欄に振り返りテーブルと改善点が表示される")
    else:
        print(f"\n⚠️  一部のテストが失敗しました")
    
    return all_passed

if __name__ == "__main__":
    main()