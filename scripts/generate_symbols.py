#!/usr/bin/env python3
"""
JPXのExcelファイルから symbols.json を生成するスクリプト

使用方法:
1. JPXのサイトから「データ活用」→「基本情報」→「上場銘柄一覧」のExcelをダウンロード
2. python generate_symbols.py <path/to/excel_file.xlsx>
"""

import argparse
import json
import re
from pathlib import Path

import jaconv
import pandas as pd


def normalize_sector(sector):
    """業種名を正規化"""
    if not sector or pd.isna(sector):
        return ""
    return str(sector).strip()


def to_romaji_simple(name):
    """簡単なローマ字変換（カタカナ→ローマ字）"""
    # 基本的なカタカナ→ローマ字マッピング
    kana_to_romaji = {
        "ア": "a",
        "イ": "i",
        "ウ": "u",
        "エ": "e",
        "オ": "o",
        "カ": "ka",
        "キ": "ki",
        "ク": "ku",
        "ケ": "ke",
        "コ": "ko",
        "サ": "sa",
        "シ": "shi",
        "ス": "su",
        "セ": "se",
        "ソ": "so",
        "タ": "ta",
        "チ": "chi",
        "ツ": "tsu",
        "テ": "te",
        "ト": "to",
        "ナ": "na",
        "ニ": "ni",
        "ヌ": "nu",
        "ネ": "ne",
        "ノ": "no",
        "ハ": "ha",
        "ヒ": "hi",
        "フ": "fu",
        "ヘ": "he",
        "ホ": "ho",
        "マ": "ma",
        "ミ": "mi",
        "ム": "mu",
        "メ": "me",
        "モ": "mo",
        "ヤ": "ya",
        "ユ": "yu",
        "ヨ": "yo",
        "ラ": "ra",
        "リ": "ri",
        "ル": "ru",
        "レ": "re",
        "ロ": "ro",
        "ワ": "wa",
        "ヲ": "wo",
        "ン": "n",
        "ガ": "ga",
        "ギ": "gi",
        "グ": "gu",
        "ゲ": "ge",
        "ゴ": "go",
        "ザ": "za",
        "ジ": "ji",
        "ズ": "zu",
        "ゼ": "ze",
        "ゾ": "zo",
        "ダ": "da",
        "ヂ": "di",
        "ヅ": "du",
        "デ": "de",
        "ド": "do",
        "バ": "ba",
        "ビ": "bi",
        "ブ": "bu",
        "ベ": "be",
        "ボ": "bo",
        "パ": "pa",
        "ピ": "pi",
        "プ": "pu",
        "ペ": "pe",
        "ポ": "po",
        "ャ": "ya",
        "ュ": "yu",
        "ョ": "yo",
        "ッ": "",
        "ー": "",
    }

    result = ""
    for char in name:
        if char in kana_to_romaji:
            result += kana_to_romaji[char]
        elif char.isalpha():
            result += char.lower()
        elif char == " ":
            result += " "

    return result.strip()


def extract_kana_from_name(name):
    """銘柄名からカタカナ部分を抽出"""
    if not name:
        return ""

    # カタカナのみを抽出
    kana_match = re.findall(r"[ァ-ヶー]+", name)
    if kana_match:
        return "".join(kana_match)

    # ひらがながあればカタカナに変換
    hiragana_match = re.findall(r"[ぁ-ゖ]+", name)
    if hiragana_match:
        return jaconv.hira2kata("".join(hiragana_match))

    return ""


def normalize_market_name(market):
    """市場名を正規化"""
    if not market or pd.isna(market):
        return ""

    market_mapping = {
        "プライム": "プライム",
        "スタンダード": "スタンダード",
        "グロース": "グロース",
        "PRIME": "プライム",
        "STANDARD": "スタンダード",
        "GROWTH": "グロース",
        "prime": "プライム",
        "standard": "スタンダード",
        "growth": "グロース",
    }

    market_str = str(market).strip()
    return market_mapping.get(market_str, market_str)


