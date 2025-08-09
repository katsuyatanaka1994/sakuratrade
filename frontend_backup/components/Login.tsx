import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Demo login - simulate authentication
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 1000);
  };

  const handleSignUp = async () => {
    navigate('/onboarding');
  };

  return (
    <div className="w-[1440px] h-screen mx-auto bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/40 flex">
      {/* Left Side - Branding & Hero */}
      <div className="flex-1 flex flex-col justify-between p-16 relative overflow-hidden">
        {/* Logo */}
        <div className="z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5ED0E8] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">桜</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">SakuraTrade</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="z-10 max-w-lg">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
            日本株取引の
            <span className="text-[#5ED0E8]">AI分析</span>
            プラットフォーム
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            初心者から中級者まで、自信を持ってエントリー・エグジット判断ができるよう、AIがチャート分析をサポートします。
          </p>
          
          {/* Features List */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#5ED0E8] rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">AIによるリアルタイムチャート分析</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#5ED0E8] rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">チャット形式での直感的な操作</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#5ED0E8] rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-700">詳細な取引記録と日次レポート</span>
            </div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-gradient-to-br from-[#5ED0E8]/10 to-blue-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-cyan-200/30 to-[#5ED0E8]/20 rounded-full blur-2xl"></div>

        {/* Footer */}
        <div className="z-10 text-sm text-gray-500">
          © 2025 SakuraTrade. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-[560px] bg-white flex items-center justify-center p-16 relative">
        {/* Form Container */}
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">ログイン</h2>
            <p className="text-gray-600">アカウントにサインインして取引を開始</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">
                メールアドレス
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-gray-300 focus:border-[#5ED0E8] focus:ring-[#5ED0E8]/20"
                placeholder="your-email@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                パスワード
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border-gray-300 focus:border-[#5ED0E8] focus:ring-[#5ED0E8]/20"
                placeholder="パスワードを入力"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                  className="border-gray-300 data-[state=checked]:bg-[#5ED0E8] data-[state=checked]:border-[#5ED0E8]"
                />
                <Label htmlFor="remember" className="text-sm text-gray-600">
                  ログイン状態を保持
                </Label>
              </div>
              <a href="#" className="text-sm text-[#5ED0E8] hover:text-[#5ED0E8]/80 font-medium">
                パスワードを忘れた方
              </a>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-[#5ED0E8] hover:bg-[#5ED0E8]/90 text-white font-medium rounded-lg transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ログイン中...
                </div>
              ) : (
                'ログイン'
              )}
            </Button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500">または</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-12 border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button 
                variant="outline" 
                className="h-12 border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.0173 0C5.3965 0 0.0291 5.367 0.0291 11.987c0 5.284 3.3965 9.823 8.1208 11.674.0604-1.068.1151-2.707-.0241-3.901-.1259-.987-1.151-4.888-1.151-4.888s-.2941-.5941-.2941-1.473c0-1.379.7997-2.408 1.7952-2.408.8466 0 1.2551.6354 1.2551 1.3963 0 .8508-.5426 2.123-.8229 3.302-.2353.9935.498 1.8029 1.4769 1.8029 1.7735 0 3.1378-1.8721 3.1378-4.5722 0-2.3929-1.7199-4.0653-4.1764-4.0653-2.8452 0-4.5138 2.1335-4.5138 4.3389 0 .8594.3308 1.7818.7434 2.2822.0816.0994.0932.1862.0689.2877-.0757.3147-.2439 1.0008-.2769 1.1416-.0422.1862-.1382.2252-.3184.1357-1.1824-.5516-1.9212-2.2822-1.9212-3.6729 0-2.9993 2.1778-5.7546 6.2772-5.7546 3.2952 0 5.8567 2.3486 5.8567 5.4887 0 3.2741-2.0629 5.9069-4.9269 5.9069-.9616 0-1.8668-.5003-2.1746-1.0971l-.4115 1.5693c-.1498.5825-.5537 1.3117-.8229 1.7555.6196.1913 1.2749.2942 1.9554.2942C18.6328 23.9718 24 18.6048 24 11.9848 24 5.367 18.6328 0.0026 12.0173 0.0026z"/>
                </svg>
                Apple
              </Button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <span className="text-gray-600">アカウントをお持ちでない方は </span>
            <button 
              onClick={handleSignUp}
              className="text-[#5ED0E8] hover:text-[#5ED0E8]/80 font-medium transition-colors"
            >
              新規登録
            </button>
          </div>
        </div>

        {/* Decorative Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#5ED0E8]/10 to-transparent rounded-full blur-2xl"></div>
      </div>
    </div>
  );
}