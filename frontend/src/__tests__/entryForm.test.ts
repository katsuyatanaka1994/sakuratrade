import { entryEditSchema, validatePrice, validateQty, type EntryEditFormData } from '../schemas/entryForm';

describe.skip('Entry Form Validation Schema (仕様確認中)', () => {
  describe('Price Validation', () => {
    it('should accept valid prices', () => {
      const validPrices = [0.01, 1, 100, 1500.99, 15870.50];
      
      validPrices.forEach(price => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(true);
      });
    });

    it('should reject prices <= 0', () => {
      const invalidPrices = [0, -1, -100.50];
      
      invalidPrices.forEach(price => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('0.01円以上である必要があります');
        }
      });
    });

    it('should reject prices with more than 2 decimal places', () => {
      const invalidPrices = [1.123, 100.999, 0.001];
      
      invalidPrices.forEach(price => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('小数点以下2桁まで');
        }
      });
    });

    it('should accept exactly 2 decimal places', () => {
      const validPrices = [1.00, 100.99, 1500.25];
      
      validPrices.forEach(price => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Quantity Validation', () => {
    it('should accept valid quantities', () => {
      const validQuantities = [1, 100, 1000, 500000];
      
      validQuantities.forEach(qty => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price: 1500,
          qty,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(true);
      });
    });

    it('should reject quantities <= 0', () => {
      const invalidQuantities = [0, -1, -100];
      
      invalidQuantities.forEach(qty => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price: 1500,
          qty,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('1株以上である必要があります');
        }
      });
    });

    it('should reject non-integer quantities', () => {
      const invalidQuantities = [1.5, 100.1, 0.5];
      
      invalidQuantities.forEach(qty => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price: 1500,
          qty,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('整数である必要があります');
        }
      });
    });
  });

  describe('Side Validation', () => {
    it('should accept valid sides', () => {
      const validSides: ('LONG' | 'SHORT')[] = ['LONG', 'SHORT'];
      
      validSides.forEach(side => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side,
          price: 1500,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid sides', () => {
      const invalidSides = ['BUY', 'SELL', 'long', 'short', ''];
      
      invalidSides.forEach(side => {
        const result = entryEditSchema.safeParse({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side,
          price: 1500,
          qty: 100,
          tradeId: 'test-trade-123'
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('ポジションタイプを選択してください');
        }
      });
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject missing symbolCode', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 1500,
        qty: 100,
        tradeId: 'test-trade-123'
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('銘柄コードが必要です');
      }
    });

    it('should reject missing symbolName', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: '',
        side: 'LONG',
        price: 1500,
        qty: 100,
        tradeId: 'test-trade-123'
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('銘柄名が必要です');
      }
    });

    it('should reject missing tradeId', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 1500,
        qty: 100,
        tradeId: ''
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('トレードIDが必要です');
      }
    });
  });

  describe('Optional Fields', () => {
    it('should accept empty note', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 1500,
        qty: 100,
        note: '',
        tradeId: 'test-trade-123'
      });
      
      expect(result.success).toBe(true);
    });

    it('should accept undefined note', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 1500,
        qty: 100,
        tradeId: 'test-trade-123'
      });
      
      expect(result.success).toBe(true);
    });

    it('should accept valid note', () => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 1500,
        qty: 100,
        note: 'テスト用のメモです',
        tradeId: 'test-trade-123'
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.note).toBe('テスト用のメモです');
      }
    });
  });

  describe('Complete Valid Data', () => {
    it('should accept complete valid form data', () => {
      const validData: EntryEditFormData = {
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 15870.50,
        qty: 100,
        note: 'テスト投資',
        tradeId: 'test-trade-123',
        executedAt: '2025-09-01T10:30'
      };
      
      const result = entryEditSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });
  });
});

describe('Helper Functions', () => {
  describe('validatePrice', () => {
    it('should validate prices correctly', () => {
      expect(validatePrice(0.01)).toBe(true);
      expect(validatePrice(1)).toBe(true);
      expect(validatePrice(100.99)).toBe(true);
      expect(validatePrice(1500.25)).toBe(true);
      
      expect(validatePrice(0)).toBe(false);
      expect(validatePrice(-1)).toBe(false);
      expect(validatePrice(1.123)).toBe(false);
      expect(validatePrice(0.001)).toBe(false);
    });
  });

  describe('validateQty', () => {
    it('should validate quantities correctly', () => {
      expect(validateQty(1)).toBe(true);
      expect(validateQty(100)).toBe(true);
      expect(validateQty(1000)).toBe(true);
      
      expect(validateQty(0)).toBe(false);
      expect(validateQty(-1)).toBe(false);
      expect(validateQty(1.5)).toBe(false);
      expect(validateQty(0.5)).toBe(false);
    });
  });
});

describe.skip('Real-world Scenarios (仕様確認中)', () => {
  it('should handle typical stock entry data', () => {
    const stockData = {
      symbolCode: '6305',
      symbolName: '日立建機',
      side: 'LONG' as const,
      price: 3000,
      qty: 100,
      note: 'テクニカル分析に基づく購入',
      tradeId: 'trade-20250901-001',
      executedAt: '2025-09-01T09:30'
    };
    
    const result = entryEditSchema.safeParse(stockData);
    expect(result.success).toBe(true);
  });

  it('should handle cryptocurrency-like precision (reject)', () => {
    const cryptoData = {
      symbolCode: 'BTC',
      symbolName: 'Bitcoin',
      side: 'LONG' as const,
      price: 1234.567, // 3桁小数点
      qty: 0.5, // 非整数
      tradeId: 'crypto-trade-001'
    };
    
    const result = entryEditSchema.safeParse(cryptoData);
    expect(result.success).toBe(false);
  });

  it('should handle edge case prices', () => {
    const edgeCases = [
      { price: 0.01, shouldPass: true }, // 最小値
      { price: 0.99, shouldPass: true }, // 1円未満
      { price: 999999.99, shouldPass: true }, // 高額
      { price: 1.999, shouldPass: false }, // 3桁小数
    ];
    
    edgeCases.forEach(({ price, shouldPass }) => {
      const result = entryEditSchema.safeParse({
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price,
        qty: 100,
        tradeId: 'edge-case-test'
      });
      
      expect(result.success).toBe(shouldPass);
    });
  });
});