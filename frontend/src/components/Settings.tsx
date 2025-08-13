import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './UI/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './UI/card';
import { Switch } from './UI/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './UI/alert-dialog';
import { ArrowLeft, Crown, LogOut } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '山田太郎',
    email: 'yamada@example.com'
  });

  const [tradingRules, setTradingRules] = useState({
    takeProfitPercent: 4.0,
    stopLossPercent: 2.0
  });

  const [notifications, setNotifications] = useState({
    dailyReport: true
  });

  const handleSaveProfile = () => {
    // Save profile logic
    console.log('Profile saved:', profile);
  };

  const handleLogout = () => {
    // Clear any stored authentication data (localStorage, sessionStorage, etc.)
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('userSession');
    
    // Navigate to login page
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="container mx-auto px-8 py-8 max-w-4xl mt-16">
        {/* Header with Logout Button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">設定</h1>
            <p className="text-gray-600 mt-1">アカウントと取引の設定を管理</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="flex items-center gap-2 h-10 px-4 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <LogOut className="w-5 h-5 text-red-500" />
                  ログアウト確認
                </AlertDialogTitle>
                <AlertDialogDescription>
                  本当にログアウトしますか？未保存の変更は失われます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700"
                >
                  ログアウト
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">プロフィール</TabsTrigger>
            <TabsTrigger value="plan">プラン</TabsTrigger>
            <TabsTrigger value="trading">取引ルール</TabsTrigger>
            <TabsTrigger value="notifications">通知</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>プロフィール設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">お名前</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                      className="h-12"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveProfile}
                    style={{ backgroundColor: '#5ED0E8' }}
                  >
                    保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plan Tab */}
          <TabsContent value="plan" className="mt-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>プラン管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border">
                  <div className="flex items-center gap-3 mb-4">
                    <Crown className="w-6 h-6 text-yellow-600" />
                    <h3 className="text-xl font-bold">Premium プラン</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">料金</p>
                      <p className="text-2xl font-bold">¥9,800<span className="text-sm font-normal">/月</span></p>
                    </div>
                    <div>
                      <p className="text-gray-600">次回更新</p>
                      <p className="font-medium">2024/01/20</p>
                    </div>
                    <div>
                      <p className="text-gray-600">ステータス</p>
                      <p className="text-green-600 font-medium">アクティブ</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">プラン特典</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>✓ 無制限チャート分析</li>
                    <li>✓ リアルタイム市場データ</li>
                    <li>✓ AI トレード推奨</li>
                    <li>✓ 詳細レポート</li>
                    <li>✓ 優先サポート</li>
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline">
                    プラン変更
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trading Rules Tab */}
          <TabsContent value="trading" className="mt-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>取引ルール設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="takeProfit">利確 %</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="takeProfit"
                        type="number"
                        step="0.1"
                        value={tradingRules.takeProfitPercent}
                        onChange={(e) => setTradingRules({
                          ...tradingRules, 
                          takeProfitPercent: parseFloat(e.target.value)
                        })}
                        className="h-12 w-24"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stopLoss">損切り %</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="stopLoss"
                        type="number"
                        step="0.1"
                        value={tradingRules.stopLossPercent}
                        onChange={(e) => setTradingRules({
                          ...tradingRules, 
                          stopLossPercent: parseFloat(e.target.value)
                        })}
                        className="h-12 w-24"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button style={{ backgroundColor: '#5ED0E8' }}>
                    保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>通知設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="font-medium">日報メール</h4>
                      <p className="text-sm text-gray-600">毎日の取引サマリーをメールで受信</p>
                    </div>
                    <Switch
                      checked={notifications.dailyReport}
                      onCheckedChange={(checked) => 
                        setNotifications({...notifications, dailyReport: checked})
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button style={{ backgroundColor: '#5ED0E8' }}>
                    保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}