def generate_symbols_json(excel_path, output_path=None):
    """ExcelファイルからJSONを生成"""

    if not Path(excel_path).exists():
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    print(f"Reading Excel file: {excel_path}")

    # Excelファイルを読み込み（複数シートを確認）
    try:
        xl = pd.ExcelFile(excel_path)
        print(f"Available sheets: {xl.sheet_names}")

        # 通常は最初のシートか、「上場銘柄一覧」のようなシート名
        sheet_name = xl.sheet_names[0]
        for name in xl.sheet_names:
            if "上場" in name or "銘柄" in name or "list" in name.lower():
                sheet_name = name
                break

        print(f"Using sheet: {sheet_name}")
        df = pd.read_excel(excel_path, sheet_name=sheet_name)

    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return False

    print(f"Total rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")

    # 列名をマッピング（JPXのExcelファイルの実際の列名に基づく）
    column_mapping = {}
    for col in df.columns:
        if col == "コード":
            column_mapping["code"] = col
        elif col == "銘柄名":
            column_mapping["name"] = col
        elif col == "市場・商品区分":
            column_mapping["market"] = col
        elif col == "33業種区分":
            column_mapping["sector33"] = col
        elif col == "17業種区分":
            column_mapping["sector17"] = col

    print(f"Column mapping: {column_mapping}")

    # 必須カラムのチェック
    if "code" not in column_mapping or "name" not in column_mapping:
        print("Error: Required columns (code, name) not found")
        print("Available columns:", list(df.columns))
        return False

    symbols = []
    processed_count = 0

    for idx, row in df.iterrows():
        try:
            # 証券コードを取得・正規化
            code = str(row[column_mapping["code"]]).strip()
            if not code or code == "nan" or len(code) != 4 or not code.isdigit():
                continue

            # 銘柄名を取得
            name = str(row[column_mapping["name"]]).strip()
            if not name or name == "nan":
                continue

            # 市場・商品区分でフィルタ（内国株式のみ）
            market_info = str(row[column_mapping["market"]]).strip()
            if "内国株式" not in market_info:
                continue

            # カタカナとローマ字を生成
            kana = extract_kana_from_name(name)
            romaji = to_romaji_simple(kana) if kana else ""

            # 市場名を取得・正規化
            market = ""
            if "market" in column_mapping:
                market = normalize_market_name(row[column_mapping["market"]])

            # 業種情報を取得
            sector33 = ""
            if "sector33" in column_mapping:
                sector33 = normalize_sector(row[column_mapping["sector33"]])

            sector17 = ""
            if "sector17" in column_mapping:
                sector17 = normalize_sector(row[column_mapping["sector17"]])

            symbol_data = {
                "code": code,
                "name": name,
                "market": market,
                "kana": kana,
                "romaji": romaji,
                "sector33": sector33,
                "sector17": sector17,
                "product": "株式",
                "ticker": f"{code}.T",
            }

            symbols.append(symbol_data)
            processed_count += 1

        except Exception as e:
            print(f"Error processing row {idx}: {e}")
            continue

    print(f"Processed {processed_count} symbols")

    if not symbols:
        print("No valid symbols found")
        return False

    # 出力パスの決定
    if not output_path:
        output_path = Path("frontend/public/data/symbols.json")
    else:
        output_path = Path(output_path)

    # 出力ディレクトリを作成
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # JSONファイルを書き出し
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(symbols, f, ensure_ascii=False, indent=2)

        print(f"Successfully generated {output_path}")
        print(f"Total symbols: {len(symbols)}")

        # サンプルデータを表示
        print("\nSample data:")
        for i, symbol in enumerate(symbols[:3]):
            print(f"  {i+1}. {symbol}")

        return True

    except Exception as e:
        print(f"Error writing JSON file: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate symbols.json from JPX Excel file")
    parser.add_argument("excel_file", help="Path to JPX Excel file")
    parser.add_argument("-o", "--output", help="Output JSON file path (default: frontend/public/data/symbols.json)")

    args = parser.parse_args()

    success = generate_symbols_json(args.excel_file, args.output)
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
