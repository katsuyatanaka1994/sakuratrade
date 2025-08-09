import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/middleware';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// CORS configuration
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// User signup route
app.post('/make-server-71d85056/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Initialize user data in KV store
    const userId = data.user.id;
    await kv.set(`user:${userId}:profile`, {
      name,
      email,
      created_at: new Date().toISOString()
    });

    await kv.set(`user:${userId}:trading_rules`, {
      rrTarget: 2.0,
      stopLossPercent: 2.0
    });

    await kv.set(`user:${userId}:notifications`, {
      dailyReport: true,
      slackWebhook: false,
      tradeAlerts: true,
      marketNews: false
    });

    return c.json({ user: data.user });
  } catch (error) {
    console.log('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Trade recording route
app.post('/make-server-71d85056/trades', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { action, symbol, quantity, price, type } = await c.req.json();
    
    const tradeId = `trade:${user.id}:${Date.now()}`;
    const trade = {
      id: tradeId,
      user_id: user.id,
      action, // 'buy' or 'sell'
      symbol,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      type, // 'day' or 'swing'
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    await kv.set(tradeId, trade);
    
    // Update user's active positions
    const positionsKey = `user:${user.id}:positions`;
    const positions = await kv.get(positionsKey) || {};
    
    if (action === 'buy') {
      if (!positions[symbol]) {
        positions[symbol] = { quantity: 0, totalCost: 0, avgPrice: 0 };
      }
      const newTotalCost = positions[symbol].totalCost + (quantity * price);
      const newQuantity = positions[symbol].quantity + quantity;
      positions[symbol] = {
        quantity: newQuantity,
        totalCost: newTotalCost,
        avgPrice: newTotalCost / newQuantity
      };
    } else if (action === 'sell') {
      if (positions[symbol] && positions[symbol].quantity >= quantity) {
        positions[symbol].quantity -= quantity;
        if (positions[symbol].quantity === 0) {
          delete positions[symbol];
        }
      }
    }
    
    await kv.set(positionsKey, positions);

    return c.json({ trade, positions });
  } catch (error) {
    console.log('Trade recording error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Chat AI analysis route
app.post('/make-server-71d85056/analyze', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { message, chartData } = await c.req.json();
    
    // Simulate AI analysis (in a real app, this would call an AI service)
    let analysis = '';
    
    if (message.includes('トレンド') || message.includes('trend')) {
      analysis = '現在のチャートパターンは上昇トレンドを示しています。RSI指標は65で過熱感があります。サポートライン付近でのエントリーを推奨します。';
    } else if (message.includes('リスク') || message.includes('risk')) {
      analysis = 'リスク管理の観点から、ポジションサイズは資金の2%以下に抑えることを推奨します。損切りラインは直近安値の下に設定してください。';
    } else if (chartData) {
      analysis = 'アップロードされたチャートを分析しました。移動平均線のゴールデンクロスが確認できます。上昇トレンド継続の可能性が高いです。';
    } else {
      analysis = 'より具体的な質問をしていただければ、詳しい分析を提供できます。チャート画像のアップロードもお試しください。';
    }

    // Save chat history
    const chatId = `chat:${user.id}:${Date.now()}`;
    await kv.set(chatId, {
      user_id: user.id,
      message,
      analysis,
      timestamp: new Date().toISOString()
    });

    return c.json({ analysis });
  } catch (error) {
    console.log('Analysis error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user positions
app.get('/make-server-71d85056/positions', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const positions = await kv.get(`user:${user.id}:positions`) || {};
    return c.json({ positions });
  } catch (error) {
    console.log('Get positions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user settings
app.get('/make-server-71d85056/settings/:type', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const settingsType = c.req.param('type');
    const settings = await kv.get(`user:${user.id}:${settingsType}`);
    
    return c.json({ settings });
  } catch (error) {
    console.log('Get settings error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user settings
app.put('/make-server-71d85056/settings/:type', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const settingsType = c.req.param('type');
    const newSettings = await c.req.json();
    
    await kv.set(`user:${user.id}:${settingsType}`, newSettings);
    
    return c.json({ success: true, settings: newSettings });
  } catch (error) {
    console.log('Update settings error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Market data route (mock data)
app.get('/make-server-71d85056/market', async (c) => {
  try {
    // Mock market data (in a real app, this would fetch from a market data API)
    const marketData = {
      nikkei: { value: '32,891.70', change: '+156.30', changePercent: '+0.48%' },
      topix: { value: '2,385.12', change: '+8.45', changePercent: '+0.36%' },
      usdjpy: { value: '149.85', change: '-0.22', changePercent: '-0.15%' }
    };

    return c.json({ marketData });
  } catch (error) {
    console.log('Market data error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);
