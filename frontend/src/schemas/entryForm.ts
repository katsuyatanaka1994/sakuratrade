import { z } from 'zod';

const chartPatternEnum = z.enum([
  'pullback-buy',
  'retest-short',
  'breakout',
  'double-bottom',
  'trend-follow'
]);

// Entry form validation schema
export const entryEditSchema = z.object({
  // 読み取り専用フィールド
  symbolCode: z.string().min(1, '銘柄コードが必要です'),
  symbolName: z.string().min(1, '銘柄名が必要です'),
  
  // 編集可能フィールド
  side: z.enum(['LONG', 'SHORT'], {
    errorMap: () => ({ message: 'ポジションタイプを選択してください' })
  }),
  
  price: z.number({
    required_error: '価格を入力してください',
    invalid_type_error: '価格は数値である必要があります'
  })
  .min(0.01, '価格は0.01円以上である必要があります')
  .refine((val) => {
    // 小数点以下2桁までの制限
    const decimalPart = val.toString().split('.')[1];
    return !decimalPart || decimalPart.length <= 2;
  }, {
    message: '価格は小数点以下2桁までです'
  })
  .refine((val) => {
    // 3桁以上の小数を拒否
    const rounded = Math.round(val * 100) / 100;
    return Math.abs(val - rounded) < 0.001;
  }, {
    message: '価格は小数点以下2桁までです'
  }),
  
  qty: z.number({
    required_error: '株数を入力してください',
    invalid_type_error: '株数は数値である必要があります'
  })
  .int('株数は整数である必要があります')
  .min(1, '株数は1株以上である必要があります'),
  
  note: z.string().optional(),
  chartPattern: chartPatternEnum.optional(),
  
  // メタデータ
  // tradeId は既存データに存在しないケースがあるため任意扱いにする
  tradeId: z.string().optional(),
  executedAt: z.string().optional(),
  version: z.number({
    required_error: 'バージョン情報が必要です',
    invalid_type_error: 'バージョン情報が不正です'
  }).min(0, 'バージョン情報が不正です')
});

export type EntryEditFormData = z.infer<typeof entryEditSchema>;

// バリデーションエラーメッセージの型定義
export interface ValidationErrors {
  symbolCode?: string;
  symbolName?: string;
  side?: string;
  price?: string;
  qty?: string;
  note?: string;
  chartPattern?: string;
  tradeId?: string;
  executedAt?: string;
  version?: string;
}

// フォーム用のヘルパー関数
export const validatePrice = (value: number): boolean => {
  if (value <= 0) return false;
  const decimalPart = value.toString().split('.')[1];
  if (decimalPart && decimalPart.length > 2) return false;
  return true;
};

export const validateQty = (value: number): boolean => {
  return Number.isInteger(value) && value >= 1;
};

// デフォルト値
export const defaultEntryFormData: Partial<EntryEditFormData> = {
  side: 'LONG',
  price: 0,
  qty: 0,
  note: '',
  chartPattern: undefined,
  executedAt: new Date().toISOString().slice(0, 16)
};